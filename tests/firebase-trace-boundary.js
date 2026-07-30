/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const firebasePath = path.resolve(__dirname, "..", "lib", "server", "firebase.ts");
const source = fs.readFileSync(firebasePath, "utf8");

const checks = [
  {
    name: "Firebase initialization avoids app-level credential file reads",
    pass:
      !/from ["']fs["']/.test(source) &&
      !/from ["']path["']/.test(source) &&
      !/readFileSync/.test(source) &&
      !/existsSync/.test(source) &&
      !/process\.cwd\(\)/.test(source),
  },
  {
    name: "Firebase path credentials use application default credentials",
    pass: source.includes("admin.credential.applicationDefault()"),
  },
];

let failed = false;
for (const check of checks) {
  const status = check.pass ? "PASS" : "FAIL";
  console.log(`${status} ${check.name}`);
  if (!check.pass) failed = true;
}

if (failed) process.exit(1);
