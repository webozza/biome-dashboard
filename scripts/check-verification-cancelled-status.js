/* global __dirname */
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

const files = {
  page: read("app/dashboard/verification/page.tsx"),
  route: read("app/api/verification/[id]/route.ts"),
  mockData: read("lib/data/mock-data.ts"),
  badge: read("components/ui/status-badge.tsx"),
};

const checks = [
  {
    name: "verification request type accepts cancellation requests",
    pass: /status: "pending" \| "approved" \| "rejected" \| "removed" \| "appealed" \| "cancelled" \| "cancel_requested";/.test(files.mockData),
  },
  {
    name: "verification filters include cancellation requests",
    pass:
      /\{ value: "cancel_requested", label: "Cancellation Requests" \}/.test(files.page) &&
      /\{ value: "cancelled", label: "Cancelled" \}/.test(files.page),
  },
  {
    name: "admin can approve cancellation requests by removing BMID",
    pass:
      /selected\.status === "cancel_requested"/.test(files.page) &&
      /Approve cancellation/.test(files.page) &&
      /handleStatusUpdate\("removed"\)/.test(files.page) &&
      /nextStatus === "removed"/.test(files.route) &&
      /revokeApprovedUserState\(fresh\.userId\)/.test(files.route),
  },
  {
    name: "cancel request statuses render with status badges",
    pass: /cancelled: GRAY/.test(files.badge) && /cancel_requested:/.test(files.badge),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Dashboard cancelled verification checks failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(`Dashboard cancelled verification checks passed (${checks.length} checks).`);
