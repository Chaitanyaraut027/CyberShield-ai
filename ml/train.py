"""Train ONE model for URL + SMS (+QR, which is routed to URL/SMS). Run from repo root:
    python ml/train.py            # real data in ml/data/
    python ml/train.py --demo     # synthetic smoke-test data ONLY (not for real use)
Data files (label 1 = malicious/scam, 0 = benign):  ml/data/urls.csv -> url,label   ml/data/sms.csv -> text,label"""
import sys, random, argparse
from pathlib import Path
import pandas as pd, joblib
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import FunctionTransformer, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
from app.ml.features import numeric_matrix, BRANDS

DATA = Path(__file__).parent / "data"; OUT = Path(__file__).resolve().parents[1] / "backend/app/ml/model.joblib"

def demo_data(n=3000):
    r = random.Random(1); rows = []
    def typo(b):
        i = r.randrange(len(b)); return r.choice([b[:i] + b[i] * 2 + b[i:], b[:i] + b[i + 1:], b.replace("o", "0", 1), b[:i] + b[i] + b[i:]])
    for _ in range(n):
        b = r.choice(BRANDS)
        rows.append(("url\thttps://www." + b + r.choice([".com", ".in", ".org"]) + r.choice(["", "/", "/about", "/search?q=news"]), 0))
        rows.append(("url\thttps://" + r.choice(["docs", "mail", "en", "blog"]) + "." + r.choice(["wikipedia.org", "python.org", "bbc.com", "github.com"]) + "/x", 0))
        k = r.choice(["login", "secure", "verify", "kyc", "update"])
        rows.append(("url\t" + r.choice(["http", "https"]) + "://" + r.choice([typo(b) + ".com", f"{b}-{k}.{r.choice(['top','xyz','click'])}", f"{b}.{k}-{r.randint(10,99)}.tk", f"{r.randint(11,250)}.{r.randint(1,250)}.{r.randint(1,250)}.9/{k}"]) + "/" + k, 1))
        rows.append(("sms\t" + r.choice(["Hey, are we meeting at 6?", "Your OTP for login is 482913. Do not share.", "Order shipped, arriving tomorrow.", "Happy birthday! Dinner on Saturday?", "Meeting moved to 3pm, see agenda attached."]), 0))
        rows.append(("sms\t" + r.choice(["URGENT: your account is blocked. Verify KYC now at http://sbi-kyc.top/login", "Congratulations! You won Rs 50000 lottery. Claim immediately", "Pay Rs 49 to release your parcel: http://bit.ly/x9", "Your bank account will be suspended. Click to update PAN"]), 1))
    return pd.DataFrame(rows, columns=["x", "y"])

def real_data():
    u = pd.read_csv(DATA / "urls.csv").dropna(); s = pd.read_csv(DATA / "sms.csv").dropna()
    for f, col, dst in [("reported_urls.csv", "url", "u"), ("reported_sms.csv", "text", "s")]:   # community-confirmed scams
        if (DATA / f).exists():
            extra = pd.read_csv(DATA / f).dropna()
            if dst == "u": u = pd.concat([u, extra], ignore_index=True)
            else: s = pd.concat([s, extra], ignore_index=True)
    return pd.concat([pd.DataFrame({"x": "url\t" + u["url"].astype(str), "y": u["label"]}), pd.DataFrame({"x": "sms\t" + s["text"].astype(str), "y": s["label"]})], ignore_index=True)

def build():
    feats = FeatureUnion([
        ("chars", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True, max_features=200_000)),
        ("num", Pipeline([("f", FunctionTransformer(numeric_matrix)), ("s", StandardScaler(with_mean=False))])),
    ])
    return Pipeline([("feats", feats), ("clf", LogisticRegression(C=4, max_iter=2000, class_weight="balanced"))])

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--demo", action="store_true"); a = ap.parse_args()
    df = demo_data() if a.demo else real_data()
    Xtr, Xte, ytr, yte = train_test_split(df["x"], df["y"], test_size=0.2, stratify=df["y"], random_state=42)
    m = build().fit(Xtr, ytr); p = m.predict_proba(Xte)[:, 1]
    print(classification_report(yte, p > 0.5, target_names=["benign", "malicious"])); print("ROC-AUC:", round(roc_auc_score(yte, p), 4))
    joblib.dump(m, OUT); print("saved ->", OUT, "(DEMO MODEL — do not trust)" if a.demo else "")
