import asyncio
import time
import logging
from typing import Dict, Any, Optional
from backend.controller import MacSystemController

logger = logging.getLogger("timer_manager")

class AppTimerManager:
    """Manages scheduled close/quit timers for running macOS applications."""

    # Map of pid -> timer task info dict
    _timers: Dict[int, Dict[str, Any]] = {}

    @classmethod
    def schedule_app_close(cls, pid: int, app_name: str, duration_seconds: int, force: bool = False) -> Dict[str, Any]:
        """Schedules an app to be terminated after `duration_seconds`."""
        # If an existing timer exists for this PID, cancel it first
        cls.cancel_timer(pid)

        target_time = time.time() + duration_seconds

        async def _timer_worker():
            try:
                await asyncio.sleep(duration_seconds)
                logger.info(f"Timer expired for {app_name} (PID: {pid}). Initiating close...")
                MacSystemController.quit_app_by_pid(pid, force=force)
            except asyncio.CancelledError:
                logger.info(f"Timer for {app_name} (PID: {pid}) was cancelled.")
            finally:
                cls._timers.pop(pid, None)

        task = asyncio.create_task(_timer_worker())

        timer_info = {
            "pid": pid,
            "app_name": app_name,
            "target_timestamp": target_time,
            "total_duration": duration_seconds,
            "force": force,
            "task": task
        }
        cls._timers[pid] = timer_info
        return cls.get_timer_status(pid)

    @classmethod
    def cancel_timer(cls, pid: int) -> bool:
        """Cancels a running timer for an application."""
        if pid in cls._timers:
            timer_info = cls._timers.pop(pid)
            task = timer_info.get("task")
            if task and not task.done():
                task.cancel()
            return True
        return False

    @classmethod
    def get_timer_status(cls, pid: int) -> Optional[Dict[str, Any]]:
        """Returns timer information for a PID, including remaining seconds."""
        if pid in cls._timers:
            info = cls._timers[pid]
            remaining = max(0, int(info["target_timestamp"] - time.time()))
            return {
                "pid": pid,
                "app_name": info["app_name"],
                "remaining_seconds": remaining,
                "total_duration": info["total_duration"],
                "force": info["force"]
            }
        return None

    @classmethod
    def get_all_active_timers(cls) -> Dict[int, Dict[str, Any]]:
        """Returns a map of pid -> timer status for all active timers."""
        active = {}
        now = time.time()
        for pid, info in list(cls._timers.items()):
            remaining = max(0, int(info["target_timestamp"] - now))
            if remaining > 0 and not info["task"].done():
                active[pid] = {
                    "pid": pid,
                    "app_name": info["app_name"],
                    "remaining_seconds": remaining,
                    "total_duration": info["total_duration"],
                    "force": info["force"]
                }
            else:
                cls._timers.pop(pid, None)
        return active
