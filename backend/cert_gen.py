from pathlib import Path
from datetime import datetime, timedelta, timezone
import ipaddress
import subprocess
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

CERTS_DIR = Path(__file__).resolve().parent.parent / "certs"
CERT_FILE = CERTS_DIR / "cert.pem"
KEY_FILE = CERTS_DIR / "key.pem"

def get_local_ips():
    """Finds all active local IP addresses for certificate SANs."""
    ips = ["127.0.0.1", "localhost"]
    for iface in ["en0", "en1", "en2"]:
        try:
            res = subprocess.run(["ipconfig", "getifaddr", iface], stdout=subprocess.PIPE, text=True)
            if res.returncode == 0 and res.stdout.strip():
                ips.append(res.stdout.strip())
        except Exception:
            pass
    return list(set(ips))

def generate_self_signed_cert():
    """Generates a self-signed TLS cert and private key if not already present."""
    CERTS_DIR.mkdir(parents=True, exist_ok=True)
    if CERT_FILE.exists() and KEY_FILE.exists():
        return str(CERT_FILE), str(KEY_FILE)

    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )

    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "iMac Remote Control"),
        x509.NameAttribute(NameOID.COMMON_NAME, "imac.local"),
    ])

    san_list = []
    for host in get_local_ips():
        try:
            ip_obj = ipaddress.ip_address(host)
            san_list.append(x509.IPAddress(ip_obj))
        except ValueError:
            san_list.append(x509.DNSName(host))

    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.now(timezone.utc))
        .not_valid_after(datetime.now(timezone.utc) + timedelta(days=3650))
        .add_extension(
            x509.SubjectAlternativeName(san_list),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )

    with open(KEY_FILE, "wb") as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))

    with open(CERT_FILE, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    return str(CERT_FILE), str(KEY_FILE)

if __name__ == "__main__":
    c, k = generate_self_signed_cert()
    print(f"Generated certificates:\nCert: {c}\nKey: {k}")
