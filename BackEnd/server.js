// server.js
import "dotenv/config";
console.log("BOOKING_EMAIL_TO:", process.env.BOOKING_EMAIL_TO);
console.log("BOOKING_EMAIL_FROM:", process.env.BOOKING_EMAIL_FROM);
console.log("SMTP_USER:", process.env.SMTP_USER);

import express from "express";
import cors from "cors";
import OpenAI from "openai";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";


// path to inline email logo
const LOGO_PATH = path.join(process.cwd(), "assets", "logo-email.png");


process.on("unhandledRejection", (reason) => {
  console.error(" Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

/* ---------- Company facts + lightweight learning KB ---------- */
const COMPANY_FACTS = `
Executive Driving provides discreet, premium SUV chauffeur service in Edmonton and Grande Prairie.
We specialize in airport transfers and executive travel. Professional, punctual, quiet cabins.
Phone: 825-973-9800 • Email: info@executivedriving.ca.
Booking needs: name, phone, email, pickup, destination, date, time, passengers. Vehicles: premium SUVs.
`;

const FAQ_SEED = [
  { q: "what is this company", a: "Executive Driving is a private chauffeur service providing premium SUV transfers in Edmonton & Grande Prairie, with a focus on airport and executive travel." },
  { q: "what services do you provide", a: "Airport transfers, executive point-to-point, hourly/as-directed, and discreet VIP transport in premium SUVs." },
  { q: "which areas do you cover", a: "Edmonton and Grande Prairie (and nearby communities on request)." },
  { q: "how do i book", a: "You can book right here in chat or via the Reserve form—share your name, phone, email, pickup, destination, date, time, and passengers." },
  { q: "contact", a: "Phone 825-973-9800 • Email info@executivedriving.ca." },
  { q: "fleet", a: "Premium, modern SUVs quiet cabins, climate control, and ample luggage space." },
  { q: "pricing", a: "Rates vary by route, time, and availability. Share pickup, destination, date & time and I’ll quote and reserve." }
];

const KB_FILE = path.join(process.cwd(), "knowledge.json");
function loadKB() {
  try { return JSON.parse(fs.readFileSync(KB_FILE, "utf8")); }
  catch { return { items: [...FAQ_SEED] }; }
}
function saveKB(kb) {
  try { fs.writeFileSync(KB_FILE, JSON.stringify(kb, null, 2)); } catch { /* ignore */ }
}
function findKBAnswer(userText, kb) {
  const t = (userText || "").toLowerCase();
  const tokens = t.split(/\W+/).filter(Boolean);
  const score = (q) => {
    const qt = q.toLowerCase();
    if (t.includes(qt) || qt.includes(t)) return 3;
    const qTokens = qt.split(/\W+/).filter(Boolean);
    const overlap = qTokens.filter(w => tokens.includes(w)).length;
    return overlap >= 2 ? 2 : overlap === 1 ? 1 : 0;
  };
  let best = null;
  for (const item of kb.items) {
    const s = score(item.q);
    if (!best || s > best.s) best = { s, item };
  }
  return best && best.s >= 3 ? best.item.a : null;
}
function learnQnA(userText, answerText) {
  if (!userText || !answerText) return;
  if (answerText.length > 600) return;
  const kb = loadKB();
  const exists = kb.items.some(i => i.q.toLowerCase() === userText.toLowerCase());
  if (!exists) {
    kb.items.push({ q: userText.trim(), a: answerText.trim() });
    saveKB(kb);
  }
}

/* ---------- App ---------- */
const app = express();
app.use(express.json());
app.use(cors({ origin: true, methods: ["POST", "GET", "OPTIONS"] }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------- Gentle, on-brand redirect ---------- */
const REDIRECT =
  "I’m your Executive Driving concierge. I can help with bookings and service questions (pricing, availability, routes, vehicles, policies). Share your pickup, destination, date & time to begin.";

/* ---------- Keywords & helpers ---------- */
const ALLOWED = [
  "book", "booking", "reserve", "reservation", "ride", "pickup", "pick up", "dropoff", "drop-off",
  "airport", "yeg", "edmonton", "grande prairie", "destination", "quote",
  "price", "pricing", "fare", "rate", "availability", "schedule", "time",
  "date", "passengers", "luggage", "car seat", "flight",
  "executive driving", "chauffeur", "driver", "suv", "fleet", "policy",
  "cancellation", "cancel", "payment", "invoice", "hours", "contact",
  "phone", "email", "area", "service area", "reserve your ride"
];

const GREETINGS = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"];
const HUMAN_INTENT = [
  "talk to a human", "talk to human", "speak to a human", "speak to human",
  "human please", "real person", "agent please", "customer service",
  "representative", "live agent", "operator", "call you", "call someone",
  "can i talk to someone", "connect me to a human", "talk to someone"
];
const NOT_BOOKING_RE = /\b(i (do not|dont|don't) want (to )?book|not booking|no booking|just asking|only info)\b/i;
const POSITIVE_ACK_RE = /\b(nice|great|awesome|perfect|cool|sweet|amazing|love it|sounds good|sounds great|okay|ok|alright|got it|thanks|thank you|appreciate it|cheers|good)\b/i;

/* ---------- Transcript salvage + de-dupe helpers ---------- */
function assistantAlreadySaidOutsideAB(messages = []) {
  return messages.slice(-8).some(m =>
    m.role === "assistant" && /\bappears to be \*\*outside Alberta\*\*/i.test(m.content || "")
  );
}

function salvageFromMessages(messages = []) {
  const fields = {
    name: null, phone: null, email: null, pickup: null, dropoff: null,
    date: null, time: null, passengers: null, luggage: null, notes: null
  };

  let waiting = null;
  const want = (assistantText, key, re) =>
    re.test(assistantText) ? key : null;

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "assistant") {
      const t = (m.content || "").toLowerCase();
      waiting =
        want(t, "name", /\b(full\s+name)\b/) ||
        want(t, "phone", /\b(phone|best phone number)\b/) ||
        want(t, "email", /\b(email)\b/) ||
        want(t, "pickup", /\b(pickup address|what[’']?s the pickup|where.*pickup)\b/) ||
        want(t, "dropoff", /\b(where are we dropping you off|the destination|drop-?off)\b/) ||
        want(t, "date", /\b(what date|service date)\b/) ||
        want(t, "time", /\b(what time|pickup time)\b/) ||
        want(t, "passengers", /\b(how many passengers)\b/) ||
        want(t, "luggage", /\b(luggage)\b/) ||
        want(t, "notes", /\b(notes|flight number)\b/) ||
        waiting;
    } else if (m.role === "user") {
      const u = String(m.content || "").trim();

      // Always try to catch email/phone anywhere
      const em = u.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (em) fields.email = em[0];

      const digits = u.replace(/\D+/g, "");
      if ((digits.length === 10) || (digits.length === 11 && digits.startsWith("1"))) {
        fields.phone = u;
      }

      if (!waiting) continue;

      switch (waiting) {
        case "name":
          if (/^\s*[a-z][a-z\s.'-]{1,40}$/i.test(u)) fields.name = u;
          break;
        case "pickup":
          if (!addressTooVague(u)) fields.pickup = u;
          else if (isAirportName(u)) fields.pickup = u; // allow airport-y
          else if (isNamedPlaceLoose(u)) fields.pickup = u;
          break;
        case "dropoff":
          if (!addressTooVague(u)) fields.dropoff = u;
          else if (isAirportName(u)) fields.dropoff = u;
          else if (isNamedPlaceLoose(u)) fields.dropoff = u;
          break;
        case "date": {
          const parsed = parseDateSmart(u);
          fields.date = parsed?.iso || u;
          break;
        }
        case "time":
          fields.time = u;
          break;
        case "passengers": {
          const n = coercePassengers(u);
          if (n !== null) fields.passengers = n;
          break;
        }
        case "luggage": {
          const l = coerceLuggage(u);
          if (l !== null) fields.luggage = l;
          break;
        }
        case "notes":
          if (!/^(no|none|n\/a|na|nothing)$/i.test(u)) fields.notes = u;
          else fields.notes = "";
          break;
      }
      waiting = null;
    }
  }
  return fields;
}

function mergePreferringAI(ai = {}, fb = {}) {
  const keys = ["name", "phone", "email", "pickup", "dropoff", "date", "time", "passengers", "luggage", "notes"];
  const out = {};
  for (const k of keys) {
    out[k] = (ai[k] !== undefined && ai[k] !== null && ai[k] !== "") ? ai[k] :
      (fb[k] !== undefined && fb[k] !== null && fb[k] !== "") ? fb[k] : null;
  }
  return out;
}

// Conversation wrap-up triggers
const THANKS_CLOSE_RE = /\b(thanks|thank you|appreciate it|cheers|much obliged|gracias|merci|ta|tata)\b/i;
const END_INTENT_RE = /\b(that'?s (all|it)|no (need|more|further)|we(?:'| a)re good|all good|bye|goodbye|see (ya|you)|nothing else|done|finish(?:ed)?)\b/i;
const NO_CLOSE_RE = /\b(nope|no thanks|no thank you|no need|no more|nothing else|nah|all good|we're good|done|finished)\b/i;

function lastAssistantSaidCompanyInfo(messages = []) {
  return messages.slice(-4).some(
    (m) =>
      m.role === "assistant" &&
      /(executive driving.*(private|premium).*chauffeur|airport.*executive.*edmonton|grande\s*prairie)/i.test(
        m.content || ""
      )
  );
}
function lastAssistantCompletedBooking(messages = []) {
  return messages.slice(-4).some(m =>
    m.role === "assistant" &&
    /submitted your reservation|reservation (?:request )?submitted|you(?:’|'|)ll receive a confirmation|confirmation shortly/i.test(m.content || "")
  );
}


/* ---------- STRICT service area helpers (improved) ---------- */
// Postal parsing (Canada-wide)
const POSTAL_RE = /\b([A-Za-z]\d[A-Za-z])[ -]?(\d[A-Za-z]\d)\b/;
// First FSA letter province map (simplified): T=Alberta
function postalRegion(code = "") {
  const m = String(code).toUpperCase().match(POSTAL_RE);
  if (!m) return null;
  const fsa = m[1];
  const provinceLetter = fsa.charAt(0); // T -> Alberta
  return { raw: `${m[1]} ${m[2]}`, fsa, provinceLetter };
}
const EDMONTON_FSA = /^(T5|T6)/;
const GP_FSA = /^(T8V|T8W|T8X)/;

// Airports: Alberta vs non-Alberta (IATA)
const ALBERTA_AIRPORTS = /\b(YEG|YYC|YMM|YQU|YQL|YBW)\b/i;
const NON_AB_IATA = /\b(YYZ|YVR|YUL|YOW|YHZ|YQB|YXE|YQR|YWG|YYJ|YXX|YHM|YKF|YTZ|YQT|YXS|YZF|YXY|YQM)\b/i;

// Alberta service cities
const AB_SERVICE_CITIES = /\b(edmonton|st\.?\s*albert|sherwood\s*park|leduc|nisku|spruce\s*grove|stony\s*plain|fort\s*saskatchewan|grande\s*prairie|clairmont|sexsmith|beaverlodge|hythe)\b/i;

/* ---- STRICT non-AB city detection with exceptions ---- */
const NONAB_EXCEPTIONS = [
  /\blondon\s+drugs\b/i,
  /\brichmond\s+ave\b/i,
  /\brichmond\s+park\b/i
];
const CITIES_NON_AB_STRICT = [
  "\\bvancouver\\b", "\\bsurrey\\b", "\\bburnaby\\b", "\\brichmond\\b", "\\bvictoria\\b", "\\bkelowna\\b", "\\bkamloops\\b", "\\bnanaimo\\b", "\\babbotsford\\b", "\\bcoquitlam\\b", "\\blangley\\b",
  "\\bregina\\b", "\\bsaskatoon\\b", "\\bwinnipeg\\b", "\\bbrandon\\b", "\\bprince\\s*albert\\b",
  "\\btoronto\\b", "\\bmississauga\\b", "\\bbrampton\\b", "\\bottawa\\b", "\\bhamilton\\b", "\\blondon\\b", "\\bkitchener\\b", "\\bwaterloo\\b", "\\bguelph\\b", "\\bmarkham\\b", "\\bvaughan\\b",
  "\\brichmond\\s*hill\\b", "\\bscarborough\\b", "\\bnorth\\s*york\\b", "\\betobicoke\\b", "\\bpickering\\b", "\\bajax\\b", "\\bwhitby\\b", "\\boshawa\\b", "\\bbarrie\\b", "\\bwindsor\\b",
  "\\bkingston\\b", "\\bniagara\\s*falls\\b", "\\bthunder\\s*bay\\b", "\\bsudbury\\b", "\\boakville\\b", "\\bburlington\\b", "\\bmilton\\b",
  "\\bmontreal\\b", "\\bqu[eé]bec\\s*city\\b", "\\blaval\\b", "\\bgatineau\\b", "\\blongueuil\\b", "\\bsherbrooke\\b", "\\btrois-?rivi[eè]res\\b", "\\bsaguenay\\b",
  "\\bmoncton\\b", "\\bsaint\\s*john\\b", "\\bfredericton\\b", "\\bhalifax\\b", "\\bdartmouth\\b", "\\bsydney\\b", "\\bcharlottetown\\b", "\\bst\\.?\\s*john's\\b",
  "\\bwhitehorse\\b", "\\byellowknife\\b", "\\biqaluit\\b"
].join("|");
const NON_AB_HINTS_STRICT = new RegExp(CITIES_NON_AB_STRICT, "i");
function looksNonAlbertaButNotException(txt = "") {
  if (NONAB_EXCEPTIONS.some(rx => rx.test(txt))) return false;
  return NON_AB_HINTS_STRICT.test(txt);
}

/* ---------- Canadian airport + POI recognizers ---------- */
function isCanadianIATA(text = "") { return /\bY[A-Z]{2}\b/.test(String(text).toUpperCase()); }
function isAirportName(text = "") {
  const s = String(text).toLowerCase();
  if (/\bairport\b/.test(s)) return true;
  if (isCanadianIATA(s)) return true;
  return false;
}
function isHotelPOI(text = "") {
  const s = String(text).toLowerCase();
  return /\b(best\s*western|hilton|marriott|sheraton|holiday\s*inn|ramada|sandman|delta\s+hotels?|four\s+points|fairmont|comfort\s+inn|super\s*8|westin|staybridge|courtyard|residence\s+inn|hampton\s+inn|matrix\s+hotel|chateau\s+lacombe|varscona|metterra|coast\s+edmonton|doubletree|days\s*inn|wyndham|travelodge|microtel|spark\s*hotels|tru\s*by\s*hilton)\b/.test(s);
}
function isSpecificLandmark(text = "") {
  const s = String(text).toLowerCase();
  return /\b(west\s+edmonton\s+mall|wem|west\s+ed\s+mall|rogers\s+place|u\s*of\s*a|university\s+of\s+alberta|kingsway\s+mall|southgate\s+centre|macewan\s+university|commonwealth\s+stadium|ice\s+district|fort\s*mcmurray\s+international|ymm)\b/.test(s);
}

/** Drop-off: allow anywhere; just add note if looks outside Alberta */
function dropoffNeedsEscalation(text = "") {
  const s = String(text);
  if (isCanadianIATA(s)) return !ALBERTA_AIRPORTS.test(s);
  if (looksNonAlbertaButNotException(s)) return true;
  if (NON_AB_IATA.test(s)) return true;
  return false;
}
function dropoffEscalationLine(_text = "") {
  return "Drop-off noted. This appears to be **outside Alberta** — we’ll proceed with your booking and inform the team since it’s long-distance. They’ll confirm final details and pricing shortly.";
}

/* ---------- Phone, email, time & address helpers ---------- */
function validPhone(raw = "") {
  const d = String(raw).replace(/\D+/g, "");
  if (d.length === 10) return true;
  if (d.length === 11 && d.startsWith("1")) return true;
  return false;
}
function formatPhone(raw = "") {
  const d = String(raw).replace(/\D+/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    const n = d.slice(1);
    return `+1 (${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  }
  if (d.length === 10) {
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return raw;
}
function validEmail(raw = "") {
  const s = String(raw).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function timeNeedsAmPm(raw = "") {
  const s = String(raw).trim().toLowerCase();
  if (!s) return false;
  if (/\b(am|pm)\b/.test(s)) return false;
  if (/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(s)) return false;
  if (/^\d{1,2}:\d{2}$/.test(s)) return true;
  if (/^\d{1,2}$/.test(s)) return true;
  return false;
}

function normalizeAirportHints(text = "") {
  const s = String(text).toLowerCase();
  if (isAirportName(s)) return null;
  if (/\b(terminal\s*1|t1|terminal\s*2|t2|terminal)\b/.test(s)) {
    return "Please confirm the airport and area — e.g., **Edmonton (YEG) – Arrivals** or **Calgary (YYC) – Domestic**.";
  }
  return null;
}

/* ---------- POSITIVE LOCAL DETECTOR (upgraded with WEM/Rogers) ---------- */
function isClearlyEdmontonOrGP(text = "") {
  const s = String(text).toLowerCase();

  if (/\b(yeg|edm|edmonton|grande\s*prairie|gp|yqu|st\.?\s*albert|sherwood\s*park|leduc|nisku|spruce\s*grove|stony\s*plain|fort\s*saskatchewan|clairmont|sexsmith|beaverlodge|hythe)\b/.test(s)) {
    return true;
  }
  if (/\b(wem|west\s+ed(?:monton)?\s+mall|rogers\s+place)\b/i.test(s)) return true;

  const m = s.match(POSTAL_RE);
  if (m) {
    const fsa = m[1].toUpperCase();
    if (EDMONTON_FSA.test(fsa) || GP_FSA.test(fsa)) return true;
  }

  return false;
}

/* ---------- FLEXIBLE BUT STRICT PLACE VALIDATION (relaxed) ---------- */
function isNamedPlaceLoose(s = "") {
  const clean = String(s || "")
    .replace(/[\u0000-\u001F]/g, " ")
    .replace(/[^\w\s'\-]/g, " ")
    .trim();

  const tokens = clean.split(/\s+/).filter(t => t.length >= 2);
  return tokens.length >= 2;
}

function addressTooVague(raw = "") {
  const s = String(raw || "").trim();
  if (!s || s.length < 3) return true;

  const sl = s.toLowerCase();

  if (/(https?:\/\/|www\.)/i.test(sl) || /@/.test(sl)) return true;
  if (/★|☆|✔|⚡|🔥|💥|✨/.test(sl)) return true;

  if (isClearlyEdmontonOrGP(sl) || isHotelPOI(sl) || isSpecificLandmark(sl) || isAirportName(sl) || POSTAL_RE.test(sl)) {
    return false;
  }

  const hasNum = /\b\d{1,6}[A-Za-z]?\b/.test(sl);
  const hasRoad = /\b(st|street|ave|avenue|rd|road|blvd|boulevard|drive|dr|way|trail|trl|cres|crescent|gate|park|plaza|place|pl|lane|ln|court|ct|terrace|ter|highway|hwy|pkwy|parkway)\b/.test(sl);
  const isXing = /\b(st|street|ave|avenue|rd|road|blvd|drive|dr|way|lane|ln|ct|court|hwy|highway)\b.*\b(&|and|@)\b.*\b(st|street|ave|avenue|rd|road|blvd|drive|dr|way|lane|ln|ct|court|hwy|highway)\b/.test(sl);
  if ((hasNum && hasRoad) || isXing) return false;

  if (/^(airport|mall|downtown|uptown|suburbs|station|centre|center|campus|entrance|gate|hotel)$/i.test(sl)) return true;

  const tokens = sl.split(/\s+/).filter(t => t.length >= 2);
  return tokens.length < 2;
}
function askForPreciseAddress(which = "pickup") {
  if (which === "pickup") {
    return "Could you share the **exact pickup address** (number + street) or a precise place like “Days Inn by Wyndham Edmonton Downtown – Front Entrance” or “YEG – Arrivals”?";
  }
  return "Could you share the **exact drop-off**  either a street address or a place like “Springbank Airport (YBW)” or “YYZ – Terminal 1 Arrivals”?";
}

/* ---------- Conversational helpers ---------- */
function looksAddressy(s = "") {
  const str = s.toLowerCase();
  const hasPlaceWord = /(st\.|street|ave|avenue|rd|road|blvd|drive|dr\.|mall|terminal|airport|hotel|tower|center|centre|station|university|hospital|museum|arena|stadium)/.test(str);
  const hasNumber = /\d{1,5}/.test(str);
  const airportish = /\b(yeg|yyc|yyz|yow|yvr|yul|yxe|yqr|ymm|yqu|yql|ybw)\b/.test(str);
  const cityish = /(edmonton|grande\s*prairie|calgary|fort\s*mcmurray|leduc|st\.?\s*albert|sherwood\s*park)/.test(str);
  const timeish = /\b(\d{1,2}:\d{2}\s*(am|pm)?|\d{1,2}\s*(am|pm))\b/.test(str);
  const dateish = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(\/\d{2,4})?)\b/.test(str);
  return hasPlaceWord || hasNumber || airportish || cityish || timeish || dateish || str.length <= 5;
}
function hadBookingIntentBefore(messages = []) {
  return messages.some(m =>
    m.role === "user" &&
    ALLOWED.some(k => (m.content || "").toLowerCase().includes(k))
  );
}
function assistantAskedForDetail(messages = []) {
  const lastFew = messages.slice(-4);
  const cues = ["name", "email", "phone", "pickup", "destination", "date", "time", "passengers", "luggage", "flight"];
  return lastFew.some(m =>
    m.role === "assistant" &&
    cues.some(c => (m.content || "").toLowerCase().includes(c))
  );
}
function isGreetingOnly(s = "", hasAssistantAlready = false) {
  const msg = s.trim().toLowerCase();
  if (hasAssistantAlready) return false;
  const words = msg.split(/\s+/).filter(Boolean);
  const greetingHit = GREETINGS.some(g => msg === g || msg === g + "!" || msg === g + ".");
  const containsEscalationWord = /\b(human|agent|person|representative|operator|someone|call|phone|email)\b/.test(msg);
  return greetingHit && !containsEscalationWord && words.length <= 3;
}
function firstName(s = "") {
  return String(s).trim().split(/\s+/)[0] || "";
}

/* ---------- Alberta pickup rules ---------- */
function pickupAreaByPostal(text = "") {
  const info = postalRegion(text);
  if (!info) return "none";
  if (info.provinceLetter !== "T") return "nonab"; // non-Alberta Canadian postal
  if (EDMONTON_FSA.test(info.fsa) || GP_FSA.test(info.fsa)) return "in";
  return "ab-out";
}
function inferPickupAreaNoPostal(text = "") {
  const s = String(text).toLowerCase();
  if (looksNonAlbertaButNotException(s)) return "nonab";
  if (ALBERTA_AIRPORTS.test(s)) return "in";
  if (AB_SERVICE_CITIES.test(s) || /\bedmonton|grande\s*prairie|calgary|fort\s*mcmurray|leduc\b/i.test(s)) return "in";
  if (/\balberta\b/i.test(s)) return "ab-out";
  if (NON_AB_IATA.test(s)) return "nonab";
  return "unknown";
}
function pickupHardStopNonAlberta(txt = "") {
  return (
    "Thanks for the details. We currently operate **within Alberta** only (Edmonton & Grande Prairie). " +
    `Your pickup appears to be outside Alberta${txt ? ` (“${txt}”)` : ""}. ` +
    "At the moment we can’t originate there—**we’re expanding soon**. If your trip can start in Edmonton or Grande Prairie, I can quote it right away."
  );
}
function pickupPolitelyDeclineABOut(txt = "") {
  return (
    "Appreciate it. We currently originate service in **Edmonton (T5/T6)** and **Grande Prairie (T8V/T8W/T8X)**. " +
    `That pickup looks outside our core area${txt ? ` (“${txt}”)` : ""}. ` +
    "If you can start in Edmonton or Grande Prairie, I can arrange it; otherwise I’m happy to refer a local provider."
  );
}

/* ---------- Natural date parsing (robust, with typos) ---------- */
function pad2(n) { return String(n).padStart(2, "0"); }
function toISO(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }
function resolveYearFor(month, day, now = new Date()) {
  const y = now.getFullYear();
  const candidate = new Date(y, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (candidate >= today) return y;
  return y + 1;
}
function editDist(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}
const MONTH_ALIASES = {
  jan: 1, january: 1, "januray": 1,
  feb: 2, february: 2, "febuary": 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8, "agust": 8,
  sep: 9, sept: 9, september: 9, "septembar": 9,
  oct: 10, octo: 10, october: 10, "octobre": 10, "octuber": 10, "otober": 10, "ocober": 10, "octber": 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};
const MONTH_NAMES = [
  ["january", 1], ["february", 2], ["march", 3], ["april", 4], ["may", 5], ["june", 6],
  ["july", 7], ["august", 8], ["september", 9], ["october", 10], ["november", 11], ["december", 12],
  ["jan", 1], ["feb", 2], ["mar", 3], ["apr", 4], ["jun", 6], ["jul", 7], ["aug", 8], ["sep", 9], ["sept", 9], ["oct", 10], ["nov", 11], ["dec", 12]
];
function monthFromToken(tok) {
  if (!tok) return null;
  const raw = tok.toLowerCase().replace(/[^a-z]/g, "");
  if (!raw) return null;
  if (MONTH_ALIASES[raw]) return MONTH_ALIASES[raw];
  let best = null;
  for (const [name, num] of MONTH_NAMES) {
    const d = editDist(raw, name);
    if (d <= 2 && (!best || d < best.d)) best = { d, num };
    if (raw.startsWith(name) || name.startsWith(raw)) { return num; }
  }
  return best ? best.num : null;
}

function parseDateSmart(input, now = new Date()) {
  if (!input) return null;

  const s = String(input)
    .trim()
    .toLowerCase()
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[.,!?'"”’)\]]+$/, "");

  const toISO = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const resolveYearForLocal = (month, day) => {
    const y = now.getFullYear();
    const candidate = new Date(y, month - 1, day);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return candidate >= today ? y : y + 1;
  };

  // ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { iso: s };

  // Numeric m/d(/y) or d-m(-y)
  let m;
  if ((m = s.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/))) {
    let a = +m[1], b = +m[2];
    let year = m[3] ? +m[3] : now.getFullYear();
    if (year < 100) year += 2000;
    let month, day;
    if (a >= 1 && a <= 12) { month = a; day = b; } else { month = b; day = a; }
    if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return null;
    if (!m[3]) year = resolveYearForLocal(month, day);
    return { iso: toISO(year, month, day) };
  }

  // tomorrow (typos)
  if (s === "tomorrow" || /^tom+?or+?ow$/.test(s) || /^tomm?or?ro?w$/.test(s) || /^tmrw$/.test(s)) {
    const t = new Date(now.getTime() + 24 * 3600 * 1000);
    return { iso: toISO(t.getFullYear(), t.getMonth() + 1, t.getDate()) };
  }

  // today
  if (s === "today") return { iso: toISO(now.getFullYear(), now.getMonth() + 1, now.getDate()) };

  const parseYearToken = (tok, month, day) => {
    if (!tok) return resolveYearForLocal(month, day);
    let y = String(tok).replace(/^'+/, "");
    y = +y;
    if (y < 100) y += 2000;
    return y;
  };

  // ord-first
  if ((m = s.match(/^(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+([a-z]+)[ ,.-]*(\d{2,4})?$/i))) {
    const day = +m[1];
    const mon = monthFromToken(m[2]);
    if (!mon || day < 1 || day > 31) return null;
    const year = parseYearToken(m[3], mon, day);
    return { iso: toISO(year, mon, day), note: `Got it. I’ll set your date to ${toISO(year, mon, day)}.` };
  }

  // month-first
  if ((m = s.match(/^(?:on\s+)?([a-z]+)[ ,.-]*(\d{1,2})(?:st|nd|rd|th)?[ ,.-]*(\d{2,4})?$/i))) {
    const mon = monthFromToken(m[1]);
    const day = +m[2];
    if (!mon || day < 1 || day > 31) return null;
    const year = parseYearToken(m[3], mon, day);
    return { iso: toISO(year, mon, day), note: `Got it. I’ll set your date to ${toISO(year, mon, day)}.` };
  }

  // fuzzy extraction
  if ((m = s.match(/.*?\b(\d{1,2})(?:st|nd|rd|th)?\b.*?\b([a-z]{3,})\b(?:.*?\b(\d{2,4})\b)?/i))) {
    const day = +m[1];
    const mon = monthFromToken(m[2]);
    if (!mon || day < 1 || day > 31) return null;
    const year = parseYearToken(m[3], mon, day);
    return { iso: toISO(year, mon, day), note: `Got it. I’ll set your date to ${toISO(year, mon, day)}.` };
  }

  // "on the 7th"
  if ((m = s.match(/^(?:on\s+the\s+)?(\d{1,2})(?:st|nd|rd|th)$/))) {
    const day = +m[1];
    if (day < 1 || day > 31) return null;
    const month = now.getMonth() + 1;
    const year = resolveYearForLocal(month, day);
    return { iso: toISO(year, month, day), note: `Got it. I’ll set your date to ${toISO(year, month, day)}.` };
  }

  return null;
}

function userJustMentionedDate(utterance = "") {
  const s = String(utterance).toLowerCase();
  if (/\b(today|tomorrow|next\s+month)\b/.test(s)) return true;
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(s)) return true;
  if (/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(s)) return true;
  if (/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?[a-z]{3,}\b/.test(s)) return true;
  if (/\b[a-z]{3,}\s+\d{1,2}(?:st|nd|rd|th)?\b/.test(s)) return true;
  return false;
}

/* ---------- Health ---------- */
app.get("/health", async (_req, res) => {
  const smtpOK = await transporter.verify().then(() => true).catch(() => false);
  res.status(process.env.OPENAI_API_KEY && smtpOK ? 200 : 500).json({ ok: !!process.env.OPENAI_API_KEY, smtp: smtpOK });
});

/* ---------- Email transporter (Office 365 SMTP) ---------- */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.office365.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,                 // STARTTLS
  requireTLS: true,              // ensure TLS upgrade
  auth: {
    user: process.env.SMTP_USER, // info@executivedriving.ca
    pass: process.env.SMTP_PASS, // 16-char App Password
  },
  tls: { minVersion: "TLSv1.2" },
});

transporter.verify()
  .then(() => console.log("📧 SMTP ready"))
  .catch(err => console.error("SMTP verify failed:", err?.message || err));

const BOOK_TO = process.env.BOOKING_EMAIL_TO;
const BOOK_FROM = process.env.BOOKING_EMAIL_FROM || process.env.SMTP_USER;

/* ---------- Branded Booking Email ---------- */
function renderBookingEmail({ name, phone, email, pickup, dropoff, date, time, passengers, luggage, notes, escalationNote }) {
  const esc = (s = "-") =>
    String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const br = (s = "") => esc(s).replace(/\n/g, "<br>");

  return `
  <div style="font-family:Inter,Arial,sans-serif; max-width:640px; margin:0 auto; border:1px solid #eee; border-radius:12px; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,.12)">
    <div style="background:#0a0b0d; padding:20px; text-align:center;">
      <img src="cid:logo" alt="Executive Driving" style="max-height:80px; margin:0 auto; display:block" />
    </div>
    <div style="padding:24px; background:#fff; color:#111; line-height:1.6;">
      <h2 style="margin:0 0 16px; font-size:20px; color:#0a0b0d;">🚘 New Reservation Request</h2>
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr><td style="padding:6px 0;"><b>Name:</b></td><td>${esc(name)}</td></tr>
        <tr><td style="padding:6px 0;"><b>Phone:</b></td><td>${esc(phone || "")}</td></tr>
        <tr><td style="padding:6px 0;"><b>Email:</b></td><td>${esc(email || "")}</td></tr>
        <tr><td style="padding:6px 0;"><b>Pickup:</b></td><td>${esc(pickup)}</td></tr>
        <tr><td style="padding:6px 0;"><b>Drop-off:</b></td><td>${esc(dropoff)}</td></tr>
        <tr><td style="padding:6px 0;"><b>Date:</b></td><td>${esc(date)}</td></tr>
        <tr><td style="padding:6px 0;"><b>Time:</b></td><td>${esc(time)}</td></tr>
        <tr><td style="padding:6px 0;"><b>Passengers:</b></td><td>${esc(passengers)}</td></tr>
        <tr><td style="padding:6px 0;"><b>Luggage:</b></td><td>${luggage === true ? "Yes" : luggage === false ? "No" : "-"}</td></tr>
      </table>
      ${notes ? `
  <p style="
  margin:24px 0 0; /* increased top margin */
  padding-top:6px; /* extra gap */
  white-space: normal !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
  line-height: 1.6;
">
    <b>Notes:</b><br>${br(notes)}
  </p>
` : ""}

      ${escalationNote ? `<p style="margin:16px 0 0; color:#7a5;"><b>Agent Escalation:</b> ${br(escalationNote)}</p>` : ""}
      <hr style="margin:24px 0; border:none; border-top:1px solid #eee">
      <p style="font-size:13px; color:#555; text-align:center;">
        This request was submitted via the Executive Driving website.<br>
        📞 825-973-9800 &nbsp; | &nbsp; ✉️ info@executivedriving.ca
      </p>
    </div>
    <div style="background:#0a0b0d; padding:14px; text-align:center; font-size:12px; color:#aaa;">
      © ${new Date().getFullYear()} Executive Driving. All rights reserved.
    </div>
  </div>
  `;
}
/* ---------- Customer Confirmation Email (to the client) ---------- */
function renderCustomerConfirmationEmail({ name, pickup, dropoff, date, time, passengers }) {
  const esc = (s = "-") =>
    String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  return `
  <div style="font-family:Inter,Arial,sans-serif; max-width:640px; margin:0 auto; border:1px solid #eee; border-radius:12px; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,.12)">
    <div style="background:#0a0b0d; padding:20px; text-align:center;">
     <img src="cid:logo" alt="Executive Driving" style="max-height:80px; margin:0 auto; display:block" />
    </div>
    <div style="padding:24px; background:#fff; color:#111; line-height:1.6;">
      <h2 style="margin:0 0 10px; font-size:20px;">Thank you${name ? `, ${esc(name)}` : ""}!</h2>

      <p style="margin:0 0 14px;">
       <strong>
        Your booking request with <b>Executive Driving</b> has been received.
        We’ll review availability and send a final confirmation shortly.
        </strong>
      </p>

      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr><td style="padding:6px 0;"><b>Pickup:</b></td><td>${esc(pickup)}</td></tr>
        <tr><td style="padding:6px 0;"><b>Drop-off:</b></td><td>${esc(dropoff)}</td></tr>
        <tr><td style="padding:6px 0;"><b>Date:</b></td><td>${esc(date)}</td></tr>
        <tr><td style="padding:6px 0;"><b>Time:</b></td><td>${esc(time)}</td></tr>
        <tr><td style="padding:6px 0;"><b>Passengers:</b></td><td>${esc(passengers)}</td></tr>
      </table>

      <p style="margin:18px 0 0; font-size:15px; font-weight:600; color:#000;">
        We wish you a pleasant ride with Executive Driving.
      </p>

      <hr style="margin:20px 0; border:none; border-top:1px solid #eee">
      <p style="font-size:13px; color:#555;">
        Executive Driving — Edmonton & Grande Prairie<br>
        📞 825-973-9800 &nbsp; | &nbsp; ✉️ info@executivedriving.ca
      </p>
    </div>
    <div style="background:#0a0b0d; padding:14px; text-align:center; font-size:12px; color:#aaa;">
      © ${new Date().getFullYear()} Executive Driving. All rights reserved.
    </div>
  </div>
  `;
}
/* ---------- Branded Concierge Email ---------- */
function renderConciergeEmail({ name, phone, email, date, details }) {
  const esc = (s = "-") =>
    String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const br = (s = "") => esc(s).replace(/\n/g, "<br>");

  return `
  <div style="font-family:Inter,Arial,sans-serif; max-width:640px; margin:0 auto; border:1px solid #eee; border-radius:12px; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,.12)">
    <div style="background:#0a0b0d; padding:20px; text-align:center;">
      <img src="cid:logo" alt="Executive Driving" style="max-height:80px; margin:0 auto; display:block" />
    </div>
    <div style="padding:24px; background:#fff; color:#111; line-height:1.6;">
      <h2 style="margin:0 0 16px; font-size:20px; color:#0a0b0d;"> New Client Care Request</h2>
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr><td style="padding:6px 0;"><b>Name:</b></td><td>${esc(name)}</td></tr>
        <tr><td style="padding:6px 0;"><b>Phone:</b></td><td>${esc(phone)}</td></tr>
        <tr><td style="padding:6px 0;"><b>Email:</b></td><td>${esc(email)}</td></tr>
        <tr><td style="padding:6px 0;"><b>Requested Date:</b></td><td>${esc(date)}</td></tr>
      </table>
      ${details ? `<p style="margin:16px 0 0;"><b>Details:</b><br>${br(details)}</p>` : ""}
      <hr style="margin:24px 0; border:none; border-top:1px solid #eee">
      <p style="font-size:13px; color:#555; text-align:center;">
        Submitted via the Executive Driving website (Client Care section).
      </p>
    </div>
    <div style="background:#0a0b0d; padding:14px; text-align:center; font-size:12px; color:#aaa;">
      © ${new Date().getFullYear()} Executive Driving. All rights reserved.
    </div>
  </div>
  `;
}


/* ---------- Helper: send customer confirmation ---------- */
async function sendCustomerConfirmationEmail({ name, pickup, dropoff, date, time, passengers, email }) {
  if (!email || !validEmail(email)) return;
  const subject = `Your Executive Driving booking request — ${date} ${time}`;
  const html = renderCustomerConfirmationEmail({ name, pickup, dropoff, date, time, passengers });
  await transporter.sendMail({
    to: email,
    from: BOOK_FROM,
    subject,
    html,
    attachments: [
      { filename: "logo-email.png", path: LOGO_PATH, cid: "logo" }
    ],
  });
}

/* ---------- Booking endpoint (popup form) ---------- */
/* ---------- Booking + Concierge endpoint ---------- */
app.post("/book", async (req, res) => {
  try {
    const { type } = req.body || {};

    // --- Concierge form branch ---
    if (type === "concierge") {
      const { name, phone, email, date, details } = req.body || {};
      if (!name || !phone || !email || !date) {
        return res.status(400).json({ ok: false, error: "Missing required concierge fields" });
      }
      if (!BOOK_TO) return res.status(500).json({ ok: false, error: "Server misconfig: BOOKING_EMAIL_TO not set" });

      const subject = `Client Care Request — ${name}`;
      await transporter.sendMail({
        to: BOOK_TO,
        from: BOOK_FROM,
        replyTo: email,
        subject,
        html: renderConciergeEmail({ name, phone, email, date, details }),
        attachments: [{ filename: "logo-email.png", path: LOGO_PATH, cid: "logo" }],
      });

      return res.json({ ok: true });
    }

    // --- Existing booking branch (your old code stays the same) ---
    const { name, phone, email, pickup, dropoff, date, time, passengers, notes } = req.body || {};
    const required = ["name", "phone", "email", "pickup", "dropoff", "date", "time", "passengers"];
    const missing = required.filter((k) => !req.body?.[k]);
    if (missing.length) return res.status(400).json({ ok: false, error: `Missing: ${missing.join(", ")}` });
    if (!BOOK_TO) return res.status(500).json({ ok: false, error: "Server misconfig: BOOKING_EMAIL_TO not set" });

    const subject = `🚘 Booking: ${pickup} → ${dropoff} • ${date} ${time} • ${name}`;
    await transporter.sendMail({
      to: BOOK_TO,
      from: BOOK_FROM,
      replyTo: email,
      subject,
      html: renderBookingEmail({
        name,
        phone: formatPhone(phone),
        email,
        pickup,
        dropoff,
        date,
        time,
        passengers,
        luggage: null,
        notes
      }),
      attachments: [{ filename: "logo-email.png", path: LOGO_PATH, cid: "logo" }],
    });

    try {
      await sendCustomerConfirmationEmail({ name, pickup, dropoff, date, time, passengers, email });
    } catch (e) {
      console.error("customer confirmation failed:", e?.message || e);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("book error:", err);
    return res.status(500).json({ ok: false, error: "Email send failed." });
  }
});

/* ---------- Chat → email helpers ---------- */
const AFFIRM_RE = /^(y|ye|yes|yup|yeah|yes please|please confirm|confirm|lock it in|go ahead|book it|book now|sounds good|do it|yes sir|yessir)\b/i;

const FIELD_PROMPTS = {
  name: "your full name",
  phone: "your phone number",
  email: "your email address",
  pickup: "the pickup address",
  dropoff: "the destination",
  date: "the service date",
  time: "the pickup time",
  passengers: "how many passengers will travel",
  luggage: "whether you’ll have luggage",
};

// ---- Robust coercion helpers ----
function coerceLuggage(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;

  if (/^(y|yes|yeah|yep|yup|sure|true|ok|okay)$/i.test(s)) return true;
  if (/^(n|no|nope|nah|false)$/i.test(s)) return false;

  const n = parseInt(s.replace(/[^\d-]/g, ""), 10);
  if (!Number.isNaN(n)) return n > 0;

  return null;
}
function coercePassengers(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().toLowerCase();
  const n = parseInt(s.replace(/[^\d-]/g, ""), 10);
  if (!Number.isNaN(n) && n > 0 && n < 100) return n;
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  if (s in words) return words[s];
  return null;
}
function missingFields(f = {}) {
  const order = ["name", "phone", "email", "pickup", "dropoff", "date", "time", "passengers", "luggage"];
  return order.filter(k => {
    if (k === "passengers") return !(+f.passengers > 0);
    if (k === "luggage") return !(typeof f.luggage === "boolean");
    return !f?.[k];
  });
}
function invalidReason(fields = {}) {
  if ("luggage" in fields && typeof fields.luggage !== "boolean") {
    fields.luggage = coerceLuggage(fields.luggage);
  }
  if ("passengers" in fields && (fields.passengers === null || isNaN(+fields.passengers))) {
    const p = coercePassengers(fields.passengers);
    if (p !== null) fields.passengers = p;
  }

  if (fields.phone && !validPhone(fields.phone)) {
    return { key: "phone", msg: "❌ Please provide a valid Canadian/US phone number (10 digits with area code; 11 digits allowed if it starts with 1). Numbers only are fine." };
  }
  if (fields.email && !validEmail(fields.email)) {
    return { key: "email", msg: "❌ Please provide a valid email address (e.g., you@company.com)." };
  }
  if (fields.time && timeNeedsAmPm(fields.time)) {
    return { key: "time", msg: "❌ Please clarify the time — is that **AM or PM**?" };
  }
  if (fields.pickup && addressTooVague(fields.pickup)) {
    return { key: "pickup", msg: "❌ " + askForPreciseAddress("pickup") };
  }
  if (fields.dropoff && addressTooVague(fields.dropoff)) {
    return { key: "dropoff", msg: "❌ " + askForPreciseAddress("dropoff") };
  }
  if (fields.pickup) {
    const airportHint = normalizeAirportHints(fields.pickup);
    if (airportHint) return { key: "pickup", msg: "❌ " + airportHint };
  }
  if (fields.dropoff) {
    const airportHint = normalizeAirportHints(fields.dropoff);
    if (airportHint) return { key: "dropoff", msg: "❌ " + airportHint };
  }

  if (fields.date) {
    const raw = String(fields.date).trim();
    const numericOk = /^(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)$/.test(raw);
    if (!numericOk) {
      const parsed = parseDateSmart(raw);
      if (!parsed) {
        return { key: "date", msg: "❌ Please clarify the date — try 2025-10-26, 10/26/2025, or say “26th October”. " };
      } else {
        fields.date = parsed.iso;
        fields.__dateNote = parsed.note || null;
      }
    }
  }

  return null;
}

/* ---------- Google Geocoding helpers ---------- */
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

async function geocodePlace(q) {
  if (!GOOGLE_KEY) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", q);
  url.searchParams.set("key", GOOGLE_KEY);

  const r = await fetch(url, { method: "GET" });
  const data = await r.json();
  if (data.status !== "OK" || !data.results?.length) return null;

  const top = data.results[0];
  const comp = {};
  for (const c of top.address_components) {
    for (const t of c.types) comp[t] = c.long_name;
  }
  return {
    formatted: top.formatted_address,
    location: top.geometry?.location || null,
    components: comp,
    raw: top
  };
}
function isInAlberta(components = {}) {
  const prov = (components.administrative_area_level_1 || "").toLowerCase();
  const country = (components.country || "").toLowerCase();
  return country.includes("canada") && (prov.includes("alberta") || prov === "ab");
}
function isInServiceCities(components = {}) {
  const city = (components.locality || components.postal_town || components.sublocality || "").toLowerCase();
  return /\b(edmonton|grande prairie|st\.?\s*albert|sherwood park|leduc|nisku|spruce grove|stony plain|fort saskatchewan|clairmont|sexsmith|beaverlodge|hythe)\b/.test(city);
}

/* ---------- AI extract structured info ---------- */
async function extractBookingWithAI(messages = []) {
  try {
    const transcript = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
    const sys = `
You extract booking details from a chat. Output ONLY JSON (no prose, no code fences) exactly like:
{"name":null,"phone":null,"email":null,"pickup":null,"dropoff":null,"date":null,"time":null,"passengers":null,"luggage":null,"notes":null}
Rules:
- Use the user's own words for date/time if not exact (e.g., "tomorrow", "11 pm").
- passengers: number or null.
- luggage: true/false/null.
- If a field is unknown, set it to null. Do NOT invent values.
`.trim();

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 200,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: transcript }
      ]
    });

    let text = (r.choices?.[0]?.message?.content || "").trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    }
    const brace = text.match(/\{[\s\S]*\}/);
    if (brace) text = brace[0];

    try {
      const obj = JSON.parse(text);
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
      console.error("extractBookingWithAI JSON parse failed:", e?.message || e, "raw:", text);
      return {};
    }
  } catch (err) {
    console.error("OpenAI extract error:", err?.message || err);
    return {};
  }
}

async function sendBookingEmailFromChat(fields) {
  if (!BOOK_TO) throw new Error("BOOKING_EMAIL_TO not set");
  const subject = `🚘 Booking: ${fields.pickup} → ${fields.dropoff} • ${fields.date} ${fields.time} • ${fields.name || "Client"}`;

  const html = renderBookingEmail({
    ...fields,
    phone: formatPhone(fields.phone || ""),
    escalationNote: fields.__dropoffEscalationNote || ""
  });

  await transporter.sendMail({
    to: BOOK_TO,
    from: BOOK_FROM,
    replyTo: fields.email || undefined,
    subject,
    html,
    attachments: [
      { filename: "logo-email.png", path: LOGO_PATH, cid: "logo" }
    ],
  });

  try {
    await sendCustomerConfirmationEmail({
      name: fields.name || "Guest",
      pickup: fields.pickup,
      dropoff: fields.dropoff,
      date: fields.date,
      time: fields.time,
      passengers: fields.passengers,
      email: fields.email
    });
  } catch (e) {
    console.error("chat: customer confirmation failed:", e?.message || e);
  }
}

/* ---------- NEW: helper to avoid repeating the long-distance line ---------- */
function dropoffEscAlreadyShown(messages = []) {
  return messages.slice(-8).some(m =>
    m.role === "assistant" &&
    /outside Alberta/i.test(m.content || "") &&
    /we[’']ll proceed with your booking/i.test(m.content || "")
  );
}

/* ---------- Chat (keeps your voice) ---------- */
app.post("/chat", async (req, res) => {
  try {
    const incoming = Array.isArray(req.body?.messages) ? req.body.messages : null;
    const single = typeof req.body?.message === "string" ? req.body.message : "";
    const base = incoming?.length ? incoming : (single ? [{ role: "user", content: single }] : []);
    const messages = base.slice(-20);

    const lastUserRaw = (messages.slice().reverse().find(m => m.role === "user")?.content || "").trim();
    const lastUser = lastUserRaw.toLowerCase();

    /* 0) If user explicitly says they're NOT booking, stop the booking flow */
    if (NOT_BOOKING_RE.test(lastUser)) {
      return res.json({ reply: "All good no booking. I’m here for info too: pricing, routes, service area, vehicles, or policies. What would you like to know?" });
    }

    /* 0a) Conversation wrap-up: thanks / bye / no */
    /* 0a) Conversation wrap-up: thanks / bye / no */
    if (THANKS_CLOSE_RE.test(lastUser) || END_INTENT_RE.test(lastUser) || NO_CLOSE_RE.test(lastUser)) {
      // If booking was just completed, keep it soft
      if (lastAssistantCompletedBooking(messages)) {
        return res.json({
          reply: "All set, Your booking is confirmed. Thank You, I’ll stay here if you need anything else."
        });
      }
      // Otherwise, generic polite reply
      return res.json({
        reply: "Thanks, I’m here if you need anything else."
      });
    }


    /* 0b) On confirm: collect anything missing, then email */
    if (AFFIRM_RE.test(lastUser)) {
      try {
        const ai = await extractBookingWithAI(messages);
        const fb = salvageFromMessages(messages);
        let extracted = mergePreferringAI(ai, fb);

        // coerce
        extracted.luggage = coerceLuggage(extracted.luggage);
        extracted.passengers = coercePassengers(extracted.passengers);

        // date normalize
        if (extracted.date) {
          const parsed = parseDateSmart(extracted.date);
          if (parsed?.iso) {
            extracted.date = parsed.iso;
            extracted.__dateNote = null;
          }
        }

        // --- PICKUP authoritative check ---
        if (extracted.pickup) {
          const geo = await geocodePlace(extracted.pickup);
          if (geo) {
            if (!isInAlberta(geo.components)) {
              return res.json({ reply: pickupHardStopNonAlberta(geo.formatted), done: true });
            }
            if (!isInServiceCities(geo.components)) {
              return res.json({ reply: pickupPolitelyDeclineABOut(geo.formatted) });
            }
            extracted.pickup = geo.formatted;
          } else {
            if (!isClearlyEdmontonOrGP(extracted.pickup)) {
              const nonAB = looksNonAlbertaButNotException(extracted.pickup) || NON_AB_IATA.test(extracted.pickup);
              if (nonAB) {
                return res.json({ reply: pickupHardStopNonAlberta(extracted.pickup), done: true });
              }
              if (addressTooVague(extracted.pickup)) {
                return res.json({ reply: "OOPSI! Could you share the **exact pickup address** (number + street) or a precise place like “Days Inn by Wyndham Edmonton Downtown – Front Entrance” or “YEG – Arrivals”?" });
              }
            }
          }
        }

        // Non-blocking dropoff escalation (avoid repeating the same line)
        let addEscalation = "";
        if (
          extracted.dropoff &&
          dropoffNeedsEscalation(String(extracted.dropoff)) &&
          !assistantAlreadySaidOutsideAB(messages)
        ) {
          addEscalation = "\n\n" + dropoffEscalationLine(extracted.dropoff);
          extracted.__dropoffEscalationNote = dropoffEscalationLine(extracted.dropoff);
        }

        // Validate & ask only what’s truly missing
        const bad = invalidReason(extracted);
        if (bad) return res.json({ reply: bad.msg });

        const miss = missingFields(extracted);
        if (miss.length) {
          const next = miss[0];
          const fname = firstName(extracted.name || "");
          return res.json({
            reply:
              `No problem${fname ? `, ${fname}` : ""} — just need ${FIELD_PROMPTS[next]} to finalize.`
          });
        }

        // Luggage default if still null
        if (extracted.luggage == null) {
          return res.json({ reply: "Will you have luggage? (Yes/No is perfect.)" });
        }

        await sendBookingEmailFromChat(extracted);
        const reply =
          `Thank you${extracted.name ? `, ${extracted.name}` : ""}! I’ve submitted your reservation.\n` +
          `Pickup: ${extracted.pickup} → ${extracted.dropoff}\n` +
          `Date/Time: ${extracted.date} ${extracted.time}\n` +
          `Passengers: ${extracted.passengers}${extracted.luggage === true ? " • Luggage noted" : ""}.` +
          (addEscalation || "") +
          `\nYou’ll receive a confirmation shortly. Anything else I can arrange?`;
        return res.json({ reply });

      } catch (e) {
        console.error("chat booking email failed:", e);
        return res.json({
          reply:
            "I’ve captured your details. There was a hiccup submitting the confirmation just now, but **your request is safe**. " +
            "I’ll escalate this to an agent to finalize and email you the confirmation shortly."
        });
      }
    }

    /* 1) Human escalation */
    const wantsHuman = HUMAN_INTENT.some(p => lastUser.includes(p)) ||
      (/\bhuman\b/.test(lastUser) && /\b(talk|speak|call|connect|someone)\b/.test(lastUser));
    if (wantsHuman) {
      return res.json({
        reply:
          "No problem! I can loop in a team member. Fastest options: call 825-973-9800 or email info@executivedriving.ca. " +
          "If you’d like, share your name and number and I’ll have someone reach out. Meanwhile, what’s the pickup and destination?"
      });
    }

    /* 1b) Acknowledgements / small talk */
    if (POSITIVE_ACK_RE.test(lastUser)) {
      if (lastAssistantCompletedBooking(messages)) {
        return res.json({ reply: "You’re welcome! If you need any further assistance, I’m here to help." });
      }
      const inFlow = hadBookingIntentBefore(messages) || assistantAskedForDetail(messages);
      const justExplainedCompany = lastAssistantSaidCompanyInfo(messages);
      const nextStep = inFlow
        ? "Great,shall we lock it in? What’s your full name?"
        : (justExplainedCompany
          ? "Glad that helps. Want a quick quote? Share pickup, destination, date & time."
          : "Awesome. If you’re ready, share pickup, destination, date & time and I’ll quote it.");
      return res.json({ reply: `Thanks! ${nextStep}` });
    }

    /* 2) Greeting-only */
    const hasAssistantAlready = messages.some(m => m.role === "assistant");
    if (isGreetingOnly(lastUser, hasAssistantAlready)) {
      return res.json({ reply: "Hi, I’m NAVI. Welcome to Executive Driving. How can I help you today?" });
    }

    /* 2b) General question → KB first, else friendly answer */
    if (/\?$/.test(lastUserRaw) || /\b(what|who|where|when|why|how|price|pricing|rate|area|service)\b/i.test(lastUserRaw)) {
      const kb = loadKB();
      const kbAns = findKBAnswer(lastUserRaw || "", kb);
      if (kbAns) {
        learnQnA(lastUserRaw, kbAns);
        return res.json({ reply: kbAns + "\n\nWould you like me to set up a booking? If so, what’s your pickup and destination?" });
      }
      return res.json({
        reply:
          "We’re a premium SUV chauffeur service for airport and executive travel in Edmonton & Grande Prairie — discreet, professional, on time. " +
          "If you’d like a quote, share your pickup, destination, date & time and I’ll set it up."
      });
    }

    /* 3) Booking intent → start flow */
    const hasBookingIntent = (t) =>
      /\b(book(ing)?|reserve|reservation|ride|pick(?:\s|-)?up)\b/i.test(t) && !/[?]\s*$/.test(t);
    if (hasBookingIntent(lastUser) && !assistantAskedForDetail(messages)) {
      return res.json({ reply: "Absolutely happy to arrange that. What’s your full name?" });
    }

    /* 4) Allowance check / fallback KB */
    const keywordAllowed = ALLOWED.some(k => lastUser.includes(k));
    const inFlow = hadBookingIntentBefore(messages) || assistantAskedForDetail(messages);
    const addressLike = looksAddressy(lastUser);

    const kb = loadKB();
    const kbAns = findKBAnswer(lastUserRaw || "", kb);
    if (!(keywordAllowed || inFlow || addressLike)) {
      if (kbAns) return res.json({ reply: kbAns + "\n\nIf you’re ready, share pickup, destination, date & time." });
      return res.json({
        reply:
          "Executive Driving is a premium SUV chauffeur service for airport and executive travel in Edmonton & Grande Prairie. " +
          "If you’re ready, share pickup, destination, date & time and I’ll get you a quote."
      });
    }

    /* 5) Parse + validate what we have, then ask next missing field */
    const aiNow = await extractBookingWithAI(messages);      // LLM guess
    const fbNow = salvageFromMessages(messages);             // deterministic, last user answers
    const extractedNow = mergePreferringAI(aiNow, fbNow);    // <- prefer the user’s latest message

    extractedNow.luggage = coerceLuggage(extractedNow.luggage);
    extractedNow.passengers = coercePassengers(extractedNow.passengers);

    // Normalize date; only show note if the latest message mentioned a date
    if (extractedNow.date) {
      const parsed = parseDateSmart(extractedNow.date);
      if (parsed?.iso) {
        extractedNow.__dateNote = userJustMentionedDate(lastUserRaw) ? (parsed.note || `Got it I’ll set your date to ${parsed.iso}.`) : null;
        extractedNow.date = parsed.iso;
      }
    }

    // --- PICKUP authoritative check ---
    if (extractedNow.pickup) {
      const geo = await geocodePlace(extractedNow.pickup);
      if (geo) {
        if (!isInAlberta(geo.components)) return res.json({ reply: pickupHardStopNonAlberta(geo.formatted) });
        if (!isInServiceCities(geo.components)) return res.json({ reply: pickupPolitelyDeclineABOut(geo.formatted) });
        extractedNow.pickup = geo.formatted;
      } else {
        const txt = String(extractedNow.pickup || "");
        if (!isClearlyEdmontonOrGP(txt)) {
          const nonAB = looksNonAlbertaButNotException(txt) || NON_AB_IATA.test(txt);
          if (nonAB) return res.json({ reply: pickupHardStopNonAlberta(txt) });
          if (addressTooVague(txt)) return res.json({ reply: "❌ Could you share the **exact pickup address** (number + street) or a precise place like “Days Inn by Wyndham Edmonton Downtown – Front Entrance” or “YEG – Arrivals”?" });
        }
      }
    }

    // Determine next field (for one-shot date note placement)
    const missNow = missingFields(extractedNow);
    const nextField = missNow[0];

    // Non-blocking dropoff escalation hint — show once
    let nextPromptPrefix = "";
    if (
      extractedNow.dropoff &&
      dropoffNeedsEscalation(String(extractedNow.dropoff)) &&
      !assistantAlreadySaidOutsideAB(messages)
    ) {
      const escLine = dropoffEscalationLine(extractedNow.dropoff);
      nextPromptPrefix += escLine + "\n\n";
      extractedNow.__dropoffEscalationNote = escLine;
    }

    if (extractedNow.__dateNote && nextField === "time") {
      nextPromptPrefix += extractedNow.__dateNote + "\n\n";
      delete extractedNow.__dateNote;
    }

    const badNow = invalidReason(extractedNow);
    if (badNow) {
      return res.json({ reply: badNow.msg });
    }

    if (missNow.length) {
      const next = missNow[0];
      const fname = firstName(extractedNow.name || "");
      const tailored =
        next === "phone" ? `Great${fname ? `, ${fname}` : ""}. what’s the best phone number for confirmation ?` :
          next === "email" ? `Thanks${fname ? `, ${fname}` : ""}. What’s the best email for your confirmation, Please ?` :
            next === "pickup" ? "Got it. What’s the pickup address?" :
              next === "dropoff" ? "Thanks. Where are we dropping you off?" :
                next === "date" ? "What date do you need the service?" :
                  next === "time" ? "What time should we pick you up? Please include AM/PM." :
                    next === "passengers" ? "How many passengers will be traveling?" :
                      next === "luggage" ? "Will you have luggage? (Yes/No is perfect.)" :
                        `Could you share ${FIELD_PROMPTS[next]}?`;
      return res.json({ reply: (nextPromptPrefix ? nextPromptPrefix : "") + tailored });
    }

    //  No fields missing and no validation errors → submit automatically
    try {
      await sendBookingEmailFromChat(extractedNow);
      const reply =
        `Thank you${extractedNow.name ? `, ${extractedNow.name}` : ""}! I’ve submitted your reservation.\n` +
        `Pickup: ${extractedNow.pickup} → ${extractedNow.dropoff}\n` +
        `Date/Time: ${extractedNow.date} ${extractedNow.time}\n` +
        `Passengers: ${extractedNow.passengers}${extractedNow.luggage === true ? " • Luggage noted" : ""}.` +
        (extractedNow.__dropoffEscalationNote ? `\n\n${extractedNow.__dropoffEscalationNote}` : "") +
        `\nYou’ll receive a confirmation shortly. Anything else I can arrange?`;
      return res.json({ reply });
    } catch (e) {
      console.error("auto-submit failed:", e?.message || e);
      return res.json({
        reply:
          "I’ve captured your details. There was a hiccup submitting just now, but **your request is safe**. " +
          "I’ll escalate this to an agent to finalize and email you the confirmation shortly."
      });
    }

  } catch (err) {
    console.error("chat error (outer):", err);
    return res.status(500).json({ reply: "Sorry, something went wrong on my side. Could you try again?" });
  }
});

/* ---------- Dev KB tools (optional) ---------- */
app.get("/kb", (_req, res) => {
  try {
    const kb = loadKB();
    return res.json(kb);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load KB" });
  }
});
app.post("/kb/reset", (_req, res) => {
  try {
    const fresh = { items: [...FAQ_SEED] };
    saveKB(fresh);
    return res.json({ ok: true, reset: fresh });
  } catch (err) {
    return res.status(500).json({ error: "Failed to reset KB" });
  }
});

/* ---------- Express error handler (last) ---------- */
app.use((err, _req, res, _next) => {
  console.error("Express error handler:", err);
  if (!res.headersSent) {
    res.status(500).json({ reply: "Whoops,there was a hiccup on my side. Let’s continue your booking—what’s the pickup and destination?" });
  }
});

/* ---------- Start ---------- */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚖 Concierge running on http://localhost:${PORT}`));
