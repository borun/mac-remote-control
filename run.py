import uvicorn
from pathlib import Path
from backend.security import get_or_create_config
from backend.cert_gen import generate_self_signed_cert, get_local_ips

if __name__ == "__main__":
    config = get_or_create_config()
    cert_file, key_file = generate_self_signed_cert()
    
    port = config.get("port", 8765)
    host = config.get("host", "0.0.0.0")
    token = config.get("api_token")
    
    ips = [ip for ip in get_local_ips() if ip not in ("127.0.0.1", "localhost")]
    primary_ip = ips[0] if ips else "127.0.0.1"

    print("=" * 60)
    print(" 🚀 iMac Remote Control Server Starting")
    print("=" * 60)
    print(f" * Local URL:   https://localhost:{port}")
    print(f" * Network URL: https://{primary_ip}:{port}")
    print(f" * Setup Link:  https://{primary_ip}:{port}/?token={token}")
    print("=" * 60)
    print(f" [!] Scan or click the Setup Link to automatically pair your phone.")
    print("=" * 60)

    uvicorn.run(
        "backend.main:app",
        host=host,
        port=port,
        ssl_certfile=cert_file,
        ssl_keyfile=key_file,
        log_level="info"
    )
