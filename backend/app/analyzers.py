import re
from urllib.parse import urlparse
from .ml.features import brand_lookalike, SHORT, BAD_TLDS, KW, SMS_KW, IPRE
from .ml.predict import predict

URL_RE = re.compile(r"(?:https?://|www\.)[^\s]+|\b[a-z0-9-]+\.(?:com|net|org|in|xyz|top|click|tk|ml|ly|co)\b[^\s]*", re.I)
NAMES = {"protocol": "Connection security", "domain": "Domain analysis", "similarity": "Brand similarity", "structure": "URL structure",
         "keywords": "Suspicious keywords", "wording": "Scam wording", "links": "Embedded links", "otp": "OTP request", "money": "Money request", "payload": "QR payload type"}

def _verdict(score: int) -> str: return "safe" if score < 30 else "suspicious" if score < 60 else "dangerous"
def _clamp(x) -> int: return max(0, min(100, int(round(x))))

class Acc:
    def __init__(s): s.pts, s.why, s.flags = {}, [], []
    def add(s, cat, pts, msg=None):
        s.pts[cat] = s.pts.get(cat, 0) + pts
        if msg: s.why.append(msg)
    def total(s): return _clamp(sum(s.pts.values()))

def _url_rules(raw: str):
    url = raw.strip()
    if not re.match(r"^[a-z]+://", url, re.I): url = "http://" + url
    p = urlparse(url); host = (p.hostname or "").lower(); a = Acc()
    if not host: a.add("domain", 80, "Could not read a valid host name"); return a, host
    if p.scheme != "https": a.add("protocol", 15, "Connection is not encrypted (no HTTPS)")
    if IPRE.match(host): a.add("domain", 35, "Uses a raw IP address instead of a domain")
    if host in SHORT: a.add("domain", 25, "Link shortener hides the real destination")
    tld = host.rsplit(".", 1)[-1]
    if tld in BAD_TLDS: a.add("domain", 20, f"Domain ending .{tld} is frequently abused")
    if "@" in url.split("//", 1)[-1].split("/")[0]: a.add("structure", 30, "Contains '@' which can disguise the real host")
    if host.startswith("xn--") or ".xn--" in host: a.add("domain", 30, "Punycode domain may imitate a trusted brand")
    if host.count(".") >= 4: a.add("structure", 15, "Unusually many sub-domains")
    if host.count("-") >= 3: a.add("structure", 10, "Many hyphens in the domain name")
    if len(url) > 90: a.add("structure", 10, "Very long URL")
    hits = [w for w in KW if w in url.lower()]
    if hits: a.add("keywords", min(25, 8 * len(hits)), "Sensitive keywords in URL: " + ", ".join(hits[:4])); a.flags += hits
    sim, brand, kind = brand_lookalike(host)
    if kind == "typo": a.add("similarity", 60, f"Domain imitates '{brand}' ({int(sim*100)}% similar) — typosquatting")
    elif kind == "subdomain": a.add("similarity", 50, f"Uses '{brand}' as a sub-domain of an unrelated site")
    elif kind == "hyphen": a.add("similarity", 45, f"Brand name '{brand}' padded with hyphens on an unofficial domain")
    return a, host

