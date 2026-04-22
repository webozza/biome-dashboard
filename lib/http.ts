export async function readJson<T>(resp: Response): Promise<T> {
  const data = (await resp.json().catch(() => null)) as T & { error?: string; reason?: string };
  if (!resp.ok) {
    const message = (data as { error?: string })?.error || "request_failed";
    const reason = (data as { reason?: string })?.reason ? ` (${(data as { reason?: string }).reason})` : "";
    throw new Error(`${message}${reason}`);
  }
  return data;
}
