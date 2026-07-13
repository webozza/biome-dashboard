#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`${label} is missing ${expected}`);
  }
}

const dataTypes = read("lib/data/bmid-box.ts");
assertIncludes(dataTypes, "BmidBoxTikTokOwnershipCheck", "BMID Box data types");
assertIncludes(dataTypes, "tiktokOwnership?: BmidBoxTikTokOwnershipCheck | null;", "BMID Box verification checks");

for (const route of ["app/api/bmid-box/requests/route.ts", "app/api/bmid/box/requests/route.ts"]) {
  const source = read(route);
  assertIncludes(source, "function sanitizeTikTokOwnershipCheck", route);
  assertIncludes(source, "provider: \"tiktok\"", route);
  assertIncludes(source, "tiktokOwnership: sanitizeTikTokOwnershipCheck(input.tiktokOwnership)", route);
}

const detailPage = read("app/dashboard/bmid-box/requests/[id]/page.tsx");
assertIncludes(detailPage, "request.sourcePlatform === \"tiktok\"", "BMID Box request detail checks");
assertIncludes(detailPage, "request.verificationChecks.tiktokOwnership?.status === \"verified\"", "BMID Box request detail checks");

console.log("TikTok BMID Box ownership dashboard checks passed.");
