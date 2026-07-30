/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const configPath = path.resolve(__dirname, "..", "next.config.ts");
const source = fs.readFileSync(configPath, "utf8");

const checks = [
  {
    name: "Next build worker count is capped for low-memory deploys",
    pass: /cpus:\s*2/.test(source),
  },
  {
    name: "Next build uses memory-based worker sizing",
    pass: /memoryBasedWorkersCount:\s*true/.test(source),
  },
];

let failed = false;
for (const check of checks) {
  const status = check.pass ? "PASS" : "FAIL";
  console.log(`${status} ${check.name}`);
  if (!check.pass) failed = true;
}

if (failed) process.exit(1);
