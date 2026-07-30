/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8"));
const buildScript = pkg.scripts?.build || "";

const checks = [
  {
    name: "build script raises Node heap for production deploy builds",
    pass: buildScript.includes("NODE_OPTIONS=--max-old-space-size=4096"),
  },
];

let failed = false;
for (const check of checks) {
  const status = check.pass ? "PASS" : "FAIL";
  console.log(`${status} ${check.name}`);
  if (!check.pass) failed = true;
}

if (failed) process.exit(1);
