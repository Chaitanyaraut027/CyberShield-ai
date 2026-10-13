import os, json
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./cybershield.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    scans = relationship("Scan", back_populates="user", cascade="all, delete-orphan")

class Scan(Base):
    __tablename__ = "scans"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    kind = Column(String(10), index=True)          # url | sms | qr
    input = Column(Text)
    verdict = Column(String(12))                   # safe | suspicious | dangerous
    score = Column(Integer)                        # 0-100 risk
    reasons = Column(Text, default="[]")           # JSON list
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    user = relationship("User", back_populates="scans")

    def to_dict(self):
        return {"id": self.id, "kind": self.kind, "input": self.input, "verdict": self.verdict,
                "score": self.score, "reasons": json.loads(self.reasons or "[]"),
                "created_at": self.created_at.isoformat() + "Z"}

def init_db():
    Base.metadata.create_all(engine)

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()


class Report(Base):
    """User-submitted scam reports. Reports confirmed by several different users also feed ML retraining."""
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    scan_id = Column(Integer, nullable=True)
    kind = Column(String(10), index=True)            # url | sms | qr | call | other
    category = Column(String(20), index=True)        # phishing | lottery | kyc_bank | upi_qr | parcel | job | investment | other
    content = Column(Text)
    content_key = Column(String(500), index=True)    # lower-cased, trimmed, for matching duplicates across users
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {"id": self.id, "kind": self.kind, "category": self.category, "content": self.content,
                "description": self.description, "scan_id": self.scan_id, "created_at": self.created_at.isoformat() + "Z"}


class Event(Base):
    """Lightweight activity log: logins, password changes, password-check COUNTS (never the password itself)."""
    __tablename__ = "events"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    kind = Column(String(20), index=True)     # login | password_change | password_check
    detail = Column(String(255), default="")  # e.g. "Chrome on Android"
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
