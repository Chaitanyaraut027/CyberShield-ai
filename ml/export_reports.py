"""Turn community reports into training data. A report only counts as a label once >= MIN different users reported the same content.
    python ml/export_reports.py [MIN]      -> ml/data/reported_urls.csv, reported_sms.csv  (train.py picks them up automatically)"""
import sys, csv
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from sqlalchemy import func
from app.models import SessionLocal, Report
MIN = int(sys.argv[1]) if len(sys.argv) > 1 else 3
db = SessionLocal()
rows = db.query(Report.kind, func.min(Report.content), func.count(func.distinct(Report.user_id))).filter(Report.kind.in_(["url", "sms", "qr"])).group_by(Report.content_key, Report.kind).all()
out = Path(__file__).parent / "data"; out.mkdir(exist_ok=True)
urls = [c for k, c, n in rows if n >= MIN and k in ("url", "qr") and "." in c and " " not in c.strip()]
sms = [c for k, c, n in rows if n >= MIN and (k == "sms" or " " in c.strip())]
for name, col, data in [("reported_urls.csv", "url", urls), ("reported_sms.csv", "text", sms)]:
    with open(out / name, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow([col, "label"]); w.writerows([[d, 1] for d in data])
print(f"exported {len(urls)} urls, {len(sms)} sms (min reporters = {MIN})")
