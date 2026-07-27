/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "app/dashboard/profile/page.tsx"),
  "utf8"
);

function assertContains(needle, message) {
  assert(source.includes(needle), `${message}\nExpected to find: ${needle}`);
}

assertContains(
  "authProviderIds.includes(\"password\")",
  "Profile security must use Firebase auth providerData as the source of truth for password accounts."
);
assertContains(
  "authProviderIds.includes(\"google.com\")",
  "Profile security must detect Google-only accounts from Firebase providerData."
);
assertContains(
  "This account signs in with",
  "Google-only accounts must show a provider-specific security message instead of the password form."
);
assertContains(
  "Password changes are available only for email and password accounts.",
  "Social-only accounts must not show password reset controls that could add a password provider."
);
assertContains(
  "Current password",
  "Email/password accounts must keep the current password input."
);
assertContains(
  "New password",
  "Email/password accounts must keep the new password input."
);
assertContains(
  "Confirm new password",
  "Email/password accounts must keep the confirm password input."
);

console.log("Profile security provider flow checks passed.");
