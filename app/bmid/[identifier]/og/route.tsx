import { ImageResponse } from "next/og";
import { resolvePublicBmidProfile } from "@/lib/server/share/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "BA";
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ identifier: string }> }
) {
  const { identifier } = await ctx.params;
  const profile = await resolvePublicBmidProfile(identifier);
  if (!profile) return new Response("Profile unavailable", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "64px 76px",
          color: "white",
          background:
            "radial-gradient(circle at 88% 10%, rgba(205,242,176,.38), transparent 32%), linear-gradient(135deg,#172c1b 0%,#3f7135 58%,#84b863 100%)",
          fontFamily: "Arial, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -20,
            bottom: -185,
            fontSize: 560,
            lineHeight: 1,
            fontWeight: 900,
            color: "rgba(255,255,255,.055)",
          }}
        >
          B
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: 720 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "auto",
              padding: "10px 16px",
              borderRadius: 999,
              background: "rgba(255,255,255,.13)",
              border: "1px solid rgba(255,255,255,.22)",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 1.5,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#cef0b2" />
              <path d="m7.7 12.1 2.7 2.7 5.9-6" stroke="#254625" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            BMID VERIFIED CREATOR
          </div>
          <div style={{ fontSize: 68, lineHeight: 1.02, fontWeight: 800, marginTop: 28, letterSpacing: -3 }}>
            {profile.displayName}
          </div>
          {profile.bio ? (
            <div style={{ fontSize: 23, lineHeight: 1.45, color: "rgba(255,255,255,.76)", marginTop: 22, maxHeight: 98, overflow: "hidden" }}>
              {profile.bio.slice(0, 150)}
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 30 }}>
            <div style={{ padding: "12px 17px", borderRadius: 15, background: "rgba(14,29,17,.28)", fontSize: 21, fontWeight: 700 }}>
              {profile.bmidNumber}
            </div>
            <div style={{ fontSize: 22, color: "rgba(255,255,255,.70)" }}>Biome Aura</div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 310,
            height: 310,
            borderRadius: 78,
            padding: 9,
            background: "rgba(255,255,255,.20)",
            boxShadow: "0 28px 70px rgba(9,25,11,.30)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 292,
              height: 292,
              borderRadius: 69,
              overflow: "hidden",
              background: "#c5ddaf",
              fontSize: 92,
              fontWeight: 900,
              color: "#31582f",
            }}
          >
            {profile.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photoUrl} alt="" width="292" height="292" style={{ width: 292, height: 292, objectFit: "cover", borderRadius: 69 }} />
            ) : initials(profile.displayName)}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
