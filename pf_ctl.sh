#!/bin/bash
# Wrapper to control pf firewall for iMac Remote Control
ACTION="$1"
CONF_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
CONF_FILE="$CONF_DIR/pf_block.conf"
STATE_FILE="$CONF_DIR/.internet_blocked"

if [ "$ACTION" = "block" ]; then
    sudo pfctl -E -f "$CONF_FILE" 2>/dev/null || pfctl -E -f "$CONF_FILE"
    touch "$STATE_FILE"
    echo "Internet blocked (LAN preserved)"
elif [ "$ACTION" = "unblock" ]; then
    sudo pfctl -d 2>/dev/null || pfctl -d
    rm -f "$STATE_FILE"
    echo "Internet restored"
elif [ "$ACTION" = "status" ]; then
    if [ -f "$STATE_FILE" ]; then
        echo "blocked"
    else
        echo "allowed"
    fi
else
    echo "Usage: $0 {block|unblock|status}"
    exit 1
fi
