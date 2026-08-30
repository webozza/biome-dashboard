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
    name: "portfolio is creator-selected, capped at six, and includes posts and vibes",
    pass:
      /where\("isHighlighted", "==", true\)/.test(resolver) &&
      /loadHighlightedVibes/.test(resolver) &&
      /\[\.\.\.highlightedPosts, \.\.\.highlightedVibes\]/.test(resolver) &&
      /\.slice\(0, 6\)/.test(resolver),
  },
  {
    name: "BMID Content and BMID Box remain separate from the creator portfolio",
    pass:
      /bmidContent: PublicPortfolioItem\[\]/.test(resolver) &&
      /bmidBox: PublicPortfolioItem\[\]/.test(resolver) &&
      /profile\.bmidContent\.length/.test(renderer) &&
      /profile\.bmidBox\.length/.test(renderer),
  },
  {
    name: "browser page includes verified identity and a branded coming-soon creator CTA",
    pass:
      /BMID Verified/.test(renderer) &&
      /Creator portfolio/.test(renderer) &&
      /Coming soon/.test(renderer) &&
      /Become a Creator/.test(renderer) &&
      /creator-modal/.test(renderer),
  },
  {
    name: "selected work is hidden at zero and store icons are self-contained",
    pass:
      /profile\.portfolio\.length \? `<section/.test(renderer) &&
      /APPLE_ICON/.test(renderer) &&
      /PLAY_ICON/.test(renderer),
  },
  {
    name: "unverified profiles receive professional verification guidance",
    pass:
      /verification-inactive/.test(resolver) &&
      /required social accounts are connected/.test(renderer) &&
      /resolvePublicBmidProfileResult/.test(route),
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
  {
    name: "public BMID content resolves engagement from linked post docs",
    pass:
      /loadPostEngagement/.test(resolver) &&
      /viewCount: publicCount/.test(resolver) &&
      /likesCount: publicCount/.test(resolver) &&
      /commentsCount: publicCount/.test(resolver) &&
      /item\.kind === "box"/.test(renderer) &&
      /Views/.test(renderer) &&
      /Likes/.test(renderer) &&
      /Comments/.test(renderer),
  },
  {
    name: "public BMID profile prefers real collection counts over stale zero counters",
    pass:
      /postsCount: number/.test(resolver) &&
      /followersCount: number/.test(resolver) &&
      /followingCount: number/.test(resolver) &&
      /loadPublicProfileStats/.test(resolver) &&
      /Math\.max\(directPosts \?\? 0, countedPosts\)/.test(resolver) &&
      /profile-stats/.test(renderer) &&
      /Followers/.test(renderer) &&
      /Following/.test(renderer),
  },
  {
    name: "connected social cards expose stored profile identity and remain linked",
    pass:
      /accountName\?: string/.test(resolver) &&
      /accountHandle\?: string/.test(resolver) &&
      /imageUrl\?: string/.test(resolver) &&
      /stats\?: PublicProfileSocialStat\[\]/.test(resolver) &&
      /connectionDisplayName/.test(resolver) &&
      /connection\.cachedAvatarUrl/.test(resolver) &&
      /subscriberCount/.test(resolver) &&
      /social-avatar/.test(renderer) &&
      /social-copy/.test(renderer) &&
      /social-stats/.test(renderer) &&
      /target="_blank"/.test(renderer),
  },
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Public BMID profile checks failed:");
  failed.forEach((check) => console.error(`- ${check.name}`));
  process.exit(1);
}

console.log(`Public BMID profile checks passed (${checks.length} checks).`);
