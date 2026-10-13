from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .models import Scan, User

def compute(db: Session, u: User) -> dict:
    """Personal Cyber Score 0-100 = habits that keep you safe. Transparent formula, not ML."""
    since = datetime.utcnow() - timedelta(days=30)
    scans = db.query(Scan).filter(Scan.user_id == u.id, Scan.created_at >= since).all()
    n = len(scans)
    awareness = min(25, n * 2.5)                                           # checking things before trusting them
    diversity = 5 * len({s.kind for s in scans})                           # url / sms / qr = up to 15
    days = len({s.created_at.date() for s in scans if s.created_at >= datetime.utcnow() - timedelta(days=14)})
    consistency = min(20, days * 4)                                        # active days in last 14
    risky = sum(s.verdict != "safe" for s in scans)
    exposure = round(min(15, 15 * risky / n), 1) if n else 0               # high share of risky items = more exposure
    score = round(max(0, min(100, 40 + awareness + diversity + consistency - exposure)))
    level = "Cyber Guardian" if score >= 80 else "Alert" if score >= 60 else "Learning" if score >= 40 else "At Risk"
    tips = []
    if n < 4: tips.append("Scan more links, messages and QR codes this month — checking first is your best habit.")
    if len({s.kind for s in scans}) < 3: tips.append("Try all three scanners (URL, SMS, QR) to cover every attack route.")
    if days < 3: tips.append("Check in on more days — regular use builds the habit.")
    if n and risky / n > 0.5: tips.append("Many items you scan are risky. Avoid clicking unknown links and use official apps.")
    tips.append("Turn on two-factor authentication for email and banking.")
    return {"score": score, "level": level, "scans_30d": n, "risky_30d": risky, "tips": tips[:4],
            "breakdown": [{"name": "Awareness", "value": round(awareness), "max": 25}, {"name": "Coverage", "value": diversity, "max": 15},
                          {"name": "Consistency", "value": consistency, "max": 20}, {"name": "Exposure", "value": -exposure, "max": 0}]}
