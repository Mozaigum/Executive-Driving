export const API_BASE = 'https://executive-driving-backend.onrender.com';
export const API_CHAT = `${API_BASE}/chat`;        // matches app.post("/chat", ...)
export const API_BOOK = `${API_BASE}/book`;
   // change to /book if your backend uses /book

// /js/api.js
export async function postJSON(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data = null;
  try { data = await r.json(); } catch (e) { /* keep data = null */ }

  if (!r.ok) {
    const msg = data?.error || data?.reply || `Request failed: ${r.status}`;
    throw new Error(msg);
  }
  return data;
}
