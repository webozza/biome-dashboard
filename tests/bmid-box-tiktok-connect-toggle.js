/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const data = read("lib/data/bmid-box.ts");
const settingsTab = read("app/dashboard/bmid-box/_components/settings-tab.tsx");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  data.includes("tiktokConnectEnabled: boolean"),
  "BmidBoxSettings should expose tiktokConnectEnabled"
);

assert(
  data.includes("tiktokConnectEnabled: false"),
  "Seeded BMID Box settings should default TikTok Connect to disabled"
);

assert(
  settingsTab.includes("TikTok Connect"),
  "BMID Box settings UI should include a TikTok Connect control"
);

assert(
  settingsTab.includes("tiktokConnectEnabled"),
  "BMID Box settings UI should edit tiktokConnectEnabled"
);

assert(
  settingsTab.includes("Mobile users will see this without a new app build."),
  "BMID Box settings UI should explain the no-rebuild runtime effect"
);

console.log("bmid-box-tiktok-connect-toggle: ok");
