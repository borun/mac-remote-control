import os
import io
import asyncio
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, StreamingResponse, RedirectResponse
from pydantic import BaseModel
import qrcode

from backend.controller import MacSystemController
from backend.security import get_or_create_config, verify_token

app = FastAPI(title="iMac Remote Control Server", version="1.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

# Request Schemas
class VolumeRequest(BaseModel):
    volume: int

class QuitAppRequest(BaseModel):
    pid: int
    force: bool = False

class InternetRequest(BaseModel):
    block: bool

class ActionResponse(BaseModel):
    success: bool
    message: str

# API Routes
@app.get("/api/telemetry", dependencies=[Depends(verify_token)])
async def get_telemetry():
    """Returns current system telemetry (CPU, RAM, Volume, Internet state, Force-quit app list)."""
    return MacSystemController.get_telemetry()

@app.post("/api/action/lock", response_model=ActionResponse, dependencies=[Depends(verify_token)])
async def action_lock():
    success, msg = MacSystemController.lock_screen()
    return {"success": success, "message": msg}

@app.post("/api/action/sleep", response_model=ActionResponse, dependencies=[Depends(verify_token)])
async def action_sleep():
    success, msg = MacSystemController.sleep_system()
    return {"success": success, "message": msg}

@app.post("/api/action/restart", response_model=ActionResponse, dependencies=[Depends(verify_token)])
async def action_restart():
    loop = asyncio.get_event_loop()
    loop.call_later(1.0, lambda: MacSystemController.restart_system())
    return {"success": True, "message": "iMac is restarting in 1 second..."}

@app.post("/api/action/shutdown", response_model=ActionResponse, dependencies=[Depends(verify_token)])
async def action_shutdown():
    loop = asyncio.get_event_loop()
    loop.call_later(1.0, lambda: MacSystemController.shutdown_system())
    return {"success": True, "message": "iMac is shutting down in 1 second..."}

@app.post("/api/action/quit-apps", response_model=ActionResponse, dependencies=[Depends(verify_token)])
async def action_quit_apps():
    success, msg = MacSystemController.quit_all_desktop_apps()
    return {"success": success, "message": msg}

@app.post("/api/action/quit-app", response_model=ActionResponse, dependencies=[Depends(verify_token)])
async def action_quit_single_app(req: QuitAppRequest):
    success, msg = MacSystemController.quit_app_by_pid(req.pid, force=req.force)
    return {"success": success, "message": msg}

@app.post("/api/action/internet/toggle", response_model=ActionResponse, dependencies=[Depends(verify_token)])
async def action_internet_toggle():
    currently_blocked = MacSystemController.get_internet_blocked_status()
    new_blocked_state = not currently_blocked
    success, msg = MacSystemController.set_internet_blocked(new_blocked_state)
    return {"success": success, "message": msg}

@app.post("/api/action/volume", response_model=ActionResponse, dependencies=[Depends(verify_token)])
async def action_set_volume(req: VolumeRequest):
    success, msg = MacSystemController.set_volume(req.volume)
    return {"success": success, "message": msg}

@app.post("/api/action/mute/toggle", response_model=ActionResponse, dependencies=[Depends(verify_token)])
async def action_toggle_mute():
    success, msg = MacSystemController.toggle_mute()
    return {"success": success, "message": msg}

@app.get("/api/auth/qr")
def get_auth_qr(token: str = Query(...)):
    config = get_or_create_config()
    if token != config.get("api_token"):
        raise HTTPException(status_code=403, detail="Unauthorized")

    from backend.cert_gen import get_local_ips
    ips = [ip for ip in get_local_ips() if ip not in ("127.0.0.1", "localhost")]
    local_ip = ips[0] if ips else "127.0.0.1"
    port = config.get("port", 8765)
    
    setup_url = f"https://{local_ip}:{port}/?token={token}"
    
    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data(setup_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")

app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
