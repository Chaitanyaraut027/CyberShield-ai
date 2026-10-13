# Training data (you must add this — no real data ships with the project)
- `urls.csv`  columns `url,label`   (1 = phishing/malware, 0 = benign). Sources: PhishTank / URLhaus (malicious), Tranco top sites (benign).
- `sms.csv`   columns `text,label`  (1 = scam/spam, 0 = normal). Source: UCI SMS Spam Collection + your own Indian-style scams.
- Aim for 20k+ rows per file, roughly balanced. Then run `python ml/train.py` from the project root.
- `reported_*.csv` are created by `python ml/export_reports.py` from community reports and merged automatically.
