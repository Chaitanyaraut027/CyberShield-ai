import json
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from .models import init_db, get_db, User, Scan, Report, Event
from .security import hash_password, verify_password, make_token, current_user
from . import analyzers, assistant, score as score_mod
from .ml.predict import _load as _model_loaded

app = FastAPI(title="CyberShield AI API", version="2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
def _startup(): init_db()

# ---------- schemas ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120); email: EmailStr; password: str = Field(min_length=6, max_length=128)
class LoginIn(BaseModel):
    email: EmailStr; password: str
class ProfileIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
class PasswordIn(BaseModel):
    current: str; new: str = Field(min_length=6, max_length=128)
class DeleteIn(BaseModel):
    password: str
class UrlIn(BaseModel):
    url: str = Field(min_length=3, max_length=2000)
class SmsIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
class QrIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

def user_out(u: User): return {"id": u.id, "name": u.name, "email": u.email, "created_at": u.created_at.isoformat() + "Z"}

def _device(req: Request) -> str:
    ua = req.headers.get("user-agent", "")
    os_ = next((n for k, n in [("Android", "Android"), ("iPhone", "iPhone"), ("iPad", "iPad"), ("Windows", "Windows"), ("Mac OS", "macOS"), ("Linux", "Linux")] if k in ua), "Unknown device")
    br = next((n for k, n in [("Edg", "Edge"), ("OPR", "Opera"), ("Chrome", "Chrome"), ("Firefox", "Firefox"), ("Safari", "Safari")] if k in ua), "Browser")
    return f"{br} on {os_}"

def _event(db: Session, uid: int, kind: str, detail: str = ""):
    db.add(Event(user_id=uid, kind=kind, detail=detail)); db.commit()

# ---------- health & auth ----------
@app.get("/api/health")
def health(): return {"status": "ok", "service": "CyberShield AI", "model_loaded": _model_loaded() is not None}

@app.post("/api/auth/register", status_code=201)
def register(body: RegisterIn, req: Request, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.query(User).filter(User.email == email).first(): raise HTTPException(409, "Email already registered")
    u = User(name=body.name.strip(), email=email, password_hash=hash_password(body.password))
    db.add(u); db.commit(); db.refresh(u); _event(db, u.id, "login", _device(req))
    return {"token": make_token(u.id), "user": user_out(u)}

@app.post("/api/auth/login")
def login(body: LoginIn, req: Request, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == body.email.lower()).first()
    if not u or not verify_password(body.password, u.password_hash): raise HTTPException(401, "Invalid email or password")
    _event(db, u.id, "login", _device(req))
    return {"token": make_token(u.id), "user": user_out(u)}

@app.get("/api/auth/me")
def me(u: User = Depends(current_user)): return user_out(u)

@app.patch("/api/auth/me")
def update_me(body: ProfileIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    u.name = body.name.strip(); db.commit(); return user_out(u)

@app.post("/api/auth/change-password")
def change_password(b: PasswordIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(b.current, u.password_hash): raise HTTPException(403, "Current password is incorrect")
    u.password_hash = hash_password(b.new); db.commit(); _event(db, u.id, "password_change"); return {"changed": True}

@app.delete("/api/auth/me")
def delete_me(b: DeleteIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(b.password, u.password_hash): raise HTTPException(403, "Password is incorrect")
    db.query(Report).filter(Report.user_id == u.id).delete(); db.query(Event).filter(Event.user_id == u.id).delete()
    db.delete(u); db.commit(); return {"deleted": True}

@app.get("/api/auth/activity")
def activity(u: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(Event).filter(Event.user_id == u.id, Event.kind == "login").order_by(Event.created_at.desc()).limit(8).all()
    return [{"device": r.detail, "at": r.created_at.isoformat() + "Z"} for r in rows]

@app.post("/api/events/password-check")
def pw_check(u: User = Depends(current_user), db: Session = Depends(get_db)):
    _event(db, u.id, "password_check"); return {"ok": True}      # a COUNT only — the password never leaves the browser

# ---------- scanning ----------
def _run(db: Session, u: User, kind: str, text: str):
    text = text.strip()
    n = db.query(func.count(func.distinct(Report.user_id))).filter(Report.content_key == text.lower()[:500]).scalar() or 0
    r = analyzers.full(kind, text, n)
    s = Scan(user_id=u.id, kind=kind, input=text, verdict=r["verdict"], score=r["score"], reasons=json.dumps(r["reasons"]))
    db.add(s); db.commit(); db.refresh(s)
    return {**s.to_dict(), **{k: v for k, v in r.items() if k not in ("verdict", "score", "reasons")}}

@app.post("/api/analyze/url")
def a_url(b: UrlIn, u: User = Depends(current_user), db: Session = Depends(get_db)): return _run(db, u, "url", b.url)
@app.post("/api/analyze/sms")
def a_sms(b: SmsIn, u: User = Depends(current_user), db: Session = Depends(get_db)): return _run(db, u, "sms", b.message)
@app.post("/api/analyze/qr")
def a_qr(b: QrIn, u: User = Depends(current_user), db: Session = Depends(get_db)): return _run(db, u, "qr", b.content)

@app.get("/api/scans/{sid}")
def get_scan(sid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    s = db.query(Scan).filter(Scan.id == sid, Scan.user_id == u.id).first()
    if not s: raise HTTPException(404, "Not found")
    n = db.query(func.count(func.distinct(Report.user_id))).filter(Report.content_key == s.input.lower()[:500]).scalar() or 0
    r = analyzers.full(s.kind, s.input, n)
    return {**s.to_dict(), **{k: v for k, v in r.items() if k not in ("verdict", "score", "reasons")}}   # re-opens the full analysis

@app.get("/api/history")
def history(kind: str | None = None, limit: int = 100, u: User = Depends(current_user), db: Session = Depends(get_db)):
    q = db.query(Scan).filter(Scan.user_id == u.id)
    if kind: q = q.filter(Scan.kind == kind)
    return [s.to_dict() for s in q.order_by(Scan.created_at.desc()).limit(min(limit, 500))]

@app.get("/api/history/stats")
def stats(u: User = Depends(current_user), db: Session = Depends(get_db)):
    d = {k: v for k, v in db.query(Scan.verdict, func.count()).filter(Scan.user_id == u.id).group_by(Scan.verdict).all()}
    return {"total": sum(d.values()), "safe": d.get("safe", 0), "suspicious": d.get("suspicious", 0), "dangerous": d.get("dangerous", 0)}

@app.delete("/api/history")
def clear_history(u: User = Depends(current_user), db: Session = Depends(get_db)):
    db.query(Scan).filter(Scan.user_id == u.id).delete(); db.commit(); return {"deleted": True}

@app.delete("/api/history/{sid}")
def delete_scan(sid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    s = db.query(Scan).filter(Scan.id == sid, Scan.user_id == u.id).first()
    if not s: raise HTTPException(404, "Not found")
    db.delete(s); db.commit(); return {"deleted": True}

# ---------- analytics & security center ----------
@app.get("/api/analytics")
def analytics(u: User = Depends(current_user), db: Session = Depends(get_db)):
    today = datetime.utcnow().date(); days = [today - timedelta(days=i) for i in range(6, -1, -1)]
    recent = db.query(Scan).filter(Scan.user_id == u.id, Scan.created_at >= datetime.combine(days[0], datetime.min.time())).all()
    per = {d: 0 for d in days}
    for s in recent: per[s.created_at.date()] = per.get(s.created_at.date(), 0) + 1
    kinds = {k: c for k, c in db.query(Scan.kind, func.count()).filter(Scan.user_id == u.id).group_by(Scan.kind).all()}
    by = {k: v for k, v in db.query(Scan.verdict, func.count()).filter(Scan.user_id == u.id).group_by(Scan.verdict).all()}
    total = sum(by.values()); pct = lambda k: round(100 * by.get(k, 0) / total) if total else 0
    thr = db.query(Scan).filter(Scan.user_id == u.id, Scan.verdict != "safe").order_by(Scan.created_at.desc()).limit(3).all()
    return {"days": [{"day": d.strftime("%a"), "count": per[d]} for d in days], "total": total,
            "by_kind": {"url": kinds.get("url", 0), "sms": kinds.get("sms", 0), "qr": kinds.get("qr", 0),
                        "password": db.query(Event).filter(Event.user_id == u.id, Event.kind == "password_check").count()},
            "distribution": {"safe": pct("safe"), "suspicious": pct("suspicious"), "dangerous": pct("dangerous")},
            "threats": by.get("suspicious", 0) + by.get("dangerous", 0), "recent_threats": [s.to_dict() for s in thr]}

@app.get("/api/security")
def security(u: User = Depends(current_user), db: Session = Depends(get_db)):
    now = datetime.utcnow(); week = now - timedelta(days=7)
    risky = db.query(Scan).filter(Scan.user_id == u.id, Scan.created_at >= week, Scan.verdict != "safe").count()
    kinds = db.query(Scan.kind).filter(Scan.user_id == u.id).distinct().count()
    changed = db.query(Event).filter(Event.user_id == u.id, Event.kind == "password_change").first()
    ml = _model_loaded() is not None; old = (now - u.created_at).days > 90 and not changed
    recs = [{"ok": ml, "text": "AI model active" if ml else "AI model not trained yet — protection is rules-only (see ml/README)"},
            {"ok": risky == 0, "text": "No risky items this week" if risky == 0 else f"{risky} risky item(s) this week — review your history"},
            {"ok": kinds >= 3, "text": "You've used URL, SMS and QR scanners" if kinds >= 3 else "Try all three scanners (URL, SMS, QR)"},
            {"ok": not old, "text": "Password is up to date" if not old else "Update your password — it hasn't changed in 90+ days"}]
    return {"engine": "ml+rules" if ml else "rules", "protections": [{"name": n, "on": True} for n in ("URL Protection", "SMS Protection", "QR Protection", "Password Protection")],
            "recommendations": recs, "protected": True}

@app.get("/api/score")
def cyber_score(u: User = Depends(current_user), db: Session = Depends(get_db)): return score_mod.compute(db, u)

# ---------- scam reports ----------
CATEGORIES = "^(phishing|lottery|kyc_bank|upi_qr|parcel|job|investment|other)$"
class ReportIn(BaseModel):
    kind: str = Field(pattern="^(url|sms|qr|call|other)$"); category: str = Field(pattern=CATEGORIES)
    content: str = Field(min_length=3, max_length=2000); description: str = Field(default="", max_length=1000); scan_id: int | None = None

@app.post("/api/reports", status_code=201)
def create_report(b: ReportIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    key = b.content.strip().lower()[:500]
    if db.query(Report).filter(Report.user_id == u.id, Report.content_key == key).first(): raise HTTPException(409, "You already reported this")
    r = Report(user_id=u.id, kind=b.kind, category=b.category, content=b.content.strip(), content_key=key, description=b.description.strip(), scan_id=b.scan_id)
    db.add(r); db.commit(); db.refresh(r); return r.to_dict()

@app.get("/api/reports")
def my_reports(u: User = Depends(current_user), db: Session = Depends(get_db)):
    return [r.to_dict() for r in db.query(Report).filter(Report.user_id == u.id).order_by(Report.created_at.desc()).limit(200)]

@app.delete("/api/reports/{rid}")
def delete_report(rid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    r = db.query(Report).filter(Report.id == rid, Report.user_id == u.id).first()
    if not r: raise HTTPException(404, "Not found")
    db.delete(r); db.commit(); return {"deleted": True}

@app.get("/api/reports/community")
def community(u: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(Report.category, func.count()).group_by(Report.category).order_by(func.count().desc()).all()
    return {"total": sum(c for _, c in rows), "mine": db.query(Report).filter(Report.user_id == u.id).count(), "by_category": [{"category": k, "count": c} for k, c in rows]}

# ---------- assistant ----------
class ChatMsg(BaseModel):
    role: str = Field(pattern="^(user|assistant)$"); content: str = Field(min_length=1, max_length=1000)
class ChatIn(BaseModel):
    messages: list[ChatMsg] = Field(min_length=1, max_length=12); scan_id: int | None = None

@app.post("/api/assistant")
def chat(b: ChatIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    if not assistant.rate_ok(u.id): raise HTTPException(429, "Too many questions — wait a minute.")
    msgs = [m.model_dump() for m in b.messages]
    if msgs[-1]["role"] != "user": raise HTTPException(422, "Last message must be from the user")
    scan = db.query(Scan).filter(Scan.id == b.scan_id, Scan.user_id == u.id).first() if b.scan_id else None
    scan_text = assistant.explain_scan(scan) if scan else None
    reply = assistant.llm_answer(msgs, scan_text)
    if reply: return {"reply": reply, "source": "ai"}
    if scan_text and len(msgs) == 1: return {"reply": scan_text, "source": "local"}
    return {"reply": (scan_text + "\n\n" if scan_text else "") + assistant.local_answer(msgs[-1]["content"]), "source": "local"}
