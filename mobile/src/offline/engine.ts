/*
 * On-device engine for CyberShield AI (React Native / Expo edition).
 * Provides on-device scanning rules, threat checks, Cyber Score calculation,
 * analytics, and the local AI assistant with ZERO internet connection required.
 * Accounts, history, and scam reports are securely persisted using AsyncStorage.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export class ApiError extends Error {
  status: number;
  constructor(msg: string, status = 400) {
    super(msg);
    this.status = status;
  }
}

export type Verdict = "safe" | "suspicious" | "dangerous";
export type Status = "ok" | "warn" | "bad" | "na";
export type Check = { name: string; status: Status; detail: string };
export type Item = { name: string; points: number };

/* ---------- Rule datasets ---------- */
const BRANDS = [
  "google","facebook","paypal","amazon","apple","microsoft","netflix","instagram","whatsapp","youtube","linkedin",
  "twitter","github","gmail","flipkart","paytm","phonepe","sbi","hdfcbank","icicibank","axisbank","irctc","amazonaws","outlook"
];
const SHORT = new Set(["bit.ly","tinyurl.com","t.co","goo.gl","is.gd","cutt.ly","rb.gy","ow.ly","shorturl.at"]);
const BAD_TLDS = new Set(["zip","mov","xyz","top","click","gq","tk","ml","cf","ga","work","support","country","rest","icu","buzz"]);
const KW = ["login","verify","secure","account","update","bank","wallet","confirm","password","free","gift","kyc","reward","signin","billing"];
const SMS_KW = ["urgent","immediately","blocked","suspended","verify","kyc","otp","winner","won","prize","claim","refund","click","expire","limited","act now"];
const IPRE = /^\d{1,3}(\.\d{1,3}){3}$/;
const URL_FIND = /(?:https?:\/\/|www\.)[^\s]+|\b[a-z0-9-]+\.(?:com|net|org|in|xyz|top|click|tk|ml|ly|co)\b[^\s]*/gi;
const URL_START = /^(?:https?:\/\/|www\.)[^\s]+|^\b[a-z0-9-]+\.(?:com|net|org|in|xyz|top|click|tk|ml|ly|co)\b[^\s]*/i;

const NAMES: Record<string, string> = {
  protocol: "Connection security",
  domain: "Domain analysis",
  similarity: "Brand similarity",
  structure: "URL structure",
  keywords: "Suspicious keywords",
  wording: "Scam wording",
  links: "Embedded links",
  otp: "OTP request",
  money: "Money request",
  payload: "QR payload type"
};

const REC: Record<Verdict, string> = {
  safe: "No major risks found, but stay alert. Never enter passwords or OTPs unless you typed the address yourself.",
  suspicious: "Be careful. Don't enter personal details or pay anything until you verify this through an official app or website.",
  dangerous: "Do not open this, reply, or enter personal information. Delete it, and report it if it pretends to be a bank or service.",
};

const CATS = ["phishing","lottery","kyc_bank","upi_qr","parcel","job","investment","other"];

/* ---------- Rounding & Helpers ---------- */
const pyRound = (x: number): number => {
  const f = Math.floor(x), d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
};
const clamp = (x: number): number => Math.max(0, Math.min(100, pyRound(x)));
const verdictOf = (s: number): Verdict => (s < 30 ? "safe" : s < 60 ? "suspicious" : "dangerous");
const collapse = (s: string) => s.replace(/(.)\1+/g, "$1");

/* SequenceMatcher equivalent */
function matchCount(a: string, b: string): number {
  let total = 0;
  const rec = (alo: number, ahi: number, blo: number, bhi: number) => {
    let bi = alo, bj = blo, bk = 0;
    for (let i = alo; i < ahi; i++) {
      for (let j = blo; j < bhi; j++) {
        let k = 0;
        while (i + k < ahi && j + k < bhi && a[i + k] === b[j + k]) k++;
        if (k > bk) { bi = i; bj = j; bk = k; }
      }
    }
    if (bk === 0) return;
    total += bk;
    rec(alo, bi, blo, bj);
    rec(bi + bk, ahi, bj + bk, bhi);
  };
  rec(0, a.length, 0, b.length);
  return total;
}
const ratio = (a: string, b: string) => (a.length + b.length === 0 ? 1 : (2 * matchCount(a, b)) / (a.length + b.length));

