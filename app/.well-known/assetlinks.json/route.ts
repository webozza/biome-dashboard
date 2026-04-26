import { env } from "@/lib/server/share/utils";

export const dynamic = "force-static";
export const runtime = "nodejs";

export function GET() {
  const packageName = env("ANDROID_PACKAGE_NAME", "com.webozza.projectv");
  const fingerprints = env("ANDROID_SHA256_FINGERPRINTS", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
