# CyberShield AI — Backend
    python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
    pip install -r requirements.txt
    cp .env.example .env   # then: export $(cat .env | xargs)  (or set vars in your shell)
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
Docs: http://localhost:8000/docs  ·  Health: http://localhost:8000/api/health
