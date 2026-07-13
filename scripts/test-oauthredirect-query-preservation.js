const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("app/oauthredirect/page.tsx", "utf8");

assert.match(
  source,
  /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/,
  "oauthredirect must be force-dynamic so TikTok code/state query params are not prerendered away"
);

assert.match(
  source,
  /projectv:\/\/oauthredirect\$\{params\.toString\(\)/,
  "oauthredirect must forward query params into the app deep link"
);

console.log("OAuth redirect query preservation checks passed.");