def _sms_rules(text: str) -> Acc:
    t = text.lower(); a = Acc()
    hits = [w for w in SMS_KW if w in t]
    if hits: a.add("wording", min(45, 10 * len(hits)), "Pressure / scam wording: " + ", ".join(hits[:5])); a.flags += hits
    urls = URL_RE.findall(text)
    if urls:
        worst = max((_url_rules(u)[0] for u in urls), key=lambda x: x.total())
        a.add("links", 15 + worst.total() // 2, f"Contains {len(urls)} link(s); riskiest scored {worst.total()}/100")
        if worst.total() >= 30: a.why += [f"Link: {r}" for r in worst.why[:2]]
        a.flags += [u for u in urls]
    if re.search(r"\b\d{4,8}\b", t) and "otp" in t: a.add("otp", 15, "Mentions an OTP/code — never share it")
    if re.search(r"(₹|rs\.?|\$|usd|inr)\s?\d", t): a.add("money", 10, "Mentions money amounts")
    return a

def _qr_type(c: str) -> str:
    low = c.lower().strip()
    if low.startswith(("http://", "https://")) or URL_RE.match(c.strip()): return "url"
    if low.startswith("upi://"): return "upi"
    if low.startswith("wifi:"): return "wifi"
    if low.startswith(("smsto:", "sms:", "tel:", "mailto:")): return "contact"
    return "sms"

def _payload_rules(c: str, t: str) -> Acc:
    a = Acc(); msg = {"upi": "QR triggers a UPI payment request — confirm payee & amount before paying",
                      "wifi": "QR will join a Wi-Fi network — join only networks you trust",
                      "contact": "QR will start a message/call — check the recipient"}[t]
    a.add("payload", 35 if t == "upi" else 30, msg); return a

REC = {"safe": "No major risks found, but stay alert. Never enter passwords or OTPs unless you typed the address yourself.",
       "suspicious": "Be careful. Don't enter personal details or pay anything until you verify this through an official app or website.",
       "dangerous": "Do not open this, reply, or enter personal information. Delete it, and report it if it pretends to be a bank or service."}

def full(kind: str, text: str, n_reports: int = 0) -> dict:
    """Complete analysis: ML + rules + community reports, with explainability data for the UI."""
    text = text.strip(); atype = kind if kind in ("url", "sms") else _qr_type(text)
    host = ""
    if atype == "url": acc, host = _url_rules(text)
    elif atype == "sms": acc = _sms_rules(text)
    else: acc = _payload_rules(text, atype)
    rules = acc.total(); mlk = atype if atype in ("url", "sms") else None
    p = predict(mlk, text) if mlk else None
    score = rules
    if p is not None:
        score = round(0.7 * p * 100 + 0.3 * rules)
        if p > 0.5 or rules >= 60: score = max(score, 60)
    pre = score
    if n_reports: score = max(score, 70 if n_reports < 3 else 90)
    score = _clamp(score); verdict = _verdict(score)
    reasons = list(acc.why)
    if n_reports: reasons.insert(0, f"Reported as a scam by {n_reports} CyberShield user(s)")
    if p is not None: reasons.insert(0, f"AI model: {round(p*100)}% probability of being malicious")
    if not acc.why and not n_reports and verdict == "safe": reasons.append("No common phishing or scam signals found")
    # --- breakdown that adds up to the final score
    k = 0.3 if p is not None else 1.0
    items = [{"name": NAMES[c], "points": v * k} for c, v in acc.pts.items() if v > 0]
    if p is not None: items.append({"name": "AI model", "points": 0.7 * p * 100})
    if score > pre: items.append({"name": "Community reports", "points": score - pre})
    tot = sum(i["points"] for i in items)
    if score and tot:
        for i in items: i["points"] = round(i["points"] * score / tot)
        diff = score - sum(i["points"] for i in items); items.sort(key=lambda i: -i["points"])
        if items: items[0]["points"] += diff
    else: items = []
    items = [i for i in sorted(items, key=lambda i: -i["points"]) if i["points"] > 0]
    # --- threat-intelligence checks
    st = lambda bad, warn: "bad" if bad else "warn" if warn else "ok"
    pts = acc.pts; g = pts.get
    rep = {"name": "Reputation Check", "status": st(n_reports >= 3, n_reports >= 1), "detail": f"{n_reports} community report(s)" if n_reports else "No community reports"}
    mlc = {"name": "Machine Learning", "status": "na" if p is None else st(p >= .5, p >= .25),
           "detail": "Model not trained yet — rules only" if p is None else f"{round(p*100)}% malicious probability"}
    rl = {"name": "Security Rules", "status": st(rules >= 60, rules >= 30), "detail": f"Rule score {rules}/100"}
    if atype == "url":
        checks = [{"name": "Domain Analysis", "status": st(g("domain", 0) >= 30, g("domain", 0) > 0), "detail": host or "Invalid host"},
                  {"name": "URL Structure", "status": st(g("structure", 0) >= 25, g("structure", 0) + g("protocol", 0) + g("keywords", 0) > 0), "detail": "HTTPS, length, keywords, sub-domains"},
                  {"name": "Typosquatting", "status": st(g("similarity", 0) > 0, False), "detail": "Imitates a known brand" if g("similarity", 0) else "No brand imitation"}, rep, mlc, rl]
    elif atype == "sms":
        checks = [{"name": "Scam Wording", "status": st(g("wording", 0) >= 30, g("wording", 0) > 0), "detail": "Urgency / prize / account threats"},
                  {"name": "Embedded Links", "status": st(g("links", 0) >= 40, g("links", 0) > 0), "detail": "Links inside the message"},
                  {"name": "OTP / Payment Request", "status": st(False, g("otp", 0) + g("money", 0) > 0), "detail": "Asks for codes or money"}, rep, mlc, rl]
    else:
        checks = [{"name": "Payload Type", "status": "warn", "detail": f"QR contains a {atype.upper()} action"}, rep, rl]
    if score >= 60: expl = "This looks like a scam. " + " ".join(r.rstrip(".") + "." for r in acc.why[:3])
    elif score >= 30: expl = "This shows some characteristics associated with scams. " + " ".join(r.rstrip(".") + "." for r in acc.why[:3])
    else: expl = "No common phishing or scam characteristics were found. No scanner is perfect, so stay cautious."
    conf = round(max(p, 1 - p) * 100) if p is not None else _clamp(50 + min(45, abs(score - 50) * 0.9))
    if n_reports: conf = max(conf, 90)
    return {"verdict": verdict, "score": score, "reasons": reasons, "confidence": conf, "engine": "ml+rules" if p is not None else "rules",
            "breakdown": items, "checks": checks, "recommendation": REC[verdict], "explanation": expl, "flags": acc.flags, "type": atype}
