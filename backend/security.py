import os
import json
import secrets
import logging
from pathlib import Path
from datetime import datetime
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger("mac_security")
CONFIG_FILE = Path(__file__).resolve().parent.parent / "config.json"

security_bearer = HTTPBearer(auto_error=False)

def get_or_create_config() -> dict:
    """Loads or generates persistent configuration including an API auth token."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read {CONFIG_FILE}, recreating: {e}")

    # Generate cryptographically secure API secret token
    new_token = secrets.token_urlsafe(32)
    config = {
        "api_token": new_token,
        "created_at": datetime.utcnow().isoformat(),
        "port": 8765,
        "host": "0.0.0.0",
        "allow_dangerous_actions": True
    }
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)
    os.chmod(CONFIG_FILE, 0o600)
    return config

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security_bearer)):
    """FastAPI dependency to verify Bearer token."""
    config = get_or_create_config()
    expected_token = config.get("api_token")

    if not credentials or not secrets.compare_digest(credentials.credentials, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return True
