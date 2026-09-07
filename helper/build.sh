#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$DIR/bin/iMacRemoteHelper.app"
MACOS_DIR="$APP_DIR/Contents/MacOS"
RES_DIR="$APP_DIR/Contents/Resources"

mkdir -p "$MACOS_DIR" "$RES_DIR"
cp "$DIR/helper/bundle/Contents/Info.plist" "$APP_DIR/Contents/Info.plist"

echo "[*] Compiling iMacRemoteHelper..."
swiftc -O "$DIR/helper/imac_screenshot_helper.swift" -o "$MACOS_DIR/iMacRemoteHelper"

# Ad-hoc code sign so macOS TCC tracks the bundle identity reliably
codesign --force --deep --sign - "$APP_DIR" 2>/dev/null || true

echo "[✓] Successfully built: $APP_DIR"
