export async function postJSON(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data = null;
  try { data = await r.json(); } catch (e) { /* ignore */ }

  if (!r.ok) {
    const msg = data?.error || data?.reply || `Request failed: ${r.status}`;
    throw new Error(msg);
  }
  return data;
}
