type AnyRecord = Record<string, unknown>;

const isHttp = (v: unknown): v is string =>
  typeof v === "string" && v.startsWith("http");

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
