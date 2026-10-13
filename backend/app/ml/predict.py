import os
from pathlib import Path
MODEL_PATH = Path(os.getenv("MODEL_PATH", Path(__file__).parent / "model.joblib"))
_model = None; _tried = False

def _load():
    global _model, _tried
    if not _tried:
        _tried = True
        try:
            import joblib; _model = joblib.load(MODEL_PATH)
        except Exception: _model = None
    return _model

def predict(kind: str, text: str):
    """Probability (0-1) that the input is malicious, or None if no trained model is installed."""
    m = _load()
    return None if m is None else float(m.predict_proba([f"{kind}\t{text}"])[0][1])
