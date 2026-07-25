import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mediaPath = path.join(__dirname, '..', 'lib', 'server', 'share', 'media.ts');
const source = fs.readFileSync(mediaPath, 'utf8');

const generateMatch = source.match(/export async function generateFrameFromVideo[\s\S]*?^}/m);
const generateBody = generateMatch ? generateMatch[0] : '';
const usesBakedOverlay = /bakePauseIconOnImage\s*\(/.test(generateBody);
const uploadsExtractedFrame = /uploadFrameToStorageREST\(framePath,\s*`\$\{prefix\}\/thumb\.jpg`\)/.test(generateBody);

const checks = [
  {
    name: 'generateFrameFromVideo does not bake a play overlay into thumbnails',
    pass: !usesBakedOverlay,
  },
  {
    name: 'generateFrameFromVideo uploads the extracted frame directly',
    pass: uploadsExtractedFrame,
  },
];

let failed = false;
for (const check of checks) {
  const status = check.pass ? 'PASS' : 'FAIL';
  console.log(`${status} ${check.name}`);
  if (!check.pass) failed = true;
}

if (failed) process.exit(1);
