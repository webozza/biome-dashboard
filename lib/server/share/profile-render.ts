import type {
  PublicBmidUnavailableReason,
  PublicPortfolioItem,
  PublicProfileSocial,
  ResolvedPublicBmidProfile,
} from "./profile";
import { env, escapeHtml, makeAbsoluteUrl } from "./utils";

const ANDROID_STORE = "https://play.google.com/store/apps/details?id=com.webozza.projectv";
const IOS_STORE = "https://apps.apple.com/us/app/biome-aura/id6751843622";
const APPLE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.5c1.21.07 2.05.66 2.76.71 1.07-.22 2.09-.85 3.23-.77 1.37.11 2.4.65 3.08 1.62-2.82 1.69-2.15 5.41.44 6.45-.52 1.36-1.2 2.71-2.19 3.71.01.03.35.68.68 1.06ZM12.03 7.25c-.15-2.02 1.5-3.69 3.37-3.85.26 2.34-2.12 4.08-3.37 3.85Z"/></svg>`;
const PLAY_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#34a853" d="M3 2.5v19l10.7-9.5L3 2.5Z"/><path fill="#fbbc04" d="m13.7 12 3.2-2.8 3.8 2.2c.8.5.8 1.2 0 1.7l-3.8 2.2-3.2-3.3Z"/><path fill="#4285f4" d="M3 2.5 16.9 9.2 13.7 12 3 2.5Z"/><path fill="#ea4335" d="m3 21.5 10.7-9.5 3.2 3.3L3 21.5Z"/></svg>`;

function formatMemberSince(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "BA";
}

function socialIcon(platform: PublicProfileSocial["platform"]): string {
  if (platform === "instagram") return "◎";
  if (platform === "tiktok") return "♪";
  if (platform === "youtube") return "▶";
  if (platform === "facebook") return "f";
  return "X";
}

function socialHtml(social: PublicProfileSocial): string {
  return `<a class="social-link social-${escapeHtml(social.platform)}" href="${escapeHtml(social.url)}" target="_blank" rel="noopener noreferrer">
    <span class="social-icon" aria-hidden="true">${socialIcon(social.platform)}</span>
    <span>${escapeHtml(social.label)}</span>
    <span class="arrow" aria-hidden="true">↗</span>
  </a>`;
}

