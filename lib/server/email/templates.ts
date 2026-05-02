type BrandConfig = {
  brandName: string;
  logoUrl: string;
  appUrl: string;
  supportEmail: string;
};

type VerificationContext = {
  userName: string;
  platform: string;
  socialAccount: string;
  adminNote?: string | null;
  rejectionReason?: string | null;
};

const COLORS = {
  bg: "#ffffff",
  card: "#ffffff",
  border: "rgba(15,23,42,0.08)",
  text: "#0f172a",
  textMuted: "#475569",
  textDim: "#94a3b8",
  accent: "#10b981",
  accentSoft: "rgba(16,185,129,0.10)",
  danger: "#ef4444",
  dangerSoft: "rgba(239,68,68,0.08)",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function headerBlock(brand: BrandConfig): string {
  if (brand.logoUrl) {
    return `
      <tr>
        <td align="center" style="padding:32px 24px 8px;">
          <img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.brandName)}" height="40" style="display:block;border:0;outline:none;text-decoration:none;height:40px;max-width:220px;" />
        </td>
      </tr>
    `;
  }
  return `
    <tr>
      <td align="center" style="padding:36px 24px 8px;">
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${COLORS.text};">
          ${escapeHtml(brand.brandName)}
        </div>
      </td>
    </tr>
  `;
}

function statusPill(label: string, accent: string, soft: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
      <tr>
        <td style="background:${soft};border:1px solid ${accent}40;border-radius:999px;padding:8px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${accent};">
          ${escapeHtml(label)}
        </td>
      </tr>
    </table>
  `;
}

function detailsTable(rows: { label: string; value: string }[]): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      ${rows
        .map(
          (r) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.08em;width:40%;">
            ${escapeHtml(r.label)}
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:${COLORS.text};font-weight:600;word-break:break-word;">
            ${escapeHtml(r.value)}
          </td>
        </tr>
      `
        )
        .join("")}
    </table>
  `;
}

function ctaButton(label: string, href: string, accent: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
      <tr>
        <td align="center" style="border-radius:12px;background:${accent};">
          <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;border-radius:12px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function baseShell(opts: {
  brand: BrandConfig;
  previewText: string;
  accentColor: string;
  accentSoft: string;
  statusLabel: string;
  headline: string;
  intro: string;
  detailsRows: { label: string; value: string }[];
  extraBlockHtml?: string;
  ctaLabel: string;
  ctaHref: string;
  footerNote: string;
}): string {
  const { brand } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(opts.headline)}</title>
<style>
  @media only screen and (max-width:520px) {
    .container { width:100% !important; padding:0 !important; }
    .card { border-radius:20px !important; padding:28px 20px !important; }
    .headline { font-size:24px !important; line-height:1.25 !important; }
    .intro, .note { font-size:14px !important; }
    .pad-y { padding-top:20px !important; padding-bottom:20px !important; }
  }
  a { color:${opts.accentColor}; }
  body { margin:0; padding:0; background:${COLORS.bg}; }
</style>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(opts.previewText)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bg};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;">
          ${headerBlock(brand)}
          <tr>
            <td class="pad-y" style="padding:24px 0;">
              <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:24px;padding:36px 32px;">
                <tr>
                  <td align="center" style="padding-bottom:18px;">
                    ${statusPill(opts.statusLabel, opts.accentColor, opts.accentSoft)}
                  </td>
                </tr>
                <tr>
                  <td align="center" class="headline" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${COLORS.text};padding-bottom:14px;">
                    ${escapeHtml(opts.headline)}
                  </td>
                </tr>
                <tr>
                  <td align="center" class="intro" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${COLORS.textMuted};padding-bottom:24px;">
                    ${opts.intro}
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:24px;">
                    ${detailsTable(opts.detailsRows)}
                  </td>
                </tr>
                ${opts.extraBlockHtml ? `<tr><td style="padding-bottom:24px;">${opts.extraBlockHtml}</td></tr>` : ""}
                <tr>
                  <td align="center" style="padding-top:4px;">
                    ${ctaButton(opts.ctaLabel, opts.ctaHref, opts.accentColor)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="note" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${COLORS.textDim};padding:8px 8px 32px;">
              ${escapeHtml(opts.footerNote)}<br />
              Questions? Reply to this email or contact <a href="mailto:${escapeHtml(brand.supportEmail)}" style="color:${opts.accentColor};text-decoration:none;">${escapeHtml(brand.supportEmail)}</a>.
              <div style="padding-top:10px;color:${COLORS.textDim};">© ${new Date().getFullYear()} ${escapeHtml(brand.brandName)}. All rights reserved.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderApprovedEmail(brand: BrandConfig, ctx: VerificationContext) {
  const subject = "✅ Your account verification is approved";
  const html = baseShell({
    brand,
    previewText: "Your account verification request has been approved.",
    accentColor: COLORS.accent,
    accentSoft: COLORS.accentSoft,
    statusLabel: "Approved",
    headline: `Verification approved, ${ctx.userName.split(" ")[0] || "there"}`,
    intro: `Your BMID account verification request has been approved. Your account status will reflect this update shortly.`,
    detailsRows: [
      { label: "Request type", value: "Account verification" },
      { label: "Handle", value: ctx.socialAccount || "Not provided" },
      { label: "Status", value: "Approved" },
    ],
    extraBlockHtml: ctx.adminNote
      ? `<div style="background:${COLORS.accentSoft};border:1px solid ${COLORS.accent}33;border-radius:14px;padding:16px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:${COLORS.text};">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.accent};padding-bottom:6px;">Note from the team</div>
          ${escapeHtml(ctx.adminNote)}
        </div>`
      : "",
    ctaLabel: "Open Biome Aura",
    ctaHref: brand.appUrl,
    footerNote: "You're receiving this because you requested verification via the Biome Aura app.",
  });
  const text = [
    `Verification approved, ${ctx.userName}`,
    ``,
    "Your BMID account verification request has been approved.",
    ``,
    "Request type: Account verification",
    `Handle: ${ctx.socialAccount || "Not provided"}`,
    `Status: Approved`,
    ctx.adminNote ? `\nNote from the team:\n${ctx.adminNote}` : "",
    ``,
    `Open the app: ${brand.appUrl}`,
    `Questions? ${brand.supportEmail}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, html, text };
}

