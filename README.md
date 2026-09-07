# iMac Remote Control (Secure macOS PWA)

A private, secure, lightweight Progressive Web App (PWA) and backend daemon to control your iMac remotely from your iPhone, Android, or secondary laptop.

---

## Features

- **macOS System Power Control**:
  - Shut down, restart, sleep (`pmset`), and screen lock.
  - Safe confirmation modals on mobile to prevent accidental taps.
- **Application Manager (Force Quit Style)**:
  - Live inspection of running regular GUI applications (`NSWorkspace.runningApplications`).
  - View individual application names, app icons, and PIDs.
  - One-tap graceful **Quit** or **Force Quit** for individual apps.
  - One-tap **Close All Desktop Apps** (sparing system processes like Finder).
- **Graceful Internet Blocker (LAN Safe)**:
  - Powered by macOS kernel packet filtering (`/sbin/pfctl`).
  - Blocks external WAN internet while **preserving your local network and the remote control connection**, allowing you to restore internet at any time.
- **Audio & Media Control**:
  - Real-time volume slider (0–100%) and instant mute/unmute toggle.
- **Live System Telemetry**:
  - Real-time CPU usage, RAM utilization, active desktop apps, and connection state.
- **End-to-End Security**:
  - Encrypted TLS/HTTPS with auto-generated RSA certificates.
  - Pre-shared high-entropy cryptographic Bearer token authentication.
  - Inline Base64 Apple touch icons for seamless iPhone and macOS "Add to Home Screen" support.

---

## Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/mac-remote-control.git
cd mac-remote-control
```

### 2. Set Up Virtual Environment & Dependencies
```bash
python3 -m venv venv
./venv/bin/pip install fastapi uvicorn psutil pydantic cryptography python-multipart "qrcode[pil]"
```

### 3. (Optional) Configure Passwordless Firewall Control
To allow the Internet Blocker to toggle `/sbin/pfctl` silently without interactive macOS password prompts:
```bash
chmod +x setup_sudoers.sh
./setup_sudoers.sh
```

---

## Running the Server

### Manual Foreground Run (Testing)
```bash
./venv/bin/python3 run.py
```
Upon startup, the console prints:
- Local URL (e.g. `https://localhost:8765`)
- Network URL (e.g. `https://192.168.88.234:8765`)
- Direct Pairing Link with your secret token pre-filled (e.g. `https://192.168.88.234:8765/?token=...`)

### Run Automatically on macOS Startup (LaunchAgent Daemon)
To keep the server running silently in the background whenever you log into macOS:
```bash
chmod +x install_service.sh
./install_service.sh
```

To stop or uninstall the background service:
```bash
launchctl unload ~/Library/LaunchAgents/com.user.macremote.plist
rm -f ~/Library/LaunchAgents/com.user.macremote.plist
```

---

## Adding to Your iPhone / Mobile Device (PWA)

1. Make sure your iPhone is connected to the same Wi-Fi network (or Tailscale VPN).
2. Open Safari on your iPhone and visit the **Setup Link** printed in your terminal.
3. When Safari warns *"This Connection Is Not Private"* (due to the self-signed local certificate):
   - Tap **Show Details** &rarr; **visit this website** and confirm.
4. Tap the **Share** button in Safari (the box with an upward arrow).
5. Scroll down and select **"Add to Home Screen"**.
6. The custom blue power ring icon will appear. Tap **Add**.
7. Open the **iMac Remote** app from your home screen for a fullscreen native app experience!

---

## Remote Access Away from Home (Anywhere in the World)
To control your iMac securely outside your home network without port-forwarding or public IP exposure:
1. Install [Tailscale](https://tailscale.com) on your iMac and iPhone (free).
2. Use your iMac's private Tailscale IP (e.g., `https://100.x.y.z:8765`) in Safari.
3. You now have encrypted remote access through WireGuard from anywhere.

---

## Screen Capture & Security Isolation

The app includes a live screen capture preview and download feature designed with **permission isolation**:

1. **Security Architecture**:
   - Rather than granting broad Screen Recording permissions to `python3` (which would allow any Python script on your system to capture your screen), the app compiles a tiny, dedicated native helper (`bin/imac_screenshot_helper`) from `helper/imac_screenshot_helper.swift`.
   - Screen Recording permission in macOS is granted **strictly to `imac_screenshot_helper`**, leaving your Python environment completely unprivileged.
2. **First-Time Permission Setup**:
   - The first time you tap **Screen Shot** in the PWA, macOS will prompt:
     > *"imac_screenshot_helper would like to record this computer's screen"*
   - Click **Allow** (or enable it in **System Settings > Privacy & Security > Screen Recording**).
3. **Manual Compilation (if swiftc auto-compile fails)**:
   - If `swiftc` command-line tools are not installed, run:
     ```bash
     xcode-select --install
     ```
   - To manually compile the helper binary at any time:
     ```bash
     swiftc -O helper/imac_screenshot_helper.swift -o bin/imac_screenshot_helper
     ```
   - If the helper is not compiled or fails, the backend automatically falls back to native `/usr/sbin/screencapture`.

---

## License
MIT License. Free for personal and commercial use.