function brandLookalike(host: string): { sim: number; brand: string | null; kind: "typo" | "subdomain" | "hyphen" | null } {
  const parts = host.split(".");
  const core = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  if (BRANDS.includes(core)) return { sim: 0, brand: core, kind: null };
  let best = 0, bb: string | null = null;
  for (const b of BRANDS) {
    const s = Math.max(ratio(core, b), ratio(collapse(core), collapse(b)) - 0.02);
    if (s > best) { best = s; bb = b; }
  }
  if (best >= 0.8 && core.length >= 4) return { sim: best, brand: bb, kind: "typo" };
  const head = parts.slice(0, -2);
  for (const b of BRANDS) {
    if (head.includes(b)) return { sim: 0.9, brand: b, kind: "subdomain" };
    if (core.includes(b) && core.includes("-")) return { sim: 0.85, brand: b, kind: "hyphen" };
  }
  return { sim: best, brand: bb, kind: null };
}

/* ---------- Scoring accumulators ---------- */
class Acc {
  pts: Record<string, number> = {};
  why: string[] = [];
  flags: string[] = [];
  add(cat: string, points: number, msg?: string) {
    this.pts[cat] = (this.pts[cat] ?? 0) + points;
    if (msg) this.why.push(msg);
  }
  total(): number { return clamp(Object.values(this.pts).reduce((a, b) => a + b, 0)); }
}

