export const API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3001"
    : (document.querySelector('meta[name="api-base"]')?.content?.replace(/\/$/, "") || "https://executive-driving-backend-b79y.onrender.com");

export const API_BOOK = `${API_BASE}/book`;

// /js/api.js
export async function postJSON(url, body, headers = {}) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  let data = null;
  try { data = await r.json(); } catch (e) { /* keep data = null */ }

  if (!r.ok) {
    const msg = data?.error || data?.reply || `Request failed: ${r.status}`;
    throw new Error(msg);
  }
  return data;
}
