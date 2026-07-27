import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');

function loadDotEnv() {
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function resolveKeyPath(keyPath) {
  if (path.isAbsolute(keyPath) && fs.existsSync(keyPath)) return keyPath;
  for (const candidate of [
    path.resolve(root, keyPath),
    path.resolve(root, '..', keyPath),
    path.resolve(process.cwd(), keyPath),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return keyPath;
}

function loadServiceAccount() {
  loadDotEnv();
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  const keyPath =
    (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim() ||
    (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();

  const source = raw || keyPath;
  if (!source) {
    throw new Error('Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.');
  }

  const trimmed = source.replace(/^['"]|['"]$/g, '');
  const serviceAccount = trimmed.startsWith('{')
    ? JSON.parse(trimmed)
    : JSON.parse(fs.readFileSync(resolveKeyPath(trimmed), 'utf8'));

  if (serviceAccount.private_key?.includes('\\n')) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  return serviceAccount;
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const valueAfter = (name) => {
    const idx = process.argv.indexOf(name);
    return idx >= 0 ? process.argv[idx + 1] : undefined;
  };
  return {
    apply: args.has('--apply'),
    limit: Number(valueAfter('--limit') || 0),
    authorId: valueAfter('--authorId') || '',
    postId: valueAfter('--postId') || '',
    endpoint:
      valueAfter('--endpoint') ||
      process.env.VIDEO_THUMB_ENDPOINT ||
      'https://app.biome-aura.com/api/generate-video-thumb',
  };
}

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function firstVideoUrl(data) {
  if (!Array.isArray(data.videoURLs)) return '';
  const first = data.videoURLs[0];
  if (typeof first === 'string') return cleanString(first);
  if (first && typeof first === 'object') {
    return cleanString(first.url) || cleanString(first.uri) || cleanString(first.src);
  }
  return '';
}

function thumbnailUrl(data) {
  return cleanString(data.thumbnailURL) || cleanString(data.thumbnailUrl) || cleanString(data.videoThumbURL) || cleanString(data.thumbURL);
}

async function main() {
  const opts = parseArgs();
  const serviceAccount = loadServiceAccount();
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'project-v-f2d15.firebasestorage.app';

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: bucketName,
  });

  const db = admin.firestore();
  const bucket = admin.storage().bucket(bucketName);
  const snap = await db.collectionGroup('posts').get();
  const candidates = [];

  for (const doc of snap.docs) {
    const authorId = doc.ref.parent.parent?.id || '';
    const postId = doc.id;
    if (opts.authorId && authorId !== opts.authorId) continue;
    if (opts.postId && postId !== opts.postId) continue;

    const data = doc.data();
    const videoURL = firstVideoUrl(data);
    if (!authorId || !videoURL) continue;

    const prefix = `postThumbs/${authorId}/${postId}`;
    candidates.push({ doc, authorId, postId, videoURL, prefix, oldThumb: thumbnailUrl(data) });
    if (opts.limit && candidates.length >= opts.limit) break;
  }

  console.log(JSON.stringify({ mode: opts.apply ? 'apply' : 'dry-run', count: candidates.length, endpoint: opts.endpoint }, null, 2));
  for (const item of candidates) {
    console.log(`${opts.apply ? 'APPLY' : 'DRY'} users/${item.authorId}/posts/${item.postId} oldThumb=${item.oldThumb ? 'yes' : 'no'}`);
    if (!opts.apply) continue;

    await bucket.file(`${item.prefix}/thumb.jpg`).delete({ ignoreNotFound: true });
    await item.doc.ref.set(
      {
        thumbnailURL: admin.firestore.FieldValue.delete(),
        thumbnailUrl: admin.firestore.FieldValue.delete(),
        videoThumbURL: admin.firestore.FieldValue.delete(),
        thumbURL: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );

    const res = await fetch(opts.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoURL: item.videoURL, prefix: item.prefix, force: true }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.url) {
      throw new Error(`Thumb generation failed for users/${item.authorId}/posts/${item.postId}: ${res.status} ${JSON.stringify(body)}`);
    }
    await item.doc.ref.set({ thumbnailURL: body.url }, { merge: true });
    console.log(`UPDATED users/${item.authorId}/posts/${item.postId}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