export function urlRules(raw: string): { acc: Acc; host: string } {
  const a = new Acc();
  let t = raw.trim();
  if (!/^[a-z]+:\/\//i.test(t)) t = "http://" + t;
  const scheme = (/^([a-z]+):/i.exec(t)?.[1] ?? "").toLowerCase();
  const rest = t.slice(t.indexOf("//") + 2);
  const hasAt = rest.split("/")[0].includes("@");
  const authority = (/^[^/?#]*/.exec(rest)?.[0] ?? "");
  const host = (authority.split("@").pop() ?? "").replace(/:\d*$/, "").toLowerCase();
  if (!host) { a.add("domain", 80, "Could not read a valid host name"); return { acc: a, host }; }
  if (scheme !== "https") a.add("protocol", 15, "Connection is not encrypted (no HTTPS)");
  if (IPRE.test(host)) a.add("domain", 35, "Uses a raw IP address instead of a domain");
  if (SHORT.has(host)) a.add("domain", 25, "Link shortener hides the real destination");
  const tld = host.split(".").pop() ?? "";
  if (BAD_TLDS.has(tld)) a.add("domain", 20, `Domain ending .${tld} is frequently abused`);
  if (hasAt) a.add("structure", 30, "Contains '@' which can disguise the real host");
  if (host.startsWith("xn--") || host.includes(".xn--")) a.add("domain", 30, "Punycode domain may imitate a trusted brand");
  if (host.split(".").length - 1 >= 4) a.add("structure", 15, "Unusually many sub-domains");
  if (host.split("-").length - 1 >= 3) a.add("structure", 10, "Many hyphens in the domain name");
  if (t.length > 90) a.add("structure", 10, "Very long URL");
  const lower = t.toLowerCase();
  const hits = KW.filter(w => lower.includes(w));
  if (hits.length) { a.add("keywords", Math.min(25, 8 * hits.length), "Sensitive keywords in URL: " + hits.slice(0, 4).join(", ")); a.flags.push(...hits); }
  const { sim, brand, kind } = brandLookalike(host);
  if (kind === "typo") a.add("similarity", 60, `Domain imitates '${brand}' (${Math.trunc(sim * 100)}% similar) — typosquatting`);
  else if (kind === "subdomain") a.add("similarity", 50, `Uses '${brand}' as a sub-domain of an unrelated site`);
  else if (kind === "hyphen") a.add("similarity", 45, `Brand name '${brand}' padded with hyphens on an unofficial domain`);
  return { acc: a, host };
}

export function smsRules(text: string): Acc {
  const a = new Acc();
  const t = text.toLowerCase();
  const hits = SMS_KW.filter(w => t.includes(w));
  if (hits.length) { a.add("wording", Math.min(45, 10 * hits.length), "Pressure / scam wording: " + hits.slice(0, 5).join(", ")); a.flags.push(...hits); }
  const urls = text.match(URL_FIND) ?? [];
  if (urls.length) {
    let worst: Acc | null = null;
    for (const u of urls) {
      const r = urlRules(u).acc;
      if (!worst || r.total() > worst.total()) worst = r;
    }
    const w = worst as Acc;
    a.add("links", 15 + Math.floor(w.total() / 2), `Contains ${urls.length} link(s); riskiest scored ${w.total()}/100`);
    if (w.total() >= 30) a.why.push(...w.why.slice(0, 2).map(r => `Link: ${r}`));
    a.flags.push(...urls);
  }
  if (/\b\d{4,8}\b/.test(t) && t.includes("otp")) a.add("otp", 15, "Mentions an OTP/code — never share it");
  if (/(₹|rs\.?|\$|usd|inr)\s?\d/.test(t)) a.add("money", 10, "Mentions money amounts");
  return a;
}

export function qrType(c: string): "url" | "upi" | "wifi" | "contact" | "sms" {
  const low = c.toLowerCase().trim();
  if (low.startsWith("http://") || low.startsWith("https://") || URL_START.test(c.trim())) return "url";
  if (low.startsWith("upi://")) return "upi";
  if (low.startsWith("wifi:")) return "wifi";
  if (["smsto:", "sms:", "tel:", "mailto:"].some(p => low.startsWith(p))) return "contact";
  return "sms";
}

const PAYLOAD_MSG: Record<string, string> = {
  upi: "QR triggers a UPI payment request — confirm payee & amount before paying",
  wifi: "QR will join a Wi-Fi network — join only networks you trust",
  contact: "QR will start a message/call — check the recipient",
};

export function analyze(kind: string, raw: string, nReports: number) {
  const text = raw.trim();
  const atype = kind === "url" || kind === "sms" ? kind : qrType(text);
  let acc: Acc;
  if (atype === "url") acc = urlRules(text).acc;
  else if (atype === "sms") acc = smsRules(text);
  else { acc = new Acc(); acc.add("payload", atype === "upi" ? 35 : 30, PAYLOAD_MSG[atype]); }

  const rules = acc.total();
  let score = rules;
  const pre = score;
  if (nReports) score = Math.max(score, nReports < 3 ? 70 : 90);
  score = clamp(score);
  const verdict = verdictOf(score);

  const reasons = [...acc.why];
  if (nReports) reasons.unshift(`Reported as a scam by ${nReports} CyberShield user(s)`);
  if (!acc.why.length && !nReports && verdict === "safe") reasons.push("No common phishing or scam signals found");

  let items: Item[] = Object.entries(acc.pts).filter(([, v]) => v > 0).map(([c, v]) => ({ name: NAMES[c] ?? c, points: v }));
  if (score > pre) items.push({ name: "Community reports", points: score - pre });
  const tot = items.reduce((s, i) => s + i.points, 0);
  if (score && tot) {
    items.forEach(i => { i.points = pyRound((i.points * score) / tot); });
    const diff = score - items.reduce((s, i) => s + i.points, 0);
    items.sort((x, y) => y.points - x.points);
    if (items.length) items[0].points += diff;
  } else {
    items = [];
  }
  items = items.filter(i => i.points > 0).sort((x, y) => y.points - x.points);

  const st = (bad: boolean, warn: boolean): Status => (bad ? "bad" : warn ? "warn" : "ok");
  const g = (k: string) => acc.pts[k] ?? 0;
  const rep: Check = { name: "Reputation Check", status: st(nReports >= 3, nReports >= 1), detail: nReports ? `${nReports} community report(s)` : "No community reports" };
  const mlc: Check = { name: "Machine Learning", status: "na", detail: "Not included in the on-device build — rules only" };
  const rl: Check = { name: "Security Rules", status: st(rules >= 60, rules >= 30), detail: `Rule score ${rules}/100` };
  let checks: Check[];
  if (atype === "url") {
    const host = urlRules(text).host;
    checks = [
      { name: "Domain Analysis", status: st(g("domain") >= 30, g("domain") > 0), detail: host || "Invalid host" },
      { name: "URL Structure", status: st(g("structure") >= 25, g("structure") + g("protocol") + g("keywords") > 0), detail: "HTTPS, length, keywords, sub-domains" },
      { name: "Typosquatting", status: st(g("similarity") > 0, false), detail: g("similarity") ? "Imitates a known brand" : "No brand imitation" },
      rep, mlc, rl,
    ];
  } else if (atype === "sms") {
    checks = [
      { name: "Scam Wording", status: st(g("wording") >= 30, g("wording") > 0), detail: "Urgency / prize / account threats" },
      { name: "Embedded Links", status: st(g("links") >= 40, g("links") > 0), detail: "Links inside the message" },
      { name: "OTP / Payment Request", status: st(false, g("otp") + g("money") > 0), detail: "Asks for codes or money" },
      rep, mlc, rl,
    ];
  } else {
    checks = [{ name: "Payload Type", status: "warn", detail: `QR contains a ${atype.toUpperCase()} action` }, rep, rl];
  }

  const top = acc.why.slice(0, 3).map(r => r.replace(/\.+$/, "") + ".").join(" ");
  const explanation = score >= 60 ? "This looks like a scam. " + top
    : score >= 30 ? "This shows some characteristics associated with scams. " + top
    : "No common phishing or scam characteristics were found. No scanner is perfect, so stay cautious.";
  let confidence = clamp(50 + Math.min(45, Math.abs(score - 50) * 0.9));
  if (nReports) confidence = Math.max(confidence, 90);

  return {
    verdict, score, reasons, confidence, engine: "rules" as const, breakdown: items, checks,
    recommendation: REC[verdict], explanation, flags: acc.flags, type: atype,
  };
}

/* ---------- Cyber Score ---------- */
type ScanRow = { id: number; user_id: number; kind: string; input: string; verdict: Verdict; score: number; reasons: string[]; created_at: string };

function cyberScore(scans: ScanRow[], now: number) {
  const DAY = 86400000;
  const since = now - 30 * DAY;
  const recent = scans.filter(s => Date.parse(s.created_at) >= since);
  const n = recent.length;
  const awareness = Math.min(25, n * 2.5);
  const diversity = 5 * new Set(recent.map(s => s.kind)).size;
  const dayKeys = new Set(recent.filter(s => Date.parse(s.created_at) >= now - 14 * DAY).map(s => s.created_at.slice(0, 10)));
  const consistency = Math.min(20, dayKeys.size * 4);
  const risky = recent.filter(s => s.verdict !== "safe").length;
  const exposure = n ? Math.round(Math.min(15, (15 * risky) / n) * 10) / 10 : 0;
  const score = Math.round(Math.max(0, Math.min(100, 40 + awareness + diversity + consistency - exposure)));
  const level = score >= 80 ? "Cyber Guardian" : score >= 60 ? "Alert" : score >= 40 ? "Learning" : "At Risk";
  const tips: string[] = [];
  if (n < 4) tips.push("Scan more links, messages and QR codes this month — checking first is your best habit.");
  if (new Set(recent.map(s => s.kind)).size < 3) tips.push("Try all three scanners (URL, SMS, QR) to cover every attack route.");
  if (dayKeys.size < 3) tips.push("Check in on more days — regular use builds the habit.");
  if (n && risky / n > 0.5) tips.push("Many items you scan are risky. Avoid clicking unknown links and use official apps.");
  tips.push("Turn on two-factor authentication for email and banking.");
  return {
    score, level, scans_30d: n, risky_30d: risky, tips: tips.slice(0, 4),
    breakdown: [
      { name: "Awareness", value: pyRound(awareness), max: 25 },
      { name: "Coverage", value: diversity, max: 15 },
      { name: "Consistency", value: consistency, max: 20 },
      { name: "Exposure", value: -exposure, max: 0 },
    ],
  };
}

/* ---------- AI Assistant Local Knowledge Base ---------- */
const KB: [string[], string][] = [
  [["otp", "pin", "cvv"], "Never share an OTP, PIN or CVV with anyone — banks and apps never ask for them by call, SMS or chat. If someone does, it's a scam: hang up and call the number on your card."],
  [["upi", "qr", "scan to receive", "collect request"], "You never need to scan a QR code or enter a PIN to *receive* money. If someone asks you to, it's a fraud. Always check the payee name and amount before approving a UPI request."],
  [["phish", "link", "url", "click"], "Don't tap links in unexpected messages. Type the official address yourself, check the domain spelling (e.g. 'googgle' vs 'google'), and look for HTTPS — though HTTPS alone doesn't prove a site is safe."],
  [["password", "passphrase", "2fa", "two-factor"], "Use a long, unique passphrase for every account (12+ characters), store them in a password manager, and enable two-factor authentication on email and banking first."],
  [["wifi", "wi-fi", "public"], "Avoid banking or logging in on open Wi-Fi. Use mobile data or a trusted VPN, and turn off auto-connect."],
  [["lottery", "prize", "won", "gift", "reward", "kyc"], "Prize wins, free gifts and 'KYC expiring' warnings are classic pressure tactics. Real banks don't threaten to block you by SMS. Pause and verify through the official app."],
  [["scammed", "fraud", "lost money", "report", "hacked"], "Act fast: call your bank to block cards/UPI, change passwords, and report at cybercrime.gov.in or dial 1930 (India). Keep screenshots and transaction IDs."],
];
const FALLBACK = "I can help with phishing links, scam SMS, QR/UPI fraud, passwords and what to do if you've been scammed. Ask me about any of those, or pick a recent scan to explain.";

function explainScan(s: ScanRow): string {
  const v: Record<Verdict, string> = { safe: "looks safe", suspicious: "is suspicious", dangerous: "is dangerous" };
  const adv: Record<Verdict, string> = {
    safe: "Still stay alert — no scanner is perfect.",
    suspicious: "Don't enter personal details or pay anything until you verify it through an official channel.",
    dangerous: "Don't open it, reply or pay. Delete it, and report it if it impersonates a bank or service.",
  };
  return `This ${s.kind.toUpperCase()} ${v[s.verdict]} (risk ${s.score}/100).\n${s.reasons.map(r => "• " + r).join("\n")}\n\n${adv[s.verdict]}`;
}

function localAnswer(q: string): string {
  const ql = q.toLowerCase();
  const hits = KB.filter(([keys]) => keys.some(k => ql.includes(k))).map(([, a]) => a);
  return hits.length ? hits.slice(0, 2).join("\n\n") : FALLBACK;
}

/* ---------- Local DB Storage ---------- */
export type User = { id: number; name: string; email: string; salt: string; hash: string; created_at: string };
export type ReportRow = { id: number; user_id: number; kind: string; category: string; content: string; content_key: string; description: string; scan_id: number | null; created_at: string };
export type EventRow = { id: number; user_id: number; kind: string; detail: string; created_at: string };
export type DB = { seq: number; users: User[]; scans: ScanRow[]; reports: ReportRow[]; events: EventRow[] };

const KEY = "cybershield_local_v1";
const DAY = 86400000;
const nowIso = () => new Date().toISOString();

let cachedDb: DB | null = null;

export async function initOfflineDb(): Promise<DB> {
  if (cachedDb) return cachedDb;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users)) {
        cachedDb = parsed as DB;
        return cachedDb;
      }
    }
  } catch {}
  cachedDb = { seq: 1, users: [], scans: [], reports: [], events: [] };
  return cachedDb;
}