export function renderRejectedEmail(brand: BrandConfig, ctx: VerificationContext) {
  const subject = "Update on your account verification request";
  const reason = ctx.rejectionReason?.trim() || "Your submitted details didn't meet our verification requirements.";
  const html = baseShell({
    brand,
    previewText: "Update on your account verification request.",
    accentColor: COLORS.danger,
    accentSoft: COLORS.dangerSoft,
    statusLabel: "Not approved",
    headline: "We couldn't approve your verification request",
    intro: "We've reviewed your BMID account verification request and weren't able to approve it at this time.",
    detailsRows: [
      { label: "Request type", value: "Account verification" },
      { label: "Handle", value: ctx.socialAccount || "Not provided" },
      { label: "Status", value: "Not approved" },
    ],
    extraBlockHtml: `<div style="background:${COLORS.dangerSoft};border:1px solid ${COLORS.danger}33;border-radius:14px;padding:16px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:${COLORS.text};">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.danger};padding-bottom:6px;">Reason</div>
      ${escapeHtml(reason)}
    </div>${
      ctx.adminNote
        ? `<div style="margin-top:12px;background:rgba(255,255,255,0.04);border:1px solid ${COLORS.border};border-radius:14px;padding:16px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:${COLORS.text};">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.textMuted};padding-bottom:6px;">Note from the team</div>
          ${escapeHtml(ctx.adminNote)}
        </div>`
        : ""
    }`,
    ctaLabel: "Resubmit Request",
    ctaHref: brand.appUrl,
    footerNote: "You can resubmit after addressing the reason above.",
  });
  const text = [
    `We couldn't verify your request`,
    ``,
    `We've reviewed your BMID verification for ${ctx.socialAccount} on ${ctx.platform} and weren't able to approve it at this time.`,
    ``,
    `Platform: ${ctx.platform}`,
    `Account: ${ctx.socialAccount}`,
    `Status: Not approved`,
    ``,
    `Reason: ${reason}`,
    ctx.adminNote ? `\nNote from the team:\n${ctx.adminNote}` : "",
    ``,
    `Resubmit: ${brand.appUrl}`,
    `Questions? ${brand.supportEmail}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, html, text };
}

type ContentApprovalContext = {
  ownerName: string;
  postTitle?: string | null;
  taggedUserName?: string | null;
  isDuality: boolean;
};

type BoxApprovalContext = {
  ownerName: string;
  previewTitle?: string | null;
  sourcePlatform?: string | null;
  taggedUserName?: string | null;
  isDuality: boolean;
};

export function renderContentApprovedEmail(brand: BrandConfig, ctx: ContentApprovalContext) {
  const subject = "✅ Your BMID content is approved — voting has started";
  const firstName = ctx.ownerName.split(" ")[0] || "there";
  const detailsRows = [
    { label: "Request type", value: ctx.isDuality ? "Duality content" : "BMID content" },
    { label: "Title", value: ctx.postTitle || "Not provided" },
  ];
  if (ctx.isDuality && ctx.taggedUserName) {
    detailsRows.push({ label: "Tagged with", value: ctx.taggedUserName });
  }
  detailsRows.push({ label: "Status", value: "Admin approved — voting open" });

  const html = baseShell({
    brand,
    previewText: "Your BMID content has been admin-approved and community voting is now open.",
    accentColor: COLORS.accent,
    accentSoft: COLORS.accentSoft,
    statusLabel: "Approved",
    headline: `Content approved, ${firstName}`,
    intro:
      "Your BMID content has been approved by an admin and community voting is now open. Once voting concludes, you'll receive a separate email with the final result.",
    detailsRows,
    ctaLabel: "Open Biome Aura",
    ctaHref: brand.appUrl,
    footerNote: "You're receiving this because you submitted a BMID content request.",
  });

  const text = [
    `Content approved, ${ctx.ownerName}`,
    ``,
    "Your BMID content has been approved by an admin and community voting is now open.",
    "You'll receive a separate email once voting concludes.",
    ``,
    `Request type: ${ctx.isDuality ? "Duality content" : "BMID content"}`,
    `Title: ${ctx.postTitle || "Not provided"}`,
    ctx.isDuality && ctx.taggedUserName ? `Tagged with: ${ctx.taggedUserName}` : "",
    `Status: Admin approved — voting open`,
    ``,
    `Open the app: ${brand.appUrl}`,
    `Questions? ${brand.supportEmail}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

export function renderBoxApprovedEmail(brand: BrandConfig, ctx: BoxApprovalContext) {
  const subject = "✅ Your BMID Box content is approved — voting has started";
  const firstName = ctx.ownerName.split(" ")[0] || "there";
  const detailsRows = [
    { label: "Request type", value: ctx.isDuality ? "BMID Box (duality)" : "BMID Box" },
    { label: "Title", value: ctx.previewTitle || "Not provided" },
  ];
  if (ctx.sourcePlatform) {
    detailsRows.push({ label: "Platform", value: ctx.sourcePlatform });
  }
  if (ctx.isDuality && ctx.taggedUserName) {
    detailsRows.push({ label: "Tagged with", value: ctx.taggedUserName });
  }
  detailsRows.push({ label: "Status", value: "Admin approved — voting open" });

  const html = baseShell({
    brand,
    previewText: "Your BMID Box content has been admin-approved and community voting is now open.",
    accentColor: COLORS.accent,
    accentSoft: COLORS.accentSoft,
    statusLabel: "Approved",
    headline: `Box content approved, ${firstName}`,
    intro:
      "Your BMID Box content has been approved by an admin and community voting is now open. Once voting concludes, you'll receive a separate email with the final result.",
    detailsRows,
    ctaLabel: "Open Biome Aura",
    ctaHref: brand.appUrl,
    footerNote: "You're receiving this because you submitted a BMID Box request.",
  });

  const text = [
    `Box content approved, ${ctx.ownerName}`,
    ``,
    "Your BMID Box content has been approved by an admin and community voting is now open.",
    "You'll receive a separate email once voting concludes.",
    ``,
    `Request type: ${ctx.isDuality ? "BMID Box (duality)" : "BMID Box"}`,
    `Title: ${ctx.previewTitle || "Not provided"}`,
    ctx.sourcePlatform ? `Platform: ${ctx.sourcePlatform}` : "",
    ctx.isDuality && ctx.taggedUserName ? `Tagged with: ${ctx.taggedUserName}` : "",
    `Status: Admin approved — voting open`,
    ``,
    `Open the app: ${brand.appUrl}`,
    `Questions? ${brand.supportEmail}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

type FinalizationContext = {
  ownerName: string;
  outcome: "approved" | "rejected" | "cancelled";
  voteAccept?: number;
  voteIgnore?: number;
  voteRefuse?: number;
  postTitle?: string | null;
  taggedUserName?: string | null;
  isDuality?: boolean;
  surface: "content" | "box";
  sourcePlatform?: string | null;
};

function outcomeCopy(outcome: FinalizationContext["outcome"]) {
  switch (outcome) {
    case "approved":
      return {
        statusLabel: "Final: Approved",
        headlinePrefix: "Approved by community vote",
        intro:
          "Community voting has concluded and your submission has been approved. It's now visible on Biome Aura.",
        accent: COLORS.accent,
        accentSoft: COLORS.accentSoft,
        subjectPrefix: "✅",
      };
    case "rejected":
      return {
        statusLabel: "Final: Not approved",
        headlinePrefix: "Voting closed — not approved",
        intro:
          "Community voting has concluded and your submission was not approved.",
        accent: COLORS.danger,
        accentSoft: COLORS.dangerSoft,
        subjectPrefix: "Update on",
      };
    case "cancelled":
      return {
        statusLabel: "Final: Cancelled",
        headlinePrefix: "Voting concluded — no final decision",
        intro:
          "Community voting has concluded without a clear outcome and your submission has been cancelled.",
        accent: COLORS.textMuted,
        accentSoft: "rgba(71,85,105,0.10)",
        subjectPrefix: "Update on",
      };
  }
}

export function renderContentFinalizedEmail(brand: BrandConfig, ctx: FinalizationContext) {
  const copy = outcomeCopy(ctx.outcome);
  const firstName = ctx.ownerName.split(" ")[0] || "there";
  const subject = `${copy.subjectPrefix} your BMID content — voting finalized`;
  const detailsRows = [
    { label: "Request type", value: ctx.isDuality ? "Duality content" : "BMID content" },
    { label: "Title", value: ctx.postTitle || "Not provided" },
  ];
  if (ctx.isDuality && ctx.taggedUserName) {
    detailsRows.push({ label: "Tagged with", value: ctx.taggedUserName });
  }
  detailsRows.push({ label: "Outcome", value: copy.statusLabel.replace(/^Final: /, "") });
  if (
    typeof ctx.voteAccept === "number" ||
    typeof ctx.voteIgnore === "number" ||
    typeof ctx.voteRefuse === "number"
  ) {
    detailsRows.push({
      label: "Final votes",
      value: `Accept ${ctx.voteAccept ?? 0} · Ignore ${ctx.voteIgnore ?? 0} · Refuse ${ctx.voteRefuse ?? 0}`,
    });
  }

  const html = baseShell({
    brand,
    previewText: copy.intro,
    accentColor: copy.accent,
    accentSoft: copy.accentSoft,
    statusLabel: copy.statusLabel,
    headline: `${copy.headlinePrefix}, ${firstName}`,
    intro: copy.intro,
    detailsRows,
    ctaLabel: "Open Biome Aura",
    ctaHref: brand.appUrl,
    footerNote: "You're receiving this because you submitted a BMID content request.",
  });

  const text = [
    `${copy.headlinePrefix}, ${ctx.ownerName}`,
    ``,
    copy.intro,
    ``,
    `Request type: ${ctx.isDuality ? "Duality content" : "BMID content"}`,
    `Title: ${ctx.postTitle || "Not provided"}`,
    ctx.isDuality && ctx.taggedUserName ? `Tagged with: ${ctx.taggedUserName}` : "",
    `Outcome: ${copy.statusLabel.replace(/^Final: /, "")}`,
    `Final votes: Accept ${ctx.voteAccept ?? 0} · Ignore ${ctx.voteIgnore ?? 0} · Refuse ${ctx.voteRefuse ?? 0}`,
    ``,
    `Open the app: ${brand.appUrl}`,
    `Questions? ${brand.supportEmail}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

export function renderBoxFinalizedEmail(brand: BrandConfig, ctx: FinalizationContext) {
  const copy = outcomeCopy(ctx.outcome);
  const firstName = ctx.ownerName.split(" ")[0] || "there";
  const subject = `${copy.subjectPrefix} your BMID Box content — voting finalized`;
  const detailsRows = [
    { label: "Request type", value: ctx.isDuality ? "BMID Box (duality)" : "BMID Box" },
    { label: "Title", value: ctx.postTitle || "Not provided" },
  ];
  if (ctx.sourcePlatform) {
    detailsRows.push({ label: "Platform", value: ctx.sourcePlatform });
  }
  if (ctx.isDuality && ctx.taggedUserName) {
    detailsRows.push({ label: "Tagged with", value: ctx.taggedUserName });
  }
  detailsRows.push({ label: "Outcome", value: copy.statusLabel.replace(/^Final: /, "") });
  if (
    typeof ctx.voteAccept === "number" ||
    typeof ctx.voteIgnore === "number" ||
    typeof ctx.voteRefuse === "number"
  ) {
    detailsRows.push({
      label: "Final votes",
      value: `Accept ${ctx.voteAccept ?? 0} · Ignore ${ctx.voteIgnore ?? 0} · Refuse ${ctx.voteRefuse ?? 0}`,
    });
  }

  const html = baseShell({
    brand,
    previewText: copy.intro,
    accentColor: copy.accent,
    accentSoft: copy.accentSoft,
    statusLabel: copy.statusLabel,
    headline: `${copy.headlinePrefix}, ${firstName}`,
    intro: copy.intro,
    detailsRows,
    ctaLabel: "Open Biome Aura",
    ctaHref: brand.appUrl,
    footerNote: "You're receiving this because you submitted a BMID Box request.",
  });

  const text = [
    `${copy.headlinePrefix}, ${ctx.ownerName}`,
    ``,
    copy.intro,
    ``,
    `Request type: ${ctx.isDuality ? "BMID Box (duality)" : "BMID Box"}`,
    `Title: ${ctx.postTitle || "Not provided"}`,
    ctx.sourcePlatform ? `Platform: ${ctx.sourcePlatform}` : "",
    ctx.isDuality && ctx.taggedUserName ? `Tagged with: ${ctx.taggedUserName}` : "",
    `Outcome: ${copy.statusLabel.replace(/^Final: /, "")}`,
    `Final votes: Accept ${ctx.voteAccept ?? 0} · Ignore ${ctx.voteIgnore ?? 0} · Refuse ${ctx.voteRefuse ?? 0}`,
    ``,
    `Open the app: ${brand.appUrl}`,
    `Questions? ${brand.supportEmail}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

type PasswordResetOtpContext = {
  otp: string;
  expiresInMinutes: number;
};

export function renderPasswordResetOtpEmail(brand: BrandConfig, ctx: PasswordResetOtpContext) {
  const subject = `Your password reset code: ${ctx.otp}`;
  const otpDisplay = ctx.otp.split("").join(" ");

  const otpBlock = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr>
        <td align="center" style="background:${COLORS.accentSoft};border:1px solid ${COLORS.accent}33;border-radius:18px;padding:24px 16px;">
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.accent};padding-bottom:12px;">Your verification code</div>
          <div style="font-family:'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace;font-size:36px;font-weight:800;letter-spacing:0.32em;color:${COLORS.text};">
            ${escapeHtml(otpDisplay)}
          </div>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:${COLORS.textMuted};padding-top:14px;">
            Expires in ${ctx.expiresInMinutes} minutes
          </div>
        </td>
      </tr>
    </table>
  `;

  const html = baseShell({
    brand,
    previewText: `Your password reset code is ${ctx.otp}. It expires in ${ctx.expiresInMinutes} minutes.`,
    accentColor: COLORS.accent,
    accentSoft: COLORS.accentSoft,
    statusLabel: "Password reset",
    headline: "Reset your password",
    intro:
      "We received a request to reset your password. Enter the code below in the app to continue. If you didn't request this, you can safely ignore this email.",
    detailsRows: [
      { label: "Request type", value: "Password reset" },
      { label: "Code expiry", value: `${ctx.expiresInMinutes} minutes` },
    ],
    extraBlockHtml: otpBlock,
    ctaLabel: "Open Biome Aura",
    ctaHref: brand.appUrl,
    footerNote: "Never share this code with anyone. Our team will never ask for it.",
  });

  const text = [
    `Reset your password`,
    ``,
    `We received a request to reset your password.`,
    ``,
    `Your code: ${ctx.otp}`,
    `Expires in: ${ctx.expiresInMinutes} minutes`,
    ``,
    `If you didn't request this, ignore this email.`,
    `Never share this code with anyone.`,
    ``,
    `Questions? ${brand.supportEmail}`,
  ].join("\n");

  return { subject, html, text };
}

export type {
  BrandConfig,
  VerificationContext,
  ContentApprovalContext,
  BoxApprovalContext,
  FinalizationContext,
  PasswordResetOtpContext,
};
