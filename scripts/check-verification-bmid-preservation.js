/* global __dirname */
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

const route = read("app/api/verification/[id]/route.ts");

const checks = [
  {
    name: "verification document type tracks preserved BMID number",
    pass: /previousBmidNumber\?: string \| null;/.test(route),
  },
  {
    name: "user revocation preserves active BMID before clearing it",
    pass:
      /async function revokeApprovedUserState\(userId: string\)/.test(route) &&
      /const preservedBmidNumber =\s+existingBmidNumber \|\|/.test(route) &&
      /previousBmidNumber: preservedBmidNumber/.test(route) &&
      /bmidStatus: "cancelled"/.test(route),
  },
  {
    name: "approval reuses preserved BMID before generating a new one",
    pass:
      /const preservedBmidNumber =/.test(route) &&
      /existingBmidNumber \|\| preservedBmidNumber/.test(route),
  },
  {
    name: "new BMID allocation treats preserved BMIDs as reserved",
    pass:
      /const activeSequence = parseBmidSequence\(doc\.data\(\)\.bmidNumber\);/.test(route) &&
      /const previousSequence = parseBmidSequence\(doc\.data\(\)\.previousBmidNumber\);/.test(route) &&
      /for \(const sequence of \[activeSequence, previousSequence\]\)/.test(route),
  },
  {
    name: "removed verification request keeps the old BMID as previousBmidNumber",
    pass:
      /await updateDoc\("verificationRequests", id, \{ bmidNumber: null, previousBmidNumber: preservedBmidNumber \}\);/.test(route),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Verification BMID preservation checks failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(`Verification BMID preservation checks passed (${checks.length} checks).`);