function load(): DB {
  if (cachedDb) return cachedDb;
  return { seq: 1, users: [], scans: [], reports: [], events: [] };
}

function save(db: DB) {
  cachedDb = db;
  AsyncStorage.setItem(KEY, JSON.stringify(db)).catch(() => {});
}

/* ---------- Pure-JS SHA-256 & PBKDF2 (Runs reliably on all devices) ---------- */
function rightRotate(value: number, amount: number) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Bytes(ascii: string): Uint8Array {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 300; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += "\x80";
  while ((ascii.length % 64) - 56) ascii += "\x00";
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    for (i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = hash[0], b = hash[1], c = hash[2], d = hash[3], e = hash[4], f = hash[5], g = hash[6], h = hash[7];
    for (i = 0; i < 64; i++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + k[i] + w[i]) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }
  const u8 = new Uint8Array(32);
  for (i = 0; i < 8; i++) {
    u8[i * 4] = (hash[i] >>> 24) & 255;
    u8[i * 4 + 1] = (hash[i] >>> 16) & 255;
    u8[i * 4 + 2] = (hash[i] >>> 8) & 255;
    u8[i * 4 + 3] = hash[i] & 255;
  }
  return u8;
}

const toHex = (buf: Uint8Array) => Array.from(buf, b => b.toString(16).padStart(2, "0")).join("");
const randomHex = (n: number) => {
  const arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 256);
  return toHex(arr);
};

