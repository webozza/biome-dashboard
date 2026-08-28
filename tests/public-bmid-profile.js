/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const resolver = read("lib/server/share/profile.ts");
const renderer = read("lib/server/share/profile-render.ts");
const route = read("app/bmid/[identifier]/route.ts");
const approval = read("app/api/verification/[id]/route.ts");
const backfill = read("scripts/backfill-bmid-verified-at.mjs");
const appleLinks = read("app/.well-known/apple-app-site-association/route.ts");

const checks = [
  {
    name: "public resolver requires verified active users",
    pass:
      /data\.verified === true/.test(resolver) &&
      /status !== "cancelled"/.test(resolver) &&
      /data\.isDeleted !== true/.test(resolver) &&
      /data\.isDeactivated !== true/.test(resolver),
  },
  {
    name: "public projection is explicit and excludes private identity fields",
    pass:
      /ResolvedPublicBmidProfile/.test(resolver) &&
      !/email:\s*cleanText\(user\.email/.test(resolver) &&
      !/address:\s*cleanText\(user\.address/.test(resolver) &&
      !/token:\s*user\./.test(resolver),
  },
  {
    name: "portfolio only loads highlighted or BMID-visible work",
    pass:
      /where\("isHighlighted", "==", true\)/.test(resolver) &&
      /status === "approved" \|\| votingStatus === "open" \|\| votingStatus === "finalized"/.test(resolver),
  },
  {
    name: "browser page includes verified identity and branded coming-soon marketplace",
    pass:
      /BMID Verified/.test(renderer) &&
      /Creator portfolio/.test(renderer) &&
      /Coming soon/.test(renderer) &&
      /creator &amp; brand marketplace/.test(renderer) &&
      /Marketplace access is on the way/.test(renderer),
  },
  {
    name: "public route returns safe caching, CSP, and noindex for unavailable profiles",
    pass:
      /Content-Security-Policy/.test(route) &&
      /X-Content-Type-Options/.test(route) &&
      /X-Robots-Tag/.test(route) &&
      /status: 404/.test(route),
  },
  {
    name: "first approval stores a durable BMID member-since timestamp",
    pass:
      /bmidVerifiedAt/.test(approval) &&
      /approvedAt/.test(approval) &&
      /userData\?\.bmidVerifiedAt/.test(approval),
  },
  {
    name: "existing creators have a dry-run-first backfill",
    pass:
      /process\.argv\.includes\("--apply"\)/.test(backfill) &&
      /No writes performed/.test(backfill) &&
      /bmidVerifiedAt/.test(backfill),
  },
  {
    name: "Apple universal-link association includes public BMID profiles",
    pass: /\/bmid\/\*/.test(appleLinks) && /Public BMID profile links/.test(appleLinks),
  },
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Public BMID profile checks failed:");
  failed.forEach((check) => console.error(`- ${check.name}`));
  process.exit(1);
}

console.log(`Public BMID profile checks passed (${checks.length} checks).`);
