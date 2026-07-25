import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import https from "https";
import crypto from "crypto";
import { createRequire } from "module";
import { execFile } from "child_process";
import { env } from "./utils";
import { storage } from "../firebase";

type AnyRecord = Record<string, unknown>;

const isHttp = (v: unknown): v is string =>
  typeof v === "string" && v.startsWith("http");

const require = createRequire(import.meta.url);
let cachedFfmpegPath: string | null = null;

function getFfmpegPath(): string {
  if (cachedFfmpegPath) return cachedFfmpegPath;

  try {
    const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg") as { path?: unknown };
    const ffmpegPath = ffmpegInstaller.path;
    if (typeof ffmpegPath !== "string" || !ffmpegPath) {
      throw new Error("Package did not expose a valid ffmpeg path");
    }
    if (!fs.existsSync(ffmpegPath)) {
      throw new Error(`Missing ffmpeg binary at ${ffmpegPath}`);
    }
    cachedFfmpegPath = ffmpegPath;
    return ffmpegPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to resolve ffmpeg from @ffmpeg-installer/ffmpeg: ${message}`);
  }
}

export function pickFirstImage(post: AnyRecord, fallback = ""): string {
  for (const key of ["coverImage", "imageURL", "imageUrl", "image"]) {
    const v = post[key];
    if (isHttp(v)) return v;
  }

  const imageURLs = post.imageURLs;
  if (Array.isArray(imageURLs) && isHttp(imageURLs[0])) return imageURLs[0];

  const images = post.images;
  if (Array.isArray(images) && images.length) {
    const i = images[0];
    if (isHttp(i)) return i;
    if (i && typeof i === "object" && isHttp((i as AnyRecord).url)) return (i as AnyRecord).url as string;
  }

  const media = post.media;
  if (Array.isArray(media)) {
    const img = media.find(
      (m): m is AnyRecord =>
        !!m && typeof m === "object" && (m as AnyRecord).type === "image" && isHttp((m as AnyRecord).uri)
    );
    if (img) return img.uri as string;
  }
  return fallback;
}

export function pickAllImages(post: AnyRecord): string[] {
  const urls: string[] = [];
  const imageURLs = post.imageURLs;
  if (Array.isArray(imageURLs)) {
    for (const u of imageURLs) if (isHttp(u)) urls.push(u);
  } else if (Array.isArray(post.images)) {
    for (const i of post.images) {
      if (isHttp(i)) urls.push(i);
      else if (i && typeof i === "object" && isHttp((i as AnyRecord).url))
        urls.push((i as AnyRecord).url as string);
    }
  }
  if (!urls.length) {
    const single = pickFirstImage(post);
    if (single) urls.push(single);
  }
  return urls;
}

export function pickFirstVideo(post: AnyRecord): string {
  for (const key of ["videoURL", "videoUrl", "video", "videoUri", "videoURI"]) {
    const v = post[key];
    if (isHttp(v)) return v;
  }
  const videoURLs = post.videoURLs;
  if (Array.isArray(videoURLs) && videoURLs.length) {
    const u = videoURLs[0];
    if (isHttp(u)) return u;
    if (u && typeof u === "object") {
      const o = u as AnyRecord;
      if (isHttp(o.url)) return o.url as string;
      if (isHttp(o.uri)) return o.uri as string;
      if (isHttp(o.src)) return o.src as string;
    }
  }
  const videoURIs = post.videoURIs;
  if (Array.isArray(videoURIs) && isHttp(videoURIs[0])) return videoURIs[0];

  const media = post.media;
  if (Array.isArray(media)) {
    const vid = media.find(
      (m): m is AnyRecord =>
        !!m && typeof m === "object" && (m as AnyRecord).type === "video" && isHttp((m as AnyRecord).uri)
    );
    if (vid) return vid.uri as string;
    const vid2 = media.find(
      (m): m is AnyRecord =>
        !!m && typeof m === "object" && (m as AnyRecord).type === "video" && isHttp((m as AnyRecord).url)
    );
    if (vid2) return vid2.url as string;
  }
  return "";
}

export function pickVideoThumbnail(post: AnyRecord): string {
  for (const key of ["thumbnailURL", "thumbnailUrl", "thumbnail", "videoThumbnail"]) {
    const v = post[key];
    if (isHttp(v)) return v;
  }
  const media = post.media;
  if (Array.isArray(media)) {
    const vid = media.find(
      (m): m is AnyRecord => !!m && typeof m === "object" && (m as AnyRecord).type === "video"
    );
    if (vid) {
      if (isHttp(vid.thumbnail)) return vid.thumbnail as string;
      if (isHttp(vid.thumbnailUrl)) return vid.thumbnailUrl as string;
    }
  }
  return "";
}

const uuid = () => crypto.randomUUID();

function downloadVideoToTemp(videoURL: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(os.tmpdir(), `video-${uuid()}.mp4`);
    const file = fs.createWriteStream(tempPath);
    const client = new URL(videoURL).protocol === "https:" ? https : http;

    client
      .get(videoURL, (response) => {
        if (response.statusCode !== 200) {
          file.destroy();
          fs.unlink(tempPath, () => {});
          return reject(new Error(`Download failed: ${response.statusCode}`));
        }
        response.pipe(file);
        file.on("finish", () => file.close(() => resolve(tempPath)));
      })
      .on("error", (err) => {
        file.destroy();
        fs.unlink(tempPath, () => {});
        reject(err);
      });

    file.on("error", (err) => {
      fs.unlink(tempPath, () => {});
      reject(err);
    });
  });
}

function extractFrameAtOffset(videoPath: string, offsetSeconds: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(os.tmpdir(), `frame-${uuid()}.jpg`);
    execFile(
      getFfmpegPath(),
      ["-y", "-ss", String(offsetSeconds), "-i", videoPath, "-frames:v", "1", "-q:v", "2", outputPath],
      { windowsHide: true },
      (err, _stdout, stderr) => {
        if (err) return reject(new Error(`ffmpeg failed: ${String(stderr || err.message).trim()}`));
        // ffmpeg can exit 0 without actually writing outputPath (seen in
        // production on this deployment) — verify the frame really landed
        // before handing back a path nothing else will find.
        let stat: fs.Stats | null = null;
        try {
          stat = fs.statSync(outputPath);
        } catch {
          stat = null;
        }
        if (!stat || stat.size === 0) {
          return reject(
            new Error(
              `ffmpeg exited 0 but produced no frame at ${outputPath}. stderr: ${
                String(stderr || "").trim().slice(-800) || "(empty)"
              }`
            )
          );
        }
        resolve(outputPath);
      }
    );
  });
}

async function extractFrameFromVideo(videoPath: string): Promise<string> {
  const offsets = [0, 1, 2];
  const errors: string[] = [];
  for (const offset of offsets) {
    try {
      return await extractFrameAtOffset(videoPath, offset);
    } catch (error) {
      errors.push(`-ss ${offset}: ${(error as Error).message}`);
    }
  }
  throw new Error(`Unable to extract video frame after ${offsets.length} attempts. ${errors.join(" | ")}`);
}

// Was an unauthenticated REST POST — only worked when the target path
// happened to be publicly writable, which produced the 403s we saw in
// production. The Admin SDK authenticates via the service account this
// dashboard already uses for Firestore, same as everywhere else in
// lib/server, and matches the "download URL with token" format the rest
// of the app expects for thumbnailURL/photoURL fields.
async function uploadFrameToStorageREST(localFilePath: string, destPath: string): Promise<string> {
  const bucket = env("FIREBASE_STORAGE_BUCKET", "project-v-f2d15.firebasestorage.app");
  const token = uuid();
  await storage().bucket(bucket).upload(localFilePath, {
    destination: destPath,
    metadata: {
      contentType: "image/jpeg",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(destPath)}?alt=media&token=${token}`;
}

export async function checkExistingFrame(prefix: string): Promise<string | null> {
  const bucket = env("FIREBASE_STORAGE_BUCKET", "project-v-f2d15.firebasestorage.app");
  const key = `${prefix}/thumb.jpg`;
  try {
    const file = storage().bucket(bucket).file(key);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [metadata] = await file.getMetadata();
    const tokens = metadata.metadata?.firebaseStorageDownloadTokens as string | undefined;
    const token = tokens?.split(",")[0];
    if (!token) return null;
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(key)}?alt=media&token=${token}`;
  } catch {
    return null;
  }
}

export async function generateFrameFromVideo(videoURL: string, prefix: string): Promise<string> {
  const existing = await checkExistingFrame(prefix);
  if (existing) return existing;

  let videoPath: string | null = null;
  let framePath: string | null = null;
  try {
    videoPath = await downloadVideoToTemp(videoURL);
    framePath = await extractFrameFromVideo(videoPath);
    return await uploadFrameToStorageREST(framePath, `${prefix}/thumb.jpg`);
  } finally {
    if (videoPath) fs.unlink(videoPath, () => {});
    if (framePath) fs.unlink(framePath, () => {});
  }
}
