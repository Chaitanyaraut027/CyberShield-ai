"""Shared by training AND the live API, so features always match."""
import math, re
from difflib import SequenceMatcher
from urllib.parse import urlparse
import numpy as np

BRANDS = ["google","facebook","paypal","amazon","apple","microsoft","netflix","instagram","whatsapp","youtube","linkedin",
          "twitter","github","gmail","flipkart","paytm","phonepe","sbi","hdfcbank","icicibank","axisbank","irctc","amazonaws","outlook"]
SHORT = {"bit.ly","tinyurl.com","t.co","goo.gl","is.gd","cutt.ly","rb.gy","ow.ly","shorturl.at"}
BAD_TLDS = {"zip","mov","xyz","top","click","gq","tk","ml","cf","ga","work","support","country","rest","icu","buzz"}
KW = ["login","verify","secure","account","update","bank","wallet","confirm","password","free","gift","kyc","reward","signin","billing"]
SMS_KW = ["urgent","immediately","blocked","suspended","verify","kyc","otp","winner","won","prize","claim","refund","click","expire","limited","act now"]
IPRE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")

def host_of(text: str) -> str:
    t = text.strip()
    if not re.match(r"^[a-z]+://", t, re.I): t = "http://" + t
    return (urlparse(t).hostname or "").lower()

def _collapse(s): return re.sub(r"(.)\1+", r"\1", s)

def brand_lookalike(host: str):
    """Returns (similarity 0-1, brand, kind) ; kind in {'typo','subdomain','hyphen',None}. Exact brand domains return None."""
    parts = host.split(".")
    core = parts[-2] if len(parts) >= 2 else parts[0]
    if core in BRANDS: return 0.0, core, None
    best, bb = 0.0, None
    for b in BRANDS:
        s = max(SequenceMatcher(None, core, b).ratio(), SequenceMatcher(None, _collapse(core), _collapse(b)).ratio() - 0.02)
        if s > best: best, bb = s, b
    if best >= 0.8 and len(core) >= 4: return best, bb, "typo"
    for b in BRANDS:
        if b in parts[:-2]: return 0.9, b, "subdomain"
        if b in core and "-" in core: return 0.85, b, "hyphen"
    return best, bb, None

def _entropy(s):
    if not s: return 0.0
    p = [s.count(c) / len(s) for c in set(s)]
    return -sum(x * math.log2(x) for x in p)

NUM_NAMES = ["is_url","is_sms","typo_sim","lookalike","entropy","len","digit_ratio","dots","hyphens","ip","https","at","short","bad_tld",
             "kw","sms_kw","has_link","money","upper_ratio","exclaim"]

def numeric(item: str) -> list:
    kind, _, text = item.partition("\t")
    f = dict.fromkeys(NUM_NAMES, 0.0)
    if kind == "sms":
        t = text.lower(); f["is_sms"] = 1
        f["sms_kw"] = sum(w in t for w in SMS_KW); f["has_link"] = float(bool(re.search(r"https?://|www\.|\.\w{2,4}/", t)))
        f["money"] = float(bool(re.search(r"(₹|rs\.?|\$)\s?\d", t))); f["len"] = len(text)
        f["upper_ratio"] = sum(c.isupper() for c in text) / max(1, len(text)); f["exclaim"] = text.count("!")
    else:
        h = host_of(text); f["is_url"] = 1; sim, _, k = brand_lookalike(h)
        f["typo_sim"] = sim; f["lookalike"] = float(k is not None)
        f["entropy"] = _entropy(h); f["len"] = len(text); f["digit_ratio"] = sum(c.isdigit() for c in h) / max(1, len(h))
        f["dots"] = h.count("."); f["hyphens"] = h.count("-"); f["ip"] = float(bool(IPRE.match(h)))
        f["https"] = float(text.lower().startswith("https")); f["at"] = float("@" in text); f["short"] = float(h in SHORT)
        f["bad_tld"] = float(h.rsplit(".", 1)[-1] in BAD_TLDS); f["kw"] = sum(w in text.lower() for w in KW)
    return [f[n] for n in NUM_NAMES]

def numeric_matrix(items): return np.array([numeric(i) for i in items], dtype=float)
