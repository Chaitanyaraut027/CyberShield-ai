import os, re, time
from collections import defaultdict, deque

KB = [
  (["otp", "pin", "cvv"], "Never share an OTP, PIN or CVV with anyone — banks and apps never ask for them by call, SMS or chat. If someone does, it's a scam: hang up and call the number on your card."),
  (["upi", "qr", "scan to receive", "collect request"], "You never need to scan a QR code or enter a PIN to *receive* money. If someone asks you to, it's a fraud. Always check the payee name and amount before approving a UPI request."),
  (["phish", "link", "url", "click"], "Don't tap links in unexpected messages. Type the official address yourself, check the domain spelling (e.g. 'googgle' vs 'google'), and look for HTTPS — though HTTPS alone doesn't prove a site is safe."),
  (["password", "passphrase", "2fa", "two-factor"], "Use a long, unique passphrase for every account (12+ characters), store them in a password manager, and enable two-factor authentication on email and banking first."),
  (["wifi", "wi-fi", "public"], "Avoid banking or logging in on open Wi-Fi. Use mobile data or a trusted VPN, and turn off auto-connect."),
  (["lottery", "prize", "won", "gift", "reward", "kyc"], "Prize wins, free gifts and 'KYC expiring' warnings are classic pressure tactics. Real banks don't threaten to block you by SMS. Pause and verify through the official app."),
  (["scammed", "fraud", "lost money", "report", "hacked"], "Act fast: call your bank to block cards/UPI, change passwords, and report at cybercrime.gov.in or dial 1930 (India). Keep screenshots and transaction IDs."),
]
FALLBACK = "I can help with phishing links, scam SMS, QR/UPI fraud, passwords and what to do if you've been scammed. Ask me about any of those, or pick a recent scan to explain."

def explain_scan(s) -> str:
    v = {"safe": "looks safe", "suspicious": "is suspicious", "dangerous": "is dangerous"}[s.verdict]
    import json
    why = "\n".join("• " + r for r in json.loads(s.reasons or "[]"))
    adv = {"safe": "Still stay alert — no scanner is perfect.", "suspicious": "Don't enter personal details or pay anything until you verify it through an official channel.",
           "dangerous": "Don't open it, reply or pay. Delete it, and report it if it impersonates a bank or service."}[s.verdict]
    return f"This {s.kind.upper()} {v} (risk {s.score}/100).\n{why}\n\n{adv}"

def local_answer(q: str) -> str:
    ql = q.lower()
    hits = [a for keys, a in KB if any(k in ql for k in keys)]
    return "\n\n".join(hits[:2]) if hits else FALLBACK

SYSTEM = ("You are CyberShield AI's assistant: a clear, calm cybersecurity helper for everyday users, especially in India (UPI, KYC, SMS scams). "
          "Explain risks simply, give concrete next steps, keep replies under 150 words, and never ask for passwords, OTPs or card numbers. "
          "Scanner results are heuristic + ML estimates, not certainty — say so when relevant. Decline anything that helps attack others.")

def llm_answer(messages: list, scan_text: str | None):
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key: return None
    try:
        import anthropic
        system = SYSTEM + (f"\n\nThe user is asking about this scan result:\n{scan_text}" if scan_text else "")
        r = anthropic.Anthropic(api_key=key).messages.create(model=os.getenv("ASSISTANT_MODEL", "claude-sonnet-5-5"), max_tokens=500, system=system, messages=messages)
        return "".join(b.text for b in r.content if getattr(b, "type", "") == "text") or None
    except Exception:
        return None

_hits = defaultdict(deque)
def rate_ok(uid: int, limit=20, per=60) -> bool:
    q = _hits[uid]; now = time.time()
    while q and now - q[0] > per: q.popleft()
    if len(q) >= limit: return False
    q.append(now); return True
