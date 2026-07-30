/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pickerPath = path.join(root, "lib", "server", "share", "media-pickers.ts");
const pickerSource = fs.readFileSync(pickerPath, "utf8");

const forbiddenPatterns = [
  /from ["']fs["']/,
  /from ["']os["']/,
  /from ["']path["']/,
  /from ["']http["']/,
  /from ["']https["']/,
  /from ["']child_process["']/,
  /createRequire/,
  /@ffmpeg-installer\/ffmpeg/,
  /\.\.\/firebase/,
];

const consumers = [
  "app/api/posts/route.ts",
  "app/api/users/[id]/posts/route.ts",
  "app/api/bmid/me/posts/route.ts",
];

const checks = [
  {
    name: "media pickers module avoids heavy server dependencies",
    pass: forbiddenPatterns.every((pattern) => !pattern.test(pickerSource)),
  },
  ...consumers.map((consumer) => {
    const source = fs.readFileSync(path.join(root, consumer), "utf8");
    return {
      name: `${consumer} imports pickers from media-pickers`,
      pass:
        source.includes("@/lib/server/share/media-pickers") &&
        !source.includes("@/lib/server/share/media\"") &&
        !source.includes("@/lib/server/share/media';"),
    };
  }),
];

let failed = false;
for (const check of checks) {
  const status = check.pass ? "PASS" : "FAIL";
  console.log(`${status} ${check.name}`);
  if (!check.pass) failed = true;
}

if (failed) process.exit(1);
