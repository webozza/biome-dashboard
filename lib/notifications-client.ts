/**
 * Client-side helper to trigger notifications via the admin API.
 */
export async function triggerAdminNotification(
  apiToken: string,
  payload: {
    userId: string;
    contentType: "content" | "box" | "verification";
    requestId: string;
    status: "approved" | "rejected";
    rejectionReason?: string;
    userName?: string;
    postTitle?: string;
  }
) {
  try {
    const resp = await fetch("/api/admin/notify", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const data = await resp.json();
      console.error("[notification] server returned error:", data);
      return { ok: false, error: data.error || "Unknown error" };
    }

    return { ok: true };
  } catch (e) {
    console.error("[notification] failed to trigger:", e);
    return { ok: false, error: String(e) };
  }
}
