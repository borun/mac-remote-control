#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
USER="$(whoami)"
SUDOERS_FILE="/etc/sudoers.d/imac_remote_pf"

echo "Setting up passwordless sudo rule for pfctl..."
echo "$USER ALL=(ALL) NOPASSWD: /sbin/pfctl, $DIR/pf_ctl.sh" | sudo tee "$SUDOERS_FILE" > /dev/null
sudo chmod 0440 "$SUDOERS_FILE"

echo "Successfully configured! pfctl can now run without password prompts."
