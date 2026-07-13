function escapeJs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export default function OAuthRedirectPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (typeof value === "string") {
      params.set(key, value);
    }
  }

  const appUrl = `projectv://oauthredirect${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-slate-900">
      <div className="max-w-sm space-y-4">
        <h1 className="text-xl font-bold">Returning to Biome Aura</h1>
        <p className="text-sm text-slate-600">If the app does not open automatically, tap the button below.</p>
        <a
          className="inline-flex rounded-lg bg-[#76AC51] px-5 py-3 text-sm font-bold text-white"
          href={appUrl}
        >
          Open Biome Aura
        </a>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.location.href='${escapeJs(appUrl)}';`,
        }}
      />
    </main>
  );
}
