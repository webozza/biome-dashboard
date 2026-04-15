import { env } from "@/lib/server/share/utils";

export const dynamic = "force-static";
export const runtime = "nodejs";

export function GET() {
  const teamId = env("APPLE_TEAM_ID", "");
  const bundleId = env("APPLE_BUNDLE_ID", "com.webozza.projectv");
  const appID = teamId ? `${teamId}.${bundleId}` : bundleId;

  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appID,
          appIDs: [appID],
          paths: ["/p/*", "/r/*"],
          components: [
            { "/": "/p/*", comment: "Post share links" },
            { "/": "/r/*", comment: "Reel share links" },
          ],
        },
      ],
    },
    webcredentials: { apps: [appID] },
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
