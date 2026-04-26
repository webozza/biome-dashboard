import { env, escapeHtml } from "./utils";
import type { ShareComment } from "./posts";

interface RenderArgs {
  pageUrl: string;
  userName?: string;
  description?: string;
  image?: string;
  ogImage?: string;
  videoUrl?: string;
  videoThumbImage?: string;
  ogVideoThumbImage?: string;
  postId?: string;
  reelId?: string;
  authorId?: string;
  likesCount?: number;
  commentsCount?: number;
  commentsList?: ShareComment[];
  imageURLs?: string[];
}

function buildCommentHTML(c: ShareComment): string {
  const name = escapeHtml(String(c.authorName || "User"));
  const photo = escapeHtml(String(c.authorPhotoURL || ""));
  const text = escapeHtml(String(c.text || ""));
  const initial = (name.replace(/&amp;|&lt;|&gt;|&quot;|&#039;/g, "").charAt(0) || "U").toUpperCase();

  let timeStr = "";
  if (c.createdAt) {
    try {
      const ts = c.createdAt as { _seconds?: number } | string | number | Date;
      const ms =
        typeof ts === "object" && ts && "_seconds" in ts && typeof ts._seconds === "number"
          ? ts._seconds * 1000
          : new Date(ts as string | number | Date).getTime();
      timeStr = new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {}
  }

  return `<div class="comment-item">
    ${photo
      ? `<img class="comment-avatar" src="${photo}" alt="" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
         <div class="comment-avatar-init" style="display:none">${initial}</div>`
      : `<div class="comment-avatar-init">${initial}</div>`}
    <div class="comment-body">
      <span class="comment-author">${name}</span>
      <span class="comment-text">${text}</span>
      ${timeStr ? `<span class="comment-time">${timeStr}</span>` : ""}
    </div>
  </div>`;
}

export function renderOgPage(args: RenderArgs): string {
  const {
    pageUrl,
    userName,
    description,
    image = "",
    ogImage = "",
    videoUrl = "",
    videoThumbImage = "",
    ogVideoThumbImage = "",
    postId = "",
    reelId = "",
    authorId = "",
    likesCount = 0,
    commentsCount = 0,
    commentsList = [],
    imageURLs = [],
  } = args;

  const APP_NAME = env("APP_NAME", "Biome Aura");
  const AUTHOR_URL = env("AUTHOR_URL", "https://app.biome-aura.com");
  const androidStore = "https://play.google.com/store/apps/details?id=com.webozza.projectv";
  const iosStore = "https://apps.apple.com/us/app/biome-aura/id6751843622";
  const iosAppId = (iosStore.match(/\/id(\d+)/) || [])[1] || "";
  const iosBadge = "https://beepbeep.sg/apple-store-button.svg";
  const androidBadge = "https://beepbeep.sg/google-play-store-button.svg";
  const logoUrl = "/images/logo.png";

  const resolvedUser = userName || "Biome Aura User";
  const ogTitle = `${resolvedUser} on ${APP_NAME}`;

  const safeTitle = escapeHtml(ogTitle);
  const safeUser = escapeHtml(resolvedUser);
  const safeDesc = escapeHtml(description || "");
  const safeUrl = escapeHtml(pageUrl);
  const safeOgImage = escapeHtml(ogVideoThumbImage || ogImage || image || "");
  const safeImage = escapeHtml(image || videoThumbImage || "");
  const safeVideoThumb = escapeHtml(videoThumbImage || image || "");
  const safeVideo = escapeHtml(videoUrl || "");
  const hasVideo = Boolean(safeVideo);
  const ogType = hasVideo ? "video.other" : "article";
  const isImagePost = !hasVideo && Boolean(safeImage);

  const appScheme = env("APP_SCHEME", "");
  const deepLink =
    appScheme && authorId && (postId || reelId)
      ? reelId
        ? `${appScheme}://r/${encodeURIComponent(authorId)}/${encodeURIComponent(reelId)}`
        : `${appScheme}://p/${encodeURIComponent(authorId)}/${encodeURIComponent(postId)}`
      : "";
  const safeDeepLink = escapeHtml(deepLink);
  const safeIosStore = escapeHtml(iosStore);
  const safeAndroidStore = escapeHtml(androidStore);
  const safeLogo = escapeHtml(logoUrl);
  const safeIosBadge = escapeHtml(iosBadge);
  const safeAndroidBadge = escapeHtml(androidBadge);

  const gallery = imageURLs.length > 0 ? imageURLs : safeImage ? [safeImage] : [];
  const galleryJS = gallery.map((u) => JSON.stringify(String(u))).join(",");

  const commentsHtml = commentsList.length > 0
    ? commentsList.slice(0, 3).map(buildCommentHTML).join("\n")
    : "";

  const dotColor = hasVideo ? "#b1ff01" : "rgba(255,255,255,.45)";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  ${iosAppId && deepLink
    ? `<meta name="apple-itunes-app" content="app-id=${iosAppId}, app-argument=${safeDeepLink}"/>`
    : iosAppId
      ? `<meta name="apple-itunes-app" content="app-id=${iosAppId}"/>`
      : ""}
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}"/>
  <meta name="author" content="${escapeHtml(AUTHOR_URL)}"/>

  <meta property="og:type"        content="${ogType}"/>
  <meta property="og:title"       content="${safeTitle}"/>
  <meta property="og:description" content="${safeDesc}"/>
  <meta property="og:url"         content="${safeUrl}"/>
  <meta property="og:site_name"   content="${escapeHtml(APP_NAME)}"/>
  ${safeOgImage ? `
  <meta property="og:image"        content="${safeOgImage}"/>
  <meta property="og:image:width"  content="1200"/>
  <meta property="og:image:height" content="630"/>` : ""}
  ${hasVideo ? `
  <meta property="og:video"        content="${safeVideo}"/>
  <meta property="og:video:type"   content="video/mp4"/>
  <meta property="og:video:width"  content="1200"/>
  <meta property="og:video:height" content="630"/>` : ""}

  <meta name="twitter:card"        content="summary_large_image"/>
  <meta name="twitter:title"       content="${safeTitle}"/>
  <meta name="twitter:description" content="${safeDesc}"/>
  ${safeOgImage ? `<meta name="twitter:image" content="${safeOgImage}"/>` : ""}

  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    :root{--bg:#0b0b0f;--border:rgba(255,255,255,.10);--muted:rgba(255,255,255,.70);--muted2:rgba(255,255,255,.58);--accent:#b1ff01;--radius:18px}
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:radial-gradient(1100px 600px at 50% -10%, rgba(177,255,1,.10), transparent 55%),radial-gradient(900px 500px at 10% 20%, rgba(102,102,255,.10), transparent 55%),var(--bg);color:#fff;min-height:100vh;display:flex;justify-content:center;padding:24px}
    .wrap{width:100%;max-width:640px}
    .card{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.45);backdrop-filter:blur(8px)}
    .head{display:flex;align-items:center;gap:12px;padding:16px 16px 12px}
    .logo{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);overflow:hidden;flex:0 0 auto;display:flex;align-items:center;justify-content:center}
    .logo img{width:100%;height:100%;object-fit:cover;display:block}
    .headText{min-width:0;display:flex;flex-direction:column;gap:2px}
    .app{font-weight:800;letter-spacing:.2px;font-size:14px;line-height:1.1;opacity:.96}
    .domain{font-size:12px;color:var(--muted2);display:flex;align-items:center;gap:6px;min-width:0}
    .dot{width:7px;height:7px;border-radius:50%;background:${dotColor};flex-shrink:0}
    .pill{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);font-size:12px;color:rgba(255,255,255,.80);margin-left:auto;flex:0 0 auto;white-space:nowrap}
    .skeleton{background:linear-gradient(90deg,#161621 25%,#222230 50%,#161621 75%);background-size:200% 100%;animation:skel 1.5s infinite}
    @keyframes skel{0%{background-position:200% 0}100%{background-position:-200% 0}}
    .media{position:relative;width:100%;overflow:hidden;background:#0f0f19;cursor:zoom-in;min-height:220px}
    .media img{width:100%;display:block;user-select:none;-webkit-user-drag:none;object-fit:contain;object-position:50% 50%;max-height:520px;background:#0f0f19}
    .media::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 55%,rgba(0,0,0,.28) 100%);pointer-events:none}
    .zoom-hint{position:absolute;bottom:10px;right:10px;z-index:3;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:4px 9px;font-size:11px;color:rgba(255,255,255,.70);display:flex;align-items:center;gap:5px;pointer-events:none}
    #zoom-overlay{display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.94);align-items:center;justify-content:center;touch-action:none;overflow:hidden}
    #zoom-overlay.open{display:flex}
    #zoom-img{display:block;max-width:100vw;max-height:calc(100vh - 60px);object-fit:contain;transform-origin:center center;will-change:transform;user-select:none;-webkit-user-drag:none;pointer-events:auto;cursor:zoom-in;transform:scale(1) translate(0,0);transition:transform .2s ease}
    #zoom-close{position:fixed;top:14px;right:14px;z-index:10000;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.20);color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}
    #zoom-bar{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:10000;display:flex;align-items:center;gap:4px;background:rgba(0,0,0,.60);border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:5px 10px;white-space:nowrap}
    .zbtn{background:none;border:none;color:#fff;font-size:20px;line-height:1;cursor:pointer;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;opacity:.80;flex-shrink:0}
    .zbtn:hover{opacity:1;background:rgba(255,255,255,.12)}
    .zbtn:disabled{opacity:.30;cursor:default}
    #zoom-level-txt{font-size:12px;color:rgba(255,255,255,.70);min-width:38px;text-align:center}
    #zoom-counter{font-size:13px;color:rgba(255,255,255,.65);padding:0 8px 0 2px;border-right:1px solid rgba(255,255,255,.18);margin-right:4px}
    .video-wrap{position:relative;width:100%;background:#000;overflow:hidden;height:520px}
    .video-wrap video{width:100%;height:100%;display:block;object-fit:contain;object-position:center center;cursor:pointer}
    .vdur-badge{position:absolute;top:10px;right:10px;z-index:6;background:rgba(0,0,0,.60);border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:3px 8px;font-size:12px;color:#fff;font-variant-numeric:tabular-nums;pointer-events:none}
    .video-wrap.playing .vdur-badge{display:none}
    .content{padding:14px 16px 10px}
    .username{font-size:18px;font-weight:800;letter-spacing:.2px;line-height:1.25}
    .caption{margin:8px 0 0;color:var(--muted);font-size:14px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    .social{padding:0 16px 14px;display:flex;flex-direction:column;gap:12px}
    .social-row{display:flex;align-items:center;gap:16px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)}
    .stat{display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;color:rgba(255,255,255,.82)}
    .stat svg{flex-shrink:0}
    .stat-lbl{font-size:12px;color:rgba(255,255,255,.45);font-weight:400;margin-left:1px}
    .comments-section{display:flex;flex-direction:column;gap:10px}
    .comment-item{display:flex;gap:10px;align-items:flex-start}
    .comment-avatar{width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.08)}
    .comment-avatar-init{width:32px;height:32px;border-radius:50%;flex-shrink:0;background:rgba(177,255,1,.15);border:1px solid rgba(177,255,1,.20);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--accent);text-transform:uppercase}
    .comment-body{display:flex;flex-direction:column;gap:2px;min-width:0}
    .comment-author{font-size:13px;font-weight:700;line-height:1.2}
    .comment-text{font-size:13px;color:rgba(255,255,255,.78);line-height:1.4;word-break:break-word}
    .comment-time{font-size:11px;color:rgba(255,255,255,.35);margin-top:1px}
    .show-more{font-size:13px;color:rgba(177,255,1,.80);background:none;border:none;cursor:pointer;padding:2px 0;text-align:left;font-weight:600}
    .show-more:hover{color:var(--accent)}
    .loading-txt{font-size:13px;color:rgba(255,255,255,.38)}
    .app-banner{display:none;align-items:center;gap:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:10px 12px;margin-bottom:16px}
    .app-banner-icon{width:44px;height:44px;border-radius:12px;flex:0 0 auto;object-fit:cover}
    .app-banner-text{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
    .app-banner-title{font-size:14px;font-weight:700;line-height:1.2}
    .app-banner-sub{font-size:12px;color:rgba(255,255,255,.55);line-height:1.3}
    .app-banner-btn{flex:0 0 auto;padding:8px 16px;border-radius:999px;border:none;background:var(--accent);color:#0b0b0f;font-size:13px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
    .actions{padding:14px 16px 16px;border-top:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10)}
    .store-badges{display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap}
    .badge{display:inline-flex;text-decoration:none;transition:transform .12s,opacity .12s}
    .badge:hover{transform:translateY(-1px);opacity:.92}
    .badge img{height:46px;width:auto;display:block}
    @media(max-width:460px){body{padding:16px}.pill{display:none}.badge img{height:48px}.video-wrap{height:360px}}
  </style>
</head>
<body>

<div id="zoom-overlay" role="dialog" aria-modal="true" aria-label="Image viewer">
  <button id="zoom-close" aria-label="Close">&#x2715;</button>
  <img id="zoom-img" src="" alt=""/>
  <div id="zoom-bar">
    <span id="zoom-counter" style="display:none"></span>
    <button class="zbtn" id="zoom-out-btn" aria-label="Zoom out">&#8722;</button>
    <span id="zoom-level-txt">100%</span>
    <button class="zbtn" id="zoom-in-btn" aria-label="Zoom in">&#43;</button>
  </div>
</div>

<div class="wrap">
  ${deepLink ? `
  <div id="app-banner" class="app-banner">
    <img src="${safeLogo}" class="app-banner-icon" alt=""/>
    <div class="app-banner-text">
      <span class="app-banner-title">${escapeHtml(APP_NAME)}</span>
      <span class="app-banner-sub">Open for the best experience</span>
    </div>
    <button id="app-banner-btn" class="app-banner-btn">Open</button>
  </div>` : ""}

  <div class="card">
    <div class="head">
      <div class="logo"><img src="${safeLogo}" alt="${escapeHtml(APP_NAME)} logo"/></div>
      <div class="headText">
        <div class="app">${escapeHtml(APP_NAME)}</div>
        <div class="domain">
          <span class="dot"></span>
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">app.biome-aura.com</span>
        </div>
      </div>
      <div class="pill">
        <span class="dot"></span>
        ${reelId ? "Reel" : hasVideo ? "Video post" : "Post"}
      </div>
    </div>

    ${hasVideo ? `
    <div class="video-wrap skeleton" id="vwrap">
      <div class="vdur-badge" id="vdur">&#8212;</div>
      <video id="main-video" src="${safeVideo}" ${safeVideoThumb ? `poster="${safeVideoThumb}"` : ""} preload="metadata" controls playsinline webkit-playsinline x-webkit-airplay="allow" onloadeddata="this.parentElement.classList.remove('skeleton')"></video>
    </div>
    ` : isImagePost ? `
    <div class="media skeleton" id="media-tap" role="button" tabindex="0" aria-label="Tap to zoom">
      <img id="preview-img" src="${safeImage}" alt=""
        onload="this.parentElement.classList.remove('skeleton')"
        onerror="this.parentElement.classList.remove('skeleton');this.onerror=null;${safeOgImage && safeOgImage !== safeImage ? `this.src='${safeOgImage}';` : ""}this.onerror=null"/>
      <div class="zoom-hint">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="11" cy="11" r="7"/><line x1="16.65" y1="16.65" x2="21" y2="21"/>
          <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
        Pinch or click to zoom
      </div>
    </div>
    ` : ""}

    <div class="content">
      <p class="username">${safeUser}</p>
      ${safeDesc ? `<p class="caption">${safeDesc}</p>` : ""}
    </div>

    <div class="social">
      <div class="social-row">
        <div class="stat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${likesCount > 0 ? "#ff4757" : "none"}" stroke="${likesCount > 0 ? "#ff4757" : "rgba(255,255,255,.65)"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
          <span>${likesCount.toLocaleString()}</span><span class="stat-lbl">likes</span>
        </div>
        <div class="stat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span>${commentsCount.toLocaleString()}</span><span class="stat-lbl">comments</span>
        </div>
      </div>

      ${commentsHtml ? `
      <div class="comments-section" id="clist">
        ${commentsHtml}
        ${commentsCount > 3 ? `<button class="show-more" id="show-more">View all ${commentsCount.toLocaleString()} comments →</button>` : ""}
      </div>` : commentsCount > 0 ? `
      <div class="comments-section" id="clist">
        <span class="loading-txt" id="cloading">Loading comments…</span>
      </div>` : ""}
    </div>

    <div class="actions">
      <div class="store-badges">
        <a id="ios-badge" class="badge" href="${safeIosStore}" target="_blank" rel="noopener" aria-label="Download on the App Store">
          <img src="${safeIosBadge}" alt="App Store" loading="lazy"/>
        </a>
        <a id="and-badge" class="badge" href="${safeAndroidStore}" target="_blank" rel="noopener" aria-label="Get it on Google Play">
          <img src="${safeAndroidBadge}" alt="Google Play" loading="lazy"/>
        </a>
      </div>
    </div>
  </div>
</div>

<script>
(function(){
  "use strict";
  var ua = navigator.userAgent || "";
  var isIOS = /iPhone|iPad|iPod/i.test(ua);
  var isAndroid = /Android/i.test(ua);

  var iosB = document.getElementById("ios-badge");
  var andB = document.getElementById("and-badge");
  if (isAndroid && iosB) iosB.remove();
  if (isIOS && andB) andB.remove();

  var banner = document.getElementById("app-banner");
  var bannerBtn = document.getElementById("app-banner-btn");
  if (banner && (isAndroid || isIOS)) banner.style.display = "flex";
  if (bannerBtn) {
    bannerBtn.addEventListener("click", function(){
      var dl = ${JSON.stringify(deepLink)};
      var store = isIOS ? ${JSON.stringify(iosStore)} : ${JSON.stringify(androidStore)};
      if (!dl) { if (store) location.href = store; return; }
      var gone = false;
      document.addEventListener("visibilitychange", function f(){
        if (document.hidden) { gone = true; document.removeEventListener("visibilitychange", f); }
      });
      setTimeout(function(){ if (!gone && store) location.href = store; }, 1500);
      location.href = dl;
    });
  }

  var overlay = document.getElementById("zoom-overlay");
  var zImg = document.getElementById("zoom-img");
  var zClose = document.getElementById("zoom-close");
  var zCounter = document.getElementById("zoom-counter");
  var zInBtn = document.getElementById("zoom-in-btn");
  var zOutBtn = document.getElementById("zoom-out-btn");
  var zLvlTxt = document.getElementById("zoom-level-txt");
  var curScale = 1, panX = 0, panY = 0;
  var MIN = 1, MAX = 5;

  function clamp(v,lo,hi){return v<lo?lo:v>hi?hi:v}
  function apply(anim){
    if (curScale<=MIN){panX=0;panY=0}
    zImg.style.transition = anim!==false ? "transform .18s ease" : "none";
    zImg.style.transform = "scale("+curScale+") translate("+(panX/curScale)+"px,"+(panY/curScale)+"px)";
    zImg.style.cursor = curScale>1 ? "grab" : "zoom-in";
    if (zLvlTxt) zLvlTxt.textContent = Math.round(curScale*100)+"%";
    if (zInBtn) zInBtn.disabled = curScale>=MAX;
    if (zOutBtn) zOutBtn.disabled = curScale<=MIN;
  }
  function setScale(s,anim){curScale = clamp(parseFloat(s)||1, MIN, MAX); apply(anim)}
  function closeZoom(){overlay.classList.remove("open"); setScale(1,false); panX=0; panY=0; document.body.style.overflow=""}

  if (zClose) zClose.addEventListener("click", function(e){e.stopPropagation(); closeZoom()});
  if (zInBtn) zInBtn.addEventListener("click", function(e){e.stopPropagation(); setScale(curScale+0.5)});
  if (zOutBtn) zOutBtn.addEventListener("click", function(e){e.stopPropagation(); setScale(curScale-0.5)});
  overlay.addEventListener("click", function(e){ if (e.target===overlay) closeZoom() });

  ${isImagePost ? `
  var GALLERY = [${galleryJS}];
  var gIdx = 0;
  function openZoom(idx){
    if (!GALLERY.length) return;
    gIdx = clamp(idx, 0, GALLERY.length-1);
    zImg.src = GALLERY[gIdx];
    setScale(1,false); panX=0; panY=0;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    if (GALLERY.length>1){ zCounter.textContent = (gIdx+1)+" / "+GALLERY.length; zCounter.style.display="inline" }
    else { zCounter.style.display="none" }
  }
  var mediaTap = document.getElementById("media-tap");
  if (mediaTap){
    mediaTap.addEventListener("click", function(e){ e.preventDefault(); openZoom(0) });
    mediaTap.addEventListener("keydown", function(e){ if (e.key==="Enter"||e.key===" "){ e.preventDefault(); openZoom(0) } });
  }
  ` : ""}

  var cloading = document.getElementById("cloading");
  if (cloading) {
    var _aid = ${JSON.stringify(authorId)};
    var _pid = ${JSON.stringify(postId)};
    var _rid = ${JSON.stringify(reelId)};
    var apiUrl = "/api/comments?authorId="+encodeURIComponent(_aid)+
      (_rid ? "&reelId="+encodeURIComponent(_rid) : "&postId="+encodeURIComponent(_pid));
    fetch(apiUrl).then(function(r){return r.ok ? r.json() : null}).then(function(data){
      if (!data || !data.comments || !data.comments.length){ cloading.textContent = "No comments yet."; return }
      var section = document.getElementById("clist");
      if (!section) return;
      section.removeChild(cloading);
      data.comments.forEach(function(c){
        var name = String(c.authorName||"User").replace(/</g,"&lt;");
        var photo = String(c.authorPhotoURL||"");
        var text = String(c.text||"").replace(/</g,"&lt;");
        var initial = (name.charAt(0)||"U").toUpperCase();
        var tStr = "";
        if (c.createdAt){ try { var ms = c.createdAt._seconds ? c.createdAt._seconds*1000 : +new Date(c.createdAt); tStr = new Date(ms).toLocaleDateString(undefined,{month:"short",day:"numeric"}) } catch(e){} }
        var el = document.createElement("div");
        el.className = "comment-item";
        el.innerHTML = (photo
          ? '<img class="comment-avatar" src="'+photo+'" alt="" loading="lazy" onerror="this.style.display=\\'none\\';this.nextElementSibling.style.display=\\'flex\\'"/><div class="comment-avatar-init" style="display:none">'+initial+'</div>'
          : '<div class="comment-avatar-init">'+initial+'</div>')
          +'<div class="comment-body"><span class="comment-author">'+name+'</span><span class="comment-text">'+text+'</span>'+(tStr?'<span class="comment-time">'+tStr+'</span>':"")+'</div>';
        section.appendChild(el);
      });
    }).catch(function(){ if (cloading.parentNode) cloading.textContent = "" });
  }

  var showMore = document.getElementById("show-more");
  if (showMore){
    showMore.addEventListener("click", function(){
      var dl = ${JSON.stringify(deepLink)};
      var store = isIOS ? ${JSON.stringify(iosStore)} : ${JSON.stringify(androidStore)};
      location.href = dl || store || "#";
    });
  }
})();
</script>
</body>
</html>`;
}
