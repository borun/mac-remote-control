#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PLIST_NAME="com.user.macremote.plist"
TARGET_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "Configuring macOS LaunchAgent for iMac Remote..."

mkdir -p "$HOME/Library/LaunchAgents"

cat << PLIST > "$TARGET_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.macremote</string>
    <key>ProgramArguments</key>
    <array>
        <string>$DIR/venv/bin/python3</string>
        <string>$DIR/run.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$DIR/server.log</string>
    <key>StandardErrorPath</key>
    <string>$DIR/server.err.log</string>
</dict>
</plist>
PLIST

echo "Loading LaunchAgent..."
launchctl unload "$TARGET_PATH" 2>/dev/null || true
launchctl load "$TARGET_PATH"

echo "Service successfully installed and active!"
echo "Check status anytime with: launchctl list | grep com.user.macremote"
