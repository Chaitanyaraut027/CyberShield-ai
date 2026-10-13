import os, hashlib, hmac, secrets, time
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .models import get_db, User

SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
bearer = HTTPBearer(auto_error=False)

def hash_password(pw: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000).hex()
    return f"{salt}${h}"

def verify_password(pw: str, stored: str) -> bool:
    salt, h = stored.split("$")
    test = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000).hex()
    return hmac.compare_digest(test, h)

def make_token(user_id: int) -> str:
    return jwt.encode({"sub": str(user_id), "exp": int(time.time()) + 7 * 86400}, SECRET, algorithm="HS256")

def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not creds: raise HTTPException(401, "Not authenticated")
    try:
        uid = int(jwt.decode(creds.credentials, SECRET, algorithms=["HS256"])["sub"])
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    user = db.get(User, uid)
    if not user: raise HTTPException(401, "User not found")
    return user