function formatCount(value?: number): string {
  const count = Number.isFinite(value ?? NaN) ? Math.max(0, Math.floor(value as number)) : 0;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(count >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(count >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(count);
}

function portfolioMetaHtml(item: PublicPortfolioItem): string {
  if (item.kind !== "post" && item.kind !== "vibe") return "";
  return `<div class="work-meta" aria-label="Post engagement">
      <span class="work-stat"><strong>${formatCount(item.viewCount)}</strong> Views</span>
      <span class="work-stat"><strong>${formatCount(item.likesCount)}</strong> Likes</span>
      <span class="work-stat"><strong>${formatCount(item.commentsCount)}</strong> Comments</span>
    </div>`;
}

function portfolioHtml(item: PublicPortfolioItem, pageUrl: string): string {
  const href = item.href ? makeAbsoluteUrl(item.href, new URL(pageUrl).origin) : "";
  const media = item.imageUrl
    ? `<img src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy" onerror="this.closest('.work-media').classList.add('image-error');this.remove()"/>`
    : "";
  const content = `<div class="work-media ${item.imageUrl ? "" : "image-error"}">
      ${media}
      <div class="work-fallback" aria-hidden="true"><span>B</span></div>
      <span class="work-kind">${escapeHtml(item.eyebrow)}</span>
    </div>
    <div class="work-copy">
      <h3>${escapeHtml(item.title)}</h3>
      ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
      ${portfolioMetaHtml(item)}
      ${href ? `<span class="work-view">View work <span aria-hidden="true">↗</span></span>` : ""}
    </div>`;
  return href
    ? `<a class="work-card" href="${escapeHtml(href)}" ${/^https?:\/\//i.test(item.href) ? `target="_blank" rel="noopener noreferrer"` : ""}>${content}</a>`
    : `<article class="work-card">${content}</article>`;
}

export function renderPublicBmidProfile(args: {
  profile: ResolvedPublicBmidProfile;
  pageUrl: string;
}): string {
  const { profile, pageUrl } = args;
  const appName = env("APP_NAME", "Biome Aura");
  const memberSince = formatMemberSince(profile.bmidVerifiedAt);
  const title = `${profile.displayName} — Verified BMID Creator | ${appName}`;
  const description = profile.bio
    ? `${profile.displayName} is a BMID Verified creator on ${appName}. ${profile.bio}`.slice(0, 260)
    : `View ${profile.displayName}'s verified BMID creator profile and public portfolio on ${appName}.`;
  const canonical = escapeHtml(pageUrl);
  const ogImage = escapeHtml(`${pageUrl.replace(/\/$/, "")}/og`);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeName = escapeHtml(profile.displayName);
  const safeBmid = escapeHtml(profile.bmidNumber);
  const safePhoto = escapeHtml(profile.photoUrl);
  const deepLink = `biomeaura://bmid/${encodeURIComponent(profile.bmidNumber)}`;
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.displayName,
    description: profile.bio || undefined,
    image: profile.photoUrl || undefined,
    identifier: profile.bmidNumber,
    url: pageUrl,
    sameAs: profile.socials.map((social) => social.url),
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}"/>
  <meta name="theme-color" content="#76ac51"/>
  <link rel="canonical" href="${canonical}"/>
  <link rel="icon" href="/icon.png"/>
  <meta property="og:type" content="profile"/>
  <meta property="og:title" content="${safeTitle}"/>
  <meta property="og:description" content="${safeDescription}"/>
  <meta property="og:url" content="${canonical}"/>
  <meta property="og:site_name" content="${escapeHtml(appName)}"/>
  <meta property="og:image" content="${ogImage}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${safeTitle}"/>
  <meta name="twitter:description" content="${safeDescription}"/>
  <meta name="twitter:image" content="${ogImage}"/>
  <meta name="apple-itunes-app" content="app-id=6751843622, app-argument=${escapeHtml(deepLink)}"/>
  <script type="application/ld+json">${schema}</script>
  <style>
    *{box-sizing:border-box}
    :root{--green:#76ac51;--green-dark:#3f6c32;--green-deep:#203c23;--mint:#eef7e9;--ink:#172018;--soft:#677168;--line:rgba(47,75,43,.13);--cream:#f8faf5;--white:#fff;--shadow:0 28px 80px rgba(38,67,32,.14)}
    html{scroll-behavior:smooth;background:var(--cream)}
    body{margin:0;color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(900px 520px at 5% -5%,rgba(118,172,81,.20),transparent 62%),radial-gradient(800px 500px at 100% 8%,rgba(193,221,178,.42),transparent 58%),var(--cream);min-height:100vh}
    a{color:inherit}
    .shell{width:min(1180px,calc(100% - 40px));margin:0 auto}
    .nav{height:88px;display:flex;align-items:center;justify-content:space-between;gap:24px}
    .brand{display:flex;align-items:center;gap:12px;text-decoration:none;font-weight:850;letter-spacing:-.03em;font-size:20px}
    .brand img{width:42px;height:42px;border-radius:13px;box-shadow:0 10px 25px rgba(53,91,45,.18)}
    .nav-label{font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:#6a756b;font-weight:800}
    .open-app{border:1px solid rgba(50,87,43,.16);background:rgba(255,255,255,.74);backdrop-filter:blur(18px);padding:11px 16px;border-radius:999px;text-decoration:none;font-size:13px;font-weight:800;display:flex;align-items:center;gap:8px;box-shadow:0 10px 28px rgba(54,82,48,.08)}
    .open-app::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 5px rgba(118,172,81,.13)}
    .hero{position:relative;overflow:hidden;border-radius:38px;background:linear-gradient(135deg,#233d27 0%,#426f35 53%,#8dbc6e 100%);color:white;min-height:550px;box-shadow:var(--shadow);isolation:isolate}
    .hero::before{content:"";position:absolute;width:520px;height:520px;border-radius:50%;right:-120px;top:-210px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.14)}
    .hero::after{content:"B";position:absolute;right:42px;bottom:-162px;font-size:510px;line-height:1;font-weight:900;letter-spacing:-.13em;color:rgba(255,255,255,.055);z-index:-1}
    .hero-grid{min-height:550px;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(310px,.85fr);align-items:center;gap:54px;padding:64px clamp(28px,6vw,76px)}
    .verified{display:inline-flex;align-items:center;gap:9px;padding:8px 13px;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.12);border-radius:999px;font-size:12px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;backdrop-filter:blur(14px)}
    .verified svg{width:17px;height:17px}
    h1{font-size:clamp(44px,7vw,84px);line-height:.96;letter-spacing:-.065em;margin:24px 0 18px;max-width:720px}
    .handle{font-size:16px;color:rgba(255,255,255,.72);font-weight:650;margin:-8px 0 18px}
    .bio{font-size:clamp(16px,2vw,20px);line-height:1.65;color:rgba(255,255,255,.82);max-width:650px;margin:0}
    .identity{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}
    .identity-pill{display:flex;align-items:center;gap:8px;background:rgba(14,29,17,.24);border:1px solid rgba(255,255,255,.17);border-radius:15px;padding:11px 14px;font-size:13px;color:rgba(255,255,255,.76)}
    .identity-pill strong{color:#fff;letter-spacing:.035em}
    .portrait-wrap{position:relative;display:flex;justify-content:center;align-items:center;min-height:390px}
    .portrait-ring{position:absolute;width:min(390px,100%);aspect-ratio:1;border:1px solid rgba(255,255,255,.19);border-radius:50%;box-shadow:inset 0 0 0 30px rgba(255,255,255,.03)}
    .portrait{position:relative;width:min(310px,82%);aspect-ratio:1;border-radius:42% 42% 48% 48%;overflow:hidden;background:linear-gradient(145deg,#d9ebcc,#9ac27c);border:8px solid rgba(255,255,255,.16);box-shadow:0 36px 90px rgba(8,24,10,.34)}
    .portrait img{width:100%;height:100%;object-fit:cover;display:block}
    .initials{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:90px;font-weight:900;letter-spacing:-.08em;color:#274628}
    .portrait-badge{position:absolute;right:7%;bottom:9%;background:white;color:#315d2d;border-radius:18px;padding:11px 14px;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:850;box-shadow:0 18px 45px rgba(9,31,12,.28)}
    .section{padding:86px 0 0}
    .section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:30px;margin-bottom:28px}
    .kicker{color:var(--green-dark);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.15em;margin-bottom:10px}
    h2{font-size:clamp(30px,4vw,48px);line-height:1.05;letter-spacing:-.045em;margin:0}
    .section-note{max-width:470px;color:var(--soft);line-height:1.65;margin:0}
    .tags{display:flex;flex-wrap:wrap;gap:9px;margin-top:21px}
    .tag{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.10);border-radius:999px;padding:8px 12px;font-size:12px;font-weight:750;color:rgba(255,255,255,.87)}
    .social-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
    .social-link{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.76);backdrop-filter:blur(15px);border:1px solid var(--line);border-radius:18px;padding:17px;text-decoration:none;font-weight:800;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
    .social-link:hover{transform:translateY(-3px);box-shadow:0 18px 40px rgba(47,79,41,.11);border-color:rgba(76,126,62,.27)}
    .social-icon{width:36px;height:36px;border-radius:12px;background:var(--mint);display:grid;place-items:center;color:var(--green-dark);font-weight:900}
    .social-youtube .social-icon{color:#d93434;background:#fff0f0}.social-facebook .social-icon{color:#2869bd;background:#edf5ff}.social-instagram .social-icon{color:#bb3c76;background:#fff0f6}.social-tiktok .social-icon{color:#161616;background:#f1f1f1}
    .arrow{margin-left:auto;color:#89928a}
    .work-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
    .work-card{min-width:0;display:flex;flex-direction:column;text-decoration:none;background:rgba(255,255,255,.82);border:1px solid var(--line);border-radius:24px;overflow:hidden;box-shadow:0 14px 42px rgba(44,72,39,.07);transition:transform .2s ease,box-shadow .2s ease}
    .work-card:hover{transform:translateY(-5px);box-shadow:0 24px 60px rgba(44,72,39,.14)}
    .work-media{height:235px;background:linear-gradient(135deg,#e8f2df,#b8d59f);position:relative;overflow:hidden}
    .work-media img{width:100%;height:100%;display:block;object-fit:cover;transition:transform .35s ease}
    .work-card:hover .work-media img{transform:scale(1.035)}
    .work-media::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,rgba(9,24,12,.40))}
    .work-fallback{display:none;position:absolute;inset:0;place-items:center;color:rgba(45,80,40,.16);font-size:180px;font-weight:950;letter-spacing:-.15em}
    .work-media.image-error .work-fallback{display:grid}
    .work-kind{position:absolute;z-index:2;left:16px;bottom:15px;padding:7px 10px;border-radius:999px;background:rgba(21,39,23,.72);backdrop-filter:blur(12px);color:#fff;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.1em}
    .work-copy{padding:20px;display:flex;flex-direction:column;flex:1}
    .work-copy h3{font-size:20px;line-height:1.25;letter-spacing:-.025em;margin:0}
    .work-copy p{font-size:13px;line-height:1.6;color:var(--soft);margin:10px 0 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    .work-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
    .work-stat{display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(63,108,50,.13);background:rgba(238,247,233,.78);border-radius:999px;padding:7px 9px;color:#667268;font-size:11px;font-weight:800;line-height:1}
    .work-stat strong{color:var(--green-dark);font-weight:950}
    .work-view{font-size:12px;font-weight:850;color:var(--green-dark);margin-top:auto;padding-top:18px}
    .verification-section{padding-top:72px}
    .verification-section .kicker{display:inline-flex;align-items:center;gap:8px}.verification-section .kicker::before{content:"✓";width:22px;height:22px;display:grid;place-items:center;border-radius:8px;background:var(--mint);font-size:11px}
    .coming{margin-top:92px;border-radius:38px;background:#172c1b;color:white;overflow:hidden;position:relative;box-shadow:var(--shadow)}
    .coming::before{content:"";position:absolute;inset:-30%;background:radial-gradient(circle at 76% 22%,rgba(151,208,112,.28),transparent 28%),radial-gradient(circle at 5% 95%,rgba(118,172,81,.22),transparent 25%);pointer-events:none}
    .coming-grid{position:relative;display:grid;grid-template-columns:1.1fr .9fr;gap:60px;padding:clamp(42px,7vw,78px)}
    .soon{display:inline-flex;align-items:center;gap:8px;width:max-content;padding:8px 12px;border-radius:999px;background:#c9f0a9;color:#20391f;font-size:11px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}
    .soon::before{content:"";width:7px;height:7px;border-radius:50%;background:#5d9e3f}
    .coming h2{font-size:clamp(38px,5vw,64px);margin:22px 0 20px;max-width:650px}
    .coming-copy{font-size:17px;line-height:1.7;color:rgba(255,255,255,.72);max-width:620px;margin:0}
    .benefits{display:grid;gap:11px;align-content:center}
    .benefit{display:flex;align-items:center;gap:13px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.055);border-radius:16px;padding:14px 16px;color:rgba(255,255,255,.86);font-size:13px;font-weight:700}
    .benefit-mark{width:26px;height:26px;border-radius:9px;display:grid;place-items:center;background:rgba(183,229,148,.16);color:#c9f0a9;font-weight:900;flex:0 0 auto}
    .soon-action{margin-top:28px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
    .creator-cta{appearance:none;cursor:pointer;display:inline-flex;align-items:center;gap:11px;padding:15px 20px;border-radius:15px;background:#c9f0a9;border:1px solid rgba(255,255,255,.14);box-shadow:0 12px 32px rgba(0,0,0,.18);font:inherit;font-size:14px;font-weight:900;color:#20391f;transition:transform .18s ease,box-shadow .18s ease}
    .creator-cta:hover{transform:translateY(-2px);box-shadow:0 18px 38px rgba(0,0,0,.24)}
    .store-block{padding:42px clamp(28px,6vw,68px);display:flex;align-items:center;justify-content:space-between;gap:28px;background:white;border:1px solid var(--line);border-radius:28px;margin-top:20px}
    .store-copy h3{font-size:24px;letter-spacing:-.035em;margin:0 0 6px}.store-copy p{margin:0;color:var(--soft);font-size:14px}
    .stores{display:flex;gap:10px;flex-wrap:wrap}
    .store{display:flex;align-items:center;gap:10px;padding:12px 15px;border-radius:14px;background:var(--ink);color:#fff;text-decoration:none;font-weight:800;font-size:13px;white-space:nowrap}
    .store-icon{width:25px;height:25px;display:grid;place-items:center;flex:0 0 auto}.store-icon svg{width:100%;height:100%;display:block}
    .store small{display:block;font-size:9px;letter-spacing:.05em;text-transform:uppercase;color:rgba(255,255,255,.62);font-weight:650}.store span{line-height:1.15}
    .modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:22px;background:rgba(10,22,12,.62);backdrop-filter:blur(13px);opacity:0;visibility:hidden;transition:opacity .2s ease,visibility .2s ease}
    .modal-backdrop.open{opacity:1;visibility:visible}.modal-card{position:relative;width:min(450px,100%);padding:42px;border-radius:30px;background:linear-gradient(145deg,#fff,#f2f8ee);color:var(--ink);box-shadow:0 34px 100px rgba(0,0,0,.32);transform:translateY(12px) scale(.98);transition:transform .2s ease}.modal-backdrop.open .modal-card{transform:none}
    .modal-mark{width:58px;height:58px;border-radius:19px;display:grid;place-items:center;background:var(--green-deep);color:#c9f0a9;font-size:25px;font-weight:900}.modal-card h2{font-size:38px;margin:24px 0 12px}.modal-card p{margin:0;color:var(--soft);line-height:1.7}.modal-close{position:absolute;top:18px;right:18px;width:38px;height:38px;border:0;border-radius:50%;background:#e9f2e4;color:#29482a;font-size:22px;cursor:pointer}
    footer{padding:38px 0 44px;color:#778078;font-size:12px;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
    @media(max-width:880px){.hero-grid{grid-template-columns:1fr;padding-top:50px}.portrait-wrap{grid-row:1;min-height:310px}.portrait{width:250px}.portrait-ring{width:310px}.work-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.coming-grid{grid-template-columns:1fr}.section-head{align-items:flex-start;flex-direction:column}.store-block{align-items:flex-start;flex-direction:column}}
    @media(max-width:580px){.shell{width:min(100% - 24px,1180px)}.nav{height:72px}.nav-label{display:none}.open-app{padding:10px 12px}.hero{border-radius:26px}.hero-grid{padding:36px 22px 42px;gap:24px}.portrait-wrap{min-height:245px}.portrait{width:205px;border-radius:40px}.portrait-ring{width:245px}.portrait-badge{right:2%;bottom:3%}h1{font-size:46px}.bio{font-size:15px}.section{padding-top:62px}.work-grid{grid-template-columns:1fr}.work-media{height:255px}.coming{border-radius:26px;margin-top:68px}.coming-grid{padding:38px 24px;gap:35px}.store-block{padding:30px 24px}.stores{width:100%}.store{flex:1;justify-content:center}.hero::after{font-size:380px;right:-10px}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.social-link,.work-card,.work-media img,.creator-cta,.modal-backdrop,.modal-card{transition:none}}
  </style>
</head>
<body>
  <div class="shell">
    <nav class="nav" aria-label="Biome Aura">
      <a class="brand" href="https://www.biome-aura.com" rel="noopener">
        <img src="/icon.png" alt=""/><span>${escapeHtml(appName)}</span>
      </a>
      <span class="nav-label">Public BMID Profile</span>
      <a class="open-app" id="open-app" href="${escapeHtml(deepLink)}">Open in app</a>
    </nav>

    <main>
      <section class="hero">
        <div class="hero-grid">
          <div>
            <span class="verified">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.3 3.3 12 2l2.7 1.3 3-.1 1.6 2.5 2.5 1.6-.1 3L23 13l-1.3 2.7.1 3-2.5 1.6-1.6 2.5-3-.1L12 24l-2.7-1.3-3 .1-1.6-2.5-2.5-1.6.1-3L1 13l1.3-2.7-.1-3 2.5-1.6 1.6-2.5 3 .1Z" fill="#c9f0a9"/><path d="m8 12.2 2.5 2.4 5.5-5.4" stroke="#254625" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              BMID Verified
            </span>
            <h1>${safeName}</h1>
            ${profile.username ? `<p class="handle">@${escapeHtml(profile.username)}</p>` : ""}
            ${profile.bio ? `<p class="bio">${escapeHtml(profile.bio)}</p>` : `<p class="bio">A verified creator building a trusted digital identity with ${escapeHtml(appName)}.</p>`}
            ${profile.tags.length ? `<div class="tags">${profile.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
            <div class="identity">
              <span class="identity-pill">BMID <strong>${safeBmid}</strong></span>
              <span class="identity-pill">Status <strong>Verified</strong></span>
              ${memberSince ? `<span class="identity-pill">Member since <strong>${escapeHtml(memberSince)}</strong></span>` : ""}
            </div>
          </div>
          <div class="portrait-wrap">
            <div class="portrait-ring"></div>
            <div class="portrait">
              ${safePhoto ? `<img src="${safePhoto}" alt="${safeName}" onerror="this.remove();this.nextElementSibling.style.display='flex'"/><div class="initials" style="display:none">${escapeHtml(initials(profile.displayName))}</div>` : `<div class="initials">${escapeHtml(initials(profile.displayName))}</div>`}
            </div>
            <div class="portrait-badge"><span aria-hidden="true">✓</span> Identity verified</div>
          </div>
        </div>
      </section>

      ${profile.socials.length ? `<section class="section" aria-labelledby="social-title">
        <div class="section-head"><div><div class="kicker">Connected presence</div><h2 id="social-title">Find ${safeName} online</h2></div><p class="section-note">Public creator accounts connected to this verified BMID identity.</p></div>
        <div class="social-grid">${profile.socials.map(socialHtml).join("")}</div>
      </section>` : ""}

      ${profile.portfolio.length ? `<section class="section" aria-labelledby="work-title">
        <div class="section-head"><div><div class="kicker">Creator portfolio</div><h2 id="work-title">Selected work</h2></div><p class="section-note">Featured and BMID-approved work presented as part of this creator's public profile.</p></div>
        <div class="work-grid">${profile.portfolio.map((item) => portfolioHtml(item, pageUrl)).join("")}</div>
      </section>` : ""}

      ${profile.bmidContent.length ? `<section class="section verification-section" aria-labelledby="content-title">
        <div class="section-head"><div><div class="kicker">BMID verified ecosystem</div><h2 id="content-title">BMID Content</h2></div><p class="section-note">Content reviewed through Biome Aura's creator verification ecosystem, shown separately from the creator-selected portfolio.</p></div>
        <div class="work-grid">${profile.bmidContent.map((item) => portfolioHtml(item, pageUrl)).join("")}</div>
      </section>` : ""}

      ${profile.bmidBox.length ? `<section class="section verification-section" aria-labelledby="box-title">
        <div class="section-head"><div><div class="kicker">Connected verification</div><h2 id="box-title">BMID Box</h2></div><p class="section-note">Approved work connected from outside Biome Aura while retaining its own verification context.</p></div>
        <div class="work-grid">${profile.bmidBox.map((item) => portfolioHtml(item, pageUrl)).join("")}</div>
      </section>` : ""}

      <section class="coming" aria-labelledby="coming-title">
        <div class="coming-grid">
          <div>
            <span class="soon">Coming soon</span>
            <h2 id="coming-title">Turn your creator identity into opportunity.</h2>
            <p class="coming-copy">The Biome creator and brand marketplace is taking shape—a trusted space for credible partnerships, discovery, and future campaigns.</p>
            <div class="soon-action"><button class="creator-cta" id="creator-cta" type="button">Become a Creator <span aria-hidden="true">→</span></button></div>
          </div>
          <div class="benefits" aria-label="Planned creator marketplace benefits">
            <div class="benefit"><span class="benefit-mark">✓</span>One trusted creator identity</div>
            <div class="benefit"><span class="benefit-mark">✓</span>Connected social presence</div>
            <div class="benefit"><span class="benefit-mark">✓</span>A credible creator portfolio</div>
            <div class="benefit"><span class="benefit-mark">✓</span>Future brand and campaign opportunities</div>
          </div>
        </div>
      </section>

      <section class="store-block" aria-label="Download Biome Aura">
        <div class="store-copy"><h3>Biome Aura is available now</h3><p>Explore the community and manage your BMID identity in the app.</p></div>
        <div class="stores">
          <a class="store" href="${escapeHtml(IOS_STORE)}" target="_blank" rel="noopener"><span class="store-icon">${APPLE_ICON}</span><span><small>Download on the</small>App Store</span></a>
          <a class="store" href="${escapeHtml(ANDROID_STORE)}" target="_blank" rel="noopener"><span class="store-icon">${PLAY_ICON}</span><span><small>Get it on</small>Google Play</span></a>
        </div>
      </section>
    </main>

    <footer><span>© ${new Date().getFullYear()} ${escapeHtml(appName)}. Trusted creator identity.</span><span>${safeBmid} · BMID Verified</span></footer>
  </div>
  <div class="modal-backdrop" id="creator-modal" aria-hidden="true">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="creator-modal-title">
      <button class="modal-close" id="creator-modal-close" type="button" aria-label="Close">×</button>
      <div class="modal-mark" aria-hidden="true">B</div>
      <h2 id="creator-modal-title">Coming soon</h2>
      <p>Creator onboarding and marketplace access are not open just yet. Biome Aura is building the experience carefully, and this profile will be ready when applications launch.</p>
    </div>
  </div>
  <script>
    (function(){
      var button=document.getElementById('open-app');
      if(button)button.addEventListener('click',function(event){
        var ua=navigator.userAgent||'';
        if(!/Android|iPhone|iPad|iPod/i.test(ua))return;
        event.preventDefault();
        var hidden=false;
        var onVisibility=function(){if(document.hidden)hidden=true};
        document.addEventListener('visibilitychange',onVisibility,{once:true});
        window.location.href=${JSON.stringify(deepLink)};
        setTimeout(function(){if(!hidden)window.location.href=/iPhone|iPad|iPod/i.test(ua)?${JSON.stringify(IOS_STORE)}:${JSON.stringify(ANDROID_STORE)}},1400);
      });
      var creatorButton=document.getElementById('creator-cta');
      var modal=document.getElementById('creator-modal');
      var closeButton=document.getElementById('creator-modal-close');
      function setModal(open){if(!modal)return;modal.classList.toggle('open',open);modal.setAttribute('aria-hidden',open?'false':'true');if(open&&closeButton)closeButton.focus()}
      if(creatorButton)creatorButton.addEventListener('click',function(){setModal(true)});
      if(closeButton)closeButton.addEventListener('click',function(){setModal(false);if(creatorButton)creatorButton.focus()});
      if(modal)modal.addEventListener('click',function(event){if(event.target===modal)setModal(false)});
      document.addEventListener('keydown',function(event){if(event.key==='Escape')setModal(false)});
    })();
  </script>
</body>
</html>`;
}

export function renderUnavailableBmidProfile(reason: PublicBmidUnavailableReason): string {
  const verificationInactive = reason === "verification-inactive";
  const title = verificationInactive ? "Verification not active" : "Profile unavailable";
  const copy = verificationInactive
    ? "This creator's public BMID profile is not active yet. Once the required social accounts are connected and verification is complete, their verified profile can be published here."
    : "We couldn't find an active public BMID profile at this address. It may have moved, been deactivated, or is no longer publicly available.";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex"/><meta name="theme-color" content="#76ac51"/><title>${escapeHtml(title)} | Biome Aura</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at top,#e4f1da,#f8faf5 55%);font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172018}.card{width:min(550px,100%);background:rgba(255,255,255,.9);border:1px solid rgba(50,88,43,.13);border-radius:30px;padding:46px;text-align:center;box-shadow:0 28px 80px rgba(38,67,32,.14)}img{width:66px;height:66px;border-radius:20px}.label{display:inline-block;margin-top:24px;padding:7px 11px;border-radius:999px;background:#edf6e8;color:#4f7c3f;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}h1{font-size:38px;letter-spacing:-.05em;margin:17px 0 10px}p{color:#687269;line-height:1.7;margin:0}a{display:inline-flex;margin-top:26px;padding:13px 17px;border-radius:14px;background:#315e2e;color:white;text-decoration:none;font-size:13px;font-weight:800}</style></head><body><main class="card"><img src="/icon.png" alt=""/><br/><span class="label">Biome Aura · BMID</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(copy)}</p><a href="https://www.biome-aura.com">Explore Biome Aura</a></main></body></html>`;
}
