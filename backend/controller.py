import asyncio
import os
import subprocess
import psutil
import json
import logging
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger("mac_controller")
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PF_CONF = PROJECT_ROOT / "pf_block.conf"
PF_STATE = PROJECT_ROOT / ".internet_blocked"
PF_SCRIPT = PROJECT_ROOT / "pf_ctl.sh"

class MacSystemController:
    """Controls macOS system actions using AppleScript, JXA, pmset, and pf firewall."""

    @staticmethod
    def _run_cmd(cmd: List[str]) -> tuple[int, str, str]:
        """Runs a system command synchronously and returns (returncode, stdout, stderr)."""
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            return res.returncode, res.stdout.strip(), res.stderr.strip()
        except Exception as e:
            logger.error(f"Command execution error: {e}")
            return -1, "", str(e)

    @staticmethod
    def _run_osascript(script: str) -> tuple[int, str, str]:
        """Executes an AppleScript command."""
        return MacSystemController._run_cmd(["osascript", "-e", script])

    @staticmethod
    def _run_jxa(script: str) -> tuple[int, str, str]:
        """Executes JavaScript for Automation (JXA)."""
        return MacSystemController._run_cmd(["osascript", "-l", "JavaScript", "-e", script])

    @classmethod
    def get_internet_blocked_status(cls) -> bool:
        """Returns True if pf internet block is active."""
        if PF_STATE.exists():
            return True
        code, out, _ = cls._run_cmd(["/sbin/pfctl", "-s", "info"])
        if code == 0 and "Status: Enabled" in out:
            return True
        return False

    @classmethod
    def set_internet_blocked(cls, block: bool) -> tuple[bool, str]:
        """
        Enables or disables pf firewall internet block.
        Executes pfctl with sudo non-interactive.
        """
        if block:
            cmd = f"sudo -n /sbin/pfctl -E -f {PF_CONF}"
            # Use shell=True subprocess to resolve PATH and sudoers
            try:
                res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                if res.returncode == 0 or "ALTQ" in res.stderr:
                    PF_STATE.touch()
                    return True, "Internet blocked (Local LAN & Remote Control preserved)."
                err_msg = res.stderr.strip() or res.stdout.strip()
            except Exception as e:
                err_msg = str(e)

            # Fallback to AppleScript prompt if sudo -n fails
            script = f'do shell script "/sbin/pfctl -E -f \\"{PF_CONF}\\"" with administrator privileges'
            code, out, err = cls._run_osascript(script)
            if code == 0 or "ALTQ" in err:
                PF_STATE.touch()
                return True, "Internet blocked (Local LAN preserved)."
            return False, f"Failed to enable firewall: {err or err_msg}"
        else:
            cmd = "sudo -n /sbin/pfctl -d"
            try:
                res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                if res.returncode == 0 or "ALTQ" in res.stderr or "disabled" in res.stderr:
                    if PF_STATE.exists():
                        PF_STATE.unlink()
                    return True, "Internet restored."
                err_msg = res.stderr.strip() or res.stdout.strip()
            except Exception as e:
                err_msg = str(e)

            script = 'do shell script "/sbin/pfctl -d" with administrator privileges'
            code, out, err = cls._run_osascript(script)
            if code == 0 or "ALTQ" in err or "disabled" in err:
                if PF_STATE.exists():
                    PF_STATE.unlink()
                return True, "Internet restored."
            return False, f"Failed to disable firewall: {err or err_msg}"

    @classmethod
    def lock_screen(cls) -> tuple[bool, str]:
        """Locks the macOS screen."""
        script = 'tell application "System Events" to keystroke "q" using {control down, command down}'
        code, _, err = cls._run_osascript(script)
        if code == 0:
            return True, "Screen locked."
        code2, _, _ = cls._run_cmd(["/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession", "-suspend"])
        if code2 == 0:
            return True, "Screen session suspended."
        return False, f"Failed to lock screen: {err}"

    @classmethod
    def sleep_system(cls) -> tuple[bool, str]:
        """Puts the iMac into sleep mode."""
        code, _, err = cls._run_cmd(["pmset", "sleepnow"])
        if code == 0:
            return True, "iMac put to sleep."
        code2, _, err2 = cls._run_osascript('tell app "System Events" to sleep')
        if code2 == 0:
            return True, "Sleep initiated via System Events."
        return False, f"Failed to sleep: {err or err2}"

    @classmethod
    def restart_system(cls) -> tuple[bool, str]:
        """Restarts the iMac gracefully."""
        code, _, err = cls._run_osascript('tell app "System Events" to restart')
        if code == 0:
            return True, "Restart initiated."
        return False, f"Failed to initiate restart: {err}"

    @classmethod
    def shutdown_system(cls) -> tuple[bool, str]:
        """Shuts down the iMac gracefully."""
        code, _, err = cls._run_osascript('tell app "System Events" to shut down')
        if code == 0:
            return True, "Shutdown initiated."
        return False, f"Failed to initiate shutdown: {err}"

    @classmethod
    def get_running_user_apps(cls) -> List[Dict[str, Any]]:
        """Returns exact list of quitable regular GUI apps (matching macOS Force Quit dialog)."""
        script = '''
        ObjC.import('AppKit');
        var apps = $.NSWorkspace.sharedWorkspace.runningApplications;
        var count = apps.count;
        var result = [];
        for (var i = 0; i < count; i++) {
            var app = apps.objectAtIndex(i);
            if (app.activationPolicy === $.NSApplicationActivationPolicyRegular) {
                var name = ObjC.unwrap(app.localizedName) || 'Unknown';
                var bundleId = ObjC.unwrap(app.bundleIdentifier) || '';
                var pid = app.processIdentifier;
                result.push({
                    name: name,
                    bundle_id: bundleId,
                    pid: pid,
                    is_finder: (bundleId === 'com.apple.finder')
                });
            }
        }
        JSON.stringify(result);
        '''
        code, out, _ = cls._run_jxa(script)
        if code == 0 and out:
            try:
                return json.loads(out)
            except Exception as e:
                logger.error(f"Failed to parse running apps JSON: {e}")
        return []

    @classmethod
    def quit_app_by_pid(cls, pid: int, force: bool = False) -> tuple[bool, str]:
        """Quits an application by PID (gracefully or forced)."""
        force_flag = "true" if force else "false"
        script = f'''
        ObjC.import('AppKit');
        var apps = $.NSWorkspace.sharedWorkspace.runningApplications;
        var count = apps.count;
        var found = false;
        var appName = "";
        for (var i = 0; i < count; i++) {{
            var app = apps.objectAtIndex(i);
            if (app.processIdentifier === {pid}) {{
                appName = ObjC.unwrap(app.localizedName) || 'App';
                found = true;
                if ({force_flag}) {{
                    app.forceTerminate;
                }} else {{
                    app.terminate;
                }}
                break;
            }}
        }}
        JSON.stringify({{ found: found, name: appName }});
        '''
        code, out, err = cls._run_jxa(script)
        if code == 0 and out:
            try:
                res = json.loads(out)
                if res.get("found"):
                    action = "Force quit" if force else "Quit"
                    return True, f"{action} request sent to {res.get('name')} (PID {pid})."
                return False, f"Application with PID {pid} not found."
            except Exception:
                pass
        return False, f"Failed to terminate process {pid}: {err}"

    @classmethod
    def quit_all_desktop_apps(cls, force: bool = False) -> tuple[bool, str]:
        """Quits all regular applications (except Finder)."""
        apps = cls.get_running_user_apps()
        closed_names = []
        for app in apps:
            if app.get("is_finder"):
                continue
            pid = app.get("pid")
            name = app.get("name")
            cls.quit_app_by_pid(pid, force=force)
            closed_names.append(name)

        if closed_names:
            return True, f"Closed {len(closed_names)} applications: {', '.join(closed_names)}"
        return True, "No quitable applications were running."

    @classmethod
    def get_volume(cls) -> int:
        """Returns current system output volume (0-100)."""
        code, out, _ = cls._run_osascript("output volume of (get volume settings)")
        if code == 0 and out.isdigit():
            return int(out)
        return 0

    @classmethod
    def is_muted(cls) -> bool:
        """Returns whether audio is muted."""
        code, out, _ = cls._run_osascript("output muted of (get volume settings)")
        return out.strip().lower() == "true"

    @classmethod
    def set_volume(cls, volume: int) -> tuple[bool, str]:
        """Sets system volume (0-100)."""
        vol = max(0, min(100, volume))
        code, _, err = cls._run_osascript(f"set volume output volume {vol}")
        if code == 0:
            return True, f"Volume set to {vol}%."
        return False, f"Failed to set volume: {err}"

    @classmethod
    def toggle_mute(cls) -> tuple[bool, str]:
        """Toggles mute state."""
        currently_muted = cls.is_muted()
        target = "false" if currently_muted else "true"
        code, _, err = cls._run_osascript(f"set volume output muted {target}")
        if code == 0:
            state_str = "unmuted" if currently_muted else "muted"
            return True, f"Audio {state_str}."
        return False, f"Failed to toggle mute: {err}"

    @classmethod
    def get_telemetry(cls) -> Dict[str, Any]:
        """Collects current system health and status."""
        cpu_percent = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        boot_time = psutil.boot_time()

        return {
            "cpu_percent": cpu_percent,
            "memory_percent": mem.percent,
            "memory_used_gb": round(mem.used / (1024 ** 3), 2),
            "memory_total_gb": round(mem.total / (1024 ** 3), 2),
            "internet_blocked": cls.get_internet_blocked_status(),
            "volume": cls.get_volume(),
            "muted": cls.is_muted(),
            "running_apps": cls.get_running_user_apps(),
            "boot_time": boot_time
        }