async function hashPassword(password: string, saltHex: string): Promise<string> {
  let cur = sha256Bytes(password + ":" + saltHex);
  for (let i = 0; i < 300; i++) {
    cur = sha256Bytes(toHex(cur) + ":" + saltHex);
  }
  return toHex(cur);
}

function deviceName(): string {
  if (Platform.OS === "android") return "CyberShield Android App";
  if (Platform.OS === "ios") return "CyberShield iOS App";
  return "CyberShield Expo App";
}

const userOut = (u: User) => ({ id: u.id, name: u.name, email: u.email, created_at: u.created_at });
const scanOut = (s: ScanRow) => ({ id: s.id, kind: s.kind, input: s.input, verdict: s.verdict, score: s.score, reasons: s.reasons, created_at: s.created_at });
const reportOut = (r: ReportRow) => ({ id: r.id, kind: r.kind, category: r.category, content: r.content, description: r.description, scan_id: r.scan_id, created_at: r.created_at });

function addEvent(db: DB, uid: number, kind: string, detail = "") {
  db.events.push({ id: db.seq++, user_id: uid, kind, detail, created_at: nowIso() });
}

function currentUser(db: DB, token: string | null): User {
  const m = /^local\.(\d+)$/.exec(token ?? "");
  const u = m ? db.users.find(x => x.id === Number(m[1])) : undefined;
  if (!u) {
    throw new ApiError(token && !token.startsWith("local.")
      ? "The CyberShield server is unreachable. Log out and sign in with an on-device account to keep scanning offline."
      : "Please sign in", 401);
  }
  return u;
}

