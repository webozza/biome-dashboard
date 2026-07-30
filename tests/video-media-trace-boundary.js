/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const mediaPath = path.resolve(__dirname, "..", "lib", "server", "share", "media.ts");
const source = fs.readFileSync(mediaPath, "utf8");

const checks = [
  {
    name: "video media module does not use dynamic createRequire tracing",
    pass: !/createRequire/.test(source) && !/from ["']module["']/.test(source),
  },
  {
    name: "video media module keeps ffmpeg installer out of static tracing",
    pass: !/from ["']@ffmpeg-installer\/ffmpeg["']/.test(source) && /runtimeRequire\("@ffmpeg-installer\/ffmpeg"\)/.test(source),
  },
];

let failed = false;
for (const check of checks) {
  const status = check.pass ? "PASS" : "FAIL";
  console.log(`${status} ${check.name}`);
  if (!check.pass) failed = true;
}

if (failed) process.exit(1);
