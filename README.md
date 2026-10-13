# CyberShield AI — full stack (React + FastAPI + SQL database + ML)

```
frontend/   React + Vite + Tailwind UI (responsive: sidebar on desktop, tab bar on phone)
backend/    FastAPI API, SQLAlchemy database (SQLite default, PostgreSQL via DATABASE_URL)
  app/ml/   feature extraction + model loader (loads model.joblib if it exists)
ml/         train.py (one model for URL+SMS+QR), export_reports.py, data/ (put datasets here)
```

## Run (VS Code, two terminals)
Backend (Python 3.11/3.12):
    cd backend && python -m venv .venv && .venv\Scripts\activate      # macOS/Linux: source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
Frontend (Node 20+):
    cd frontend && npm install && npm run dev          # http://localhost:5173

## Phone testing
Same Wi-Fi → open http://<PC-IP>:5173 (allow ports 5173 + 8000 in the firewall).
**QR camera:** browsers only allow live camera on HTTPS/localhost. On a phone you can
1. tap **🖼️ Take / upload photo** (opens the phone camera app, works over plain HTTP), or
2. run `npm run dev:https`, open https://<PC-IP>:5173 and accept the one-time certificate warning → **📷 Live camera** works.

## App screens
Dashboard (animated Cyber Score, live counters, tool cards, recent threats) · Scan hub (URL / SMS / QR / Password) · full Result screen
(AI/Rule confidence, risk indicators, "Why this result?" breakdown, threat-intelligence checks, recommendation) · Analytics · History timeline
· Security Center · Profile (change password, login activity, appearance, notifications, delete account) · AI Assistant · Cyber Hub · Report a Scam · Cyber Score · Settings.
Theme: Dark / Light / System (Profile → Appearance).

## Features → endpoints
Register/Login `/api/auth/*` · URL/SMS/QR `/api/analyze/{url,sms,qr}` · History `/api/history` · AI Assistant `/api/assistant`
Cyber Score `/api/score` · Reopen scan `/api/scans/{id}` · Analytics `/api/analytics` · Security `/api/security` · Login activity `/api/auth/activity` · Change/delete account `/api/auth/change-password`, `DELETE /api/auth/me` · Scam Reports `/api/reports`, `/api/reports/community` · Health `/api/health`

## Train the ML model (not included — needs real data)
1. Add `ml/data/urls.csv` (`url,label`) and `ml/data/sms.csv` (`text,label`) — see `ml/data/README.md`.
2. `python ml/train.py` → writes `backend/app/ml/model.joblib`; restart the backend.
3. Later: `python ml/export_reports.py` turns scams reported by 3+ different users into extra training rows; retrain.
Without `model.joblib` the app uses rules only (incl. lookalike-domain detection).

## Optional
`ANTHROPIC_API_KEY` enables the LLM assistant (else built-in answers). `DATABASE_URL`, `JWT_SECRET`: see `backend/.env.example`.
Before deploying: set a real JWT_SECRET, restrict CORS origins, use PostgreSQL.

## Mobile app (React Native Expo)
The full frontend has been converted to **React Native Expo** with a native Camera QR scanner, live threat gauge, offline engine, and AI assistant:
```bash
cd mobile
npx expo start
```
Scan the QR code in terminal with **Expo Go** on Android or iOS.
See [`mobile/README.md`](mobile/README.md) for full details.

### Legacy Capacitor build
See [MOBILE.md](MOBILE.md) for the previous Capacitor WebView wrapper build.