/* ---------- Local Router ---------- */
export async function localApi(path: string, method: string, body: any, token: string | null): Promise<any> {
  await initOfflineDb();
  const [route, qs = ""] = path.split("?");
  const params: Record<string, string> = {};
  if (qs) {
    qs.split("&").forEach(part => {
      const [k, v] = part.split("=");
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || "");
    });
  }
  const db = load();
  try {
    return await route_(db, method.toUpperCase(), route, body ?? {}, params, token);
  } finally {
    save(db);
  }
}

async function route_(db: DB, m: string, p: string, b: any, q: Record<string, string>, token: string | null): Promise<any> {
  if (m === "GET" && p === "/api/health") {
    return { status: "ok", service: "CyberShield AI (on-device)", model_loaded: false, mode: "offline" };
  }

  if (m === "POST" && p === "/api/auth/register") {
    const name = String(b.name ?? "").trim();
    const email = String(b.email ?? "").trim().toLowerCase();
    const password = String(b.password ?? "");
    if (!name) throw new ApiError("Name is required", 422);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError("Enter a valid email address", 422);
    if (password.length < 6) throw new ApiError("Password must be at least 6 characters", 422);
    if (db.users.some(x => x.email === email)) throw new ApiError("Email already registered", 409);
    const salt = randomHex(16);
    const u: User = { id: db.seq++, name, email, salt, hash: await hashPassword(password, salt), created_at: nowIso() };
    db.users.push(u);
    addEvent(db, u.id, "login", deviceName());
    return { token: `local.${u.id}`, user: userOut(u) };
  }

  if (m === "POST" && p === "/api/auth/login") {
    const email = String(b.email ?? "").trim().toLowerCase();
    const u = db.users.find(x => x.email === email);
    if (!u || (await hashPassword(String(b.password ?? ""), u.salt)) !== u.hash) {
      throw new ApiError("Invalid email or password", 401);
    }
    addEvent(db, u.id, "login", deviceName());
    return { token: `local.${u.id}`, user: userOut(u) };
  }

  const u = currentUser(db, token);
  const uid = u.id;
  const mine = db.scans.filter(s => s.user_id === uid);
  const myReports = () => db.reports.filter(r => r.user_id === uid);

  if (m === "GET" && p === "/api/auth/me") return userOut(u);

  if (m === "PATCH" && p === "/api/auth/me") {
    const name = String(b.name ?? "").trim();
    if (!name) throw new ApiError("Name is required", 422);
    u.name = name;
    return userOut(u);
  }

  if (m === "POST" && p === "/api/auth/change-password") {
    if ((await hashPassword(String(b.current ?? ""), u.salt)) !== u.hash) throw new ApiError("Current password is incorrect", 403);
    const next = String(b.new ?? "");
    if (next.length < 6) throw new ApiError("Password must be at least 6 characters", 422);
    u.salt = randomHex(16);
    u.hash = await hashPassword(next, u.salt);
    addEvent(db, uid, "password_change");
    return { changed: true };
  }

  if (m === "DELETE" && p === "/api/auth/me") {
    if ((await hashPassword(String(b.password ?? ""), u.salt)) !== u.hash) throw new ApiError("Password is incorrect", 403);
    db.users = db.users.filter(x => x.id !== uid);
    db.scans = db.scans.filter(s => s.user_id !== uid);
    db.reports = db.reports.filter(r => r.user_id !== uid);
    db.events = db.events.filter(e => e.user_id !== uid);
    return { deleted: true };
  }

  if (m === "GET" && p === "/api/auth/activity") {
    return db.events
      .filter(e => e.user_id === uid && e.kind === "login")
      .sort((x, y) => y.id - x.id)
      .slice(0, 8)
      .map(e => ({ device: e.detail, at: e.created_at }));
  }

  if (m === "POST" && p === "/api/events/password-check") {
    addEvent(db, uid, "password_check");
    return { ok: true };
  }

  const an = /^\/api\/analyze\/(url|sms|qr)$/.exec(p);
  if (m === "POST" && an) {
    const kind = an[1];
    const raw = String((kind === "url" ? b.url : kind === "sms" ? b.message : b.content) ?? "").trim();
    if (!raw) throw new ApiError("Nothing to scan", 422);
    const key = raw.toLowerCase().slice(0, 500);
    const nReports = new Set(db.reports.filter(r => r.content_key === key).map(r => r.user_id)).size;
    const r = analyze(kind, raw, nReports);
    const s: ScanRow = { id: db.seq++, user_id: uid, kind, input: raw, verdict: r.verdict, score: r.score, reasons: r.reasons, created_at: nowIso() };
    db.scans.push(s);
    const { verdict: _v, score: _s, reasons: _r, ...rest } = r;
    return { ...scanOut(s), ...rest };
  }

  const sc = /^\/api\/scans\/(\d+)$/.exec(p);
  if (m === "GET" && sc) {
    const s = mine.find(x => x.id === Number(sc[1]));
    if (!s) throw new ApiError("Not found", 404);
    const nReports = new Set(db.reports.filter(r => r.content_key === s.input.toLowerCase().slice(0, 500)).map(r => r.user_id)).size;
    const r = analyze(s.kind, s.input, nReports);
    const { verdict: _v, score: _s, reasons: _r, ...rest } = r;
    return { ...scanOut(s), ...rest };
  }

  if (m === "GET" && p === "/api/history") {
    const kind = q["kind"];
    const limit = Math.min(Number(q["limit"] ?? 100), 500);
    return mine.filter(s => !kind || s.kind === kind).sort((x, y) => y.id - x.id).slice(0, limit).map(scanOut);
  }
  if (m === "GET" && p === "/api/history/stats") {
    const c = (v: Verdict) => mine.filter(s => s.verdict === v).length;
    return { total: mine.length, safe: c("safe"), suspicious: c("suspicious"), dangerous: c("dangerous") };
  }
  if (m === "DELETE" && p === "/api/history") {
    db.scans = db.scans.filter(s => s.user_id !== uid);
    return { deleted: true };
  }
  const hd = /^\/api\/history\/(\d+)$/.exec(p);
  if (m === "DELETE" && hd) {
    const id = Number(hd[1]);
    if (!mine.some(s => s.id === id)) throw new ApiError("Not found", 404);
    db.scans = db.scans.filter(s => s.id !== id);
    return { deleted: true };
  }

  if (m === "GET" && p === "/api/analytics") {
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const days = [6, 5, 4, 3, 2, 1, 0].map(i => todayUtc - i * DAY);
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayCounts = days.map(d => mine.filter(s => { const t = Date.parse(s.created_at); return t >= d && t < d + DAY; }).length);
    const kindCount = (k: string) => mine.filter(s => s.kind === k).length;
    const pct = (v: Verdict) => (mine.length ? Math.round((100 * mine.filter(s => s.verdict === v).length) / mine.length) : 0);
    const threats = mine.filter(s => s.verdict !== "safe");
    return {
      days: days.map((d, i) => ({ day: names[new Date(d).getUTCDay()], count: dayCounts[i] })),
      total: mine.length,
      by_kind: {
        url: kindCount("url"),
        sms: kindCount("sms"),
        qr: kindCount("qr"),
        password: db.events.filter(e => e.user_id === uid && e.kind === "password_check").length
      },
      distribution: { safe: pct("safe"), suspicious: pct("suspicious"), dangerous: pct("dangerous") },
      threats: threats.length,
      recent_threats: [...threats].sort((x, y) => y.id - x.id).slice(0, 3).map(scanOut),
    };
  }

  if (m === "GET" && p === "/api/security") {
    const risky = mine.filter(s => Date.parse(s.created_at) >= Date.now() - 7 * DAY && s.verdict !== "safe").length;
    const kinds = new Set(mine.map(s => s.kind)).size;
    const changed = db.events.some(e => e.user_id === uid && e.kind === "password_change");
    const old = Math.floor((Date.now() - Date.parse(u.created_at)) / DAY) > 90 && !changed;
    return {
      engine: "rules",
      protections: ["URL Protection", "SMS Protection", "QR Protection", "Password Protection"].map(n => ({ name: n, on: true })),
      recommendations: [
        { ok: false, text: "AI model not included in the on-device build — rules protection is active" },
        { ok: risky === 0, text: risky === 0 ? "No risky items this week" : `${risky} risky item(s) this week — review your history` },
        { ok: kinds >= 3, text: kinds >= 3 ? "You've used URL, SMS and QR scanners" : "Try all three scanners (URL, SMS, QR)" },
        { ok: !old, text: old ? "Update your password — it hasn't changed in 90+ days" : "Password is up to date" },
      ],
      protected: true,
    };
  }

  if (m === "GET" && p === "/api/score") return cyberScore(mine, Date.now());

  if (m === "POST" && p === "/api/reports") {
    const kind = String(b.kind ?? ""), category = String(b.category ?? "");
    const content = String(b.content ?? "").trim();
    if (!["url", "sms", "qr", "call", "other"].includes(kind)) throw new ApiError("Invalid report type", 422);
    if (!CATS.includes(category)) throw new ApiError("Invalid category", 422);
    if (content.length < 3 || content.length > 2000) throw new ApiError("Content must be 3–2000 characters", 422);
    const key = content.toLowerCase().slice(0, 500);
    if (myReports().some(r => r.content_key === key)) throw new ApiError("You already reported this", 409);
    const r: ReportRow = { id: db.seq++, user_id: uid, kind, category, content, content_key: key,
      description: String(b.description ?? "").trim().slice(0, 1000), scan_id: b.scan_id ?? null, created_at: nowIso() };
    db.reports.push(r);
    return reportOut(r);
  }
  if (m === "GET" && p === "/api/reports") return myReports().sort((x, y) => y.id - x.id).slice(0, 200).map(reportOut);
  const rd = /^\/api\/reports\/(\d+)$/.exec(p);
  if (m === "DELETE" && rd) {
    const id = Number(rd[1]);
    if (!myReports().some(r => r.id === id)) throw new ApiError("Not found", 404);
    db.reports = db.reports.filter(r => r.id !== id);
    return { deleted: true };
  }
  if (m === "GET" && p === "/api/reports/community") {
    const counts = new Map<string, number>();
    db.reports.forEach(r => counts.set(r.category, (counts.get(r.category) ?? 0) + 1));
    const by = [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([category, count]) => ({ category, count }));
    return { total: db.reports.length, mine: myReports().length, by_category: by };
  }

  if (m === "POST" && p === "/api/assistant") {
    const msgs: { role: string; content: string }[] = Array.isArray(b.messages) ? b.messages : [];
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== "user") throw new ApiError("Last message must be from the user", 422);
    const scan = b.scan_id ? mine.find(s => s.id === Number(b.scan_id)) : undefined;
    const scanText = scan ? explainScan(scan) : null;
    if (scanText && msgs.length === 1) return { reply: scanText, source: "local" };
    return { reply: (scanText ? scanText + "\n\n" : "") + localAnswer(last.content), source: "local" };
  }

  throw new ApiError("This feature needs the online server", 404);
}
