/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const data = read("lib/data/bmid-box.ts");
const settingsTab = read("app/dashboard/bmid-box/_components/settings-tab.tsx");
const serverSettings = read("lib/server/bmid-box.ts");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  data.includes("instagramConnectEnabled: boolean"),
  "BmidBoxSettings should expose instagramConnectEnabled"
);

assert(
  data.includes("facebookConnectEnabled: boolean"),
  "BmidBoxSettings should expose facebookConnectEnabled"
);

assert(
  data.includes("instagramConnectEnabled: true"),
  "Seeded BMID Box settings should default Instagram Connect to enabled"
);

assert(
  data.includes("facebookConnectEnabled: true"),
  "Seeded BMID Box settings should default Facebook Connect to enabled"
);

assert(
  settingsTab.includes("Instagram Connect"),
  "BMID Box settings UI should include an Instagram Connect control"
);

assert(
  settingsTab.includes("Facebook Connect"),
  "BMID Box settings UI should include a Facebook Connect control"
);

assert(
  settingsTab.includes("instagramConnectEnabled"),
  "BMID Box settings UI should edit instagramConnectEnabled"
);

assert(
  settingsTab.includes("facebookConnectEnabled"),
  "BMID Box settings UI should edit facebookConnectEnabled"
);

assert(
  serverSettings.includes("instagramConnectEnabled: existing.instagramConnectEnabled ?? seededSettings.instagramConnectEnabled"),
  "Existing BMID Box settings docs should backfill instagramConnectEnabled"
);

assert(
  serverSettings.includes("facebookConnectEnabled: existing.facebookConnectEnabled ?? seededSettings.facebookConnectEnabled"),
  "Existing BMID Box settings docs should backfill facebookConnectEnabled"
);

console.log("bmid-box-instagram-facebook-connect-toggle: ok");
