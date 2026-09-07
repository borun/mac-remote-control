// iMac Remote Controller Client Script v8 with Tap-to-Expand App Cards & Inline Timer Badge

// 1. Manage Token
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get('token');
if (tokenFromUrl) {
  localStorage.setItem('imac_api_token', tokenFromUrl);
  window.history.replaceState({}, document.title, window.location.pathname);
}

let apiToken = localStorage.getItem('imac_api_token') || '';

// DOM Elements
const connBadge = document.getElementById('conn-badge');
const offlineBanner = document.getElementById('offline-banner');
const btnRetryConn = document.getElementById('btn-retry-conn');
const mainControlsWrapper = document.getElementById('main-controls-wrapper');

const statCpu = document.getElementById('stat-cpu');
const statCpuBar = document.getElementById('stat-cpu-bar');
const statRam = document.getElementById('stat-ram');
const statRamBar = document.getElementById('stat-ram-bar');
const appsContainer = document.getElementById('apps-container');
const appsCount = document.getElementById('apps-count');
const btnRefreshApps = document.getElementById('btn-refresh-apps');

const btnLock = document.getElementById('btn-lock');
const btnSleep = document.getElementById('btn-sleep');
const btnQuitApps = document.getElementById('btn-quit-apps');
const btnNetToggle = document.getElementById('btn-net-toggle');
const netBtnText = document.getElementById('net-btn-text');

const btnMute = document.getElementById('btn-mute');
const muteText = document.getElementById('mute-text');
const volSlider = document.getElementById('vol-slider');
const volLabel = document.getElementById('vol-label');

const btnRestart = document.getElementById('btn-restart');
const btnShutdown = document.getElementById('btn-shutdown');
const btnSettings = document.getElementById('btn-settings');

// Confirmation Modal Elements
const confirmModal = document.getElementById('confirm-modal');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');
const modalConfirmLabel = document.getElementById('modal-confirm-label');
const modalHoldHint = document.getElementById('modal-hold-hint');
const toastEl = document.getElementById('toast');

// Timer Modal Elements
const timerModal = document.getElementById('timer-modal');
const timerModalTitle = document.getElementById('timer-modal-title');
const timerModalDesc = document.getElementById('timer-modal-desc');
const timerModalCancel = document.getElementById('timer-modal-cancel');
const timerModalConfirm = document.getElementById('timer-modal-confirm');
const customTimerMinsInput = document.getElementById('custom-timer-mins');
const timerForceCheck = document.getElementById('timer-force-check');
const timerOptionBtns = document.querySelectorAll('.timer-option-btn');


// Launch Modal Elements
const btnOpenLaunchModal = document.getElementById('btn-open-launch-modal');
const launchModal = document.getElementById('launch-modal');
const launchModalClose = document.getElementById('launch-modal-close');
const appSearchInput = document.getElementById('app-search-input');
const installedAppsList = document.getElementById('installed-apps-list');

// Screen Modal Elements
const btnOpenScreenModal = document.getElementById('btn-open-screen-modal');
const screenModal = document.getElementById('screen-modal');
const screenModalClose = document.getElementById('screen-modal-close');
const screenTimestamp = document.getElementById('screen-timestamp');
const screenPreviewImg = document.getElementById('screen-preview-img');
const screenLoadingSpinner = document.getElementById('screen-loading-spinner');
const btnRefreshScreen = document.getElementById('btn-refresh-screen');
const btnDownloadScreen = document.getElementById('btn-download-screen');

let installedAppsCache = [];

let pendingAction = null;
let pendingTimerApp = null;
let selectedTimerMinutes = 15;
let activeTimers = {};
let expandedPids = new Set(); // Remember expanded cards across refreshes
let consecutiveFailures = 0;
let isFetching = false;
let isInternetBlocked = false;

// Toast Helper
function showToast(msg, duration = 2500) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), duration);
}

// Spotlight Launch Modal Logic
if (btnOpenLaunchModal) {
  btnOpenLaunchModal.addEventListener('click', async () => {
    launchModal.classList.add('active');
    if (appSearchInput) {
      appSearchInput.value = '';
      setTimeout(() => appSearchInput.focus(), 150);
    }
    await loadInstalledApps();
  });
}

if (launchModalClose) {
  launchModalClose.addEventListener('click', () => {
    launchModal.classList.remove('active');
  });
}

async function loadInstalledApps() {
  if (installedAppsCache.length > 0) {
    renderInstalledApps(installedAppsCache);
    return;
  }
  
  installedAppsList.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 0.85rem;">Scanning applications on iMac...</div>';
  const data = await apiCall('/api/apps/installed');
  if (data && data.apps) {
    installedAppsCache = data.apps;
    renderInstalledApps(installedAppsCache);
  } else {
    installedAppsList.innerHTML = '<div style="text-align: center; color: var(--accent-rose); padding: 20px; font-size: 0.85rem;">Failed to load installed applications.</div>';
  }
}

function renderInstalledApps(apps) {
  if (!apps || apps.length === 0) {
    installedAppsList.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 0.85rem;">No matching applications found</div>';
    return;
  }

  installedAppsList.innerHTML = apps.map(app => {
    const name = typeof app === 'string' ? app : (app.name || 'Unknown');
    const path = typeof app === 'object' && app.path ? app.path : '';
    const initial = name.charAt(0).toUpperCase();
    return `
      <div class="launch-app-item" onclick="launchTargetApp('${escapeJs(name)}', '${escapeJs(path)}')">
        <div class="launch-app-left">
          <div class="launch-icon-placeholder">${initial}</div>
          <span class="launch-app-name">${escapeHtml(name)}</span>
        </div>
        <span class="launch-btn-action">Launch</span>
      </div>
    `;
  }).join('');
}

if (appSearchInput) {
  appSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
      renderInstalledApps(installedAppsCache);
      return;
    }
    const filtered = installedAppsCache.filter(app => {
      const name = typeof app === 'string' ? app : (app.name || '');
      return name.toLowerCase().includes(query);
    });
    renderInstalledApps(filtered);
  });
}

window.launchTargetApp = async function(name, path) {
  launchModal.classList.remove('active');
  showToast(`Launching ${name} on iMac...`);
  
  const payload = { app_name: name };
  if (path) payload.app_path = path;

  const res = await apiCall('/api/action/launch-app', 'POST', payload);
  if (res && res.success) {
    showToast(res.message);
    setTimeout(fetchTelemetry, 1500);
  } else if (res && res.message) {
    showToast(res.message);
  }
};

// Screenshot Modal Logic
async function captureAndDisplayScreen() {
  if (!apiToken) {
    promptForToken();
    return;
  }

  screenLoadingSpinner.style.display = 'flex';
  screenPreviewImg.style.display = 'none';
  screenTimestamp.textContent = 'Capturing...';

  try {
    const res = await fetch(`/api/screen/capture?t=${Date.now()}`, {
      headers: { 'Authorization': `Bearer ${apiToken}` }
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({ detail: 'Failed to capture screenshot.' }));
      showToast(errJson.detail || 'Failed to capture screenshot');
      screenLoadingSpinner.style.display = 'none';
      screenTimestamp.textContent = 'Error';
      return;
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    
    screenPreviewImg.onload = () => {
      screenLoadingSpinner.style.display = 'none';
      screenPreviewImg.style.display = 'block';
      const now = new Date();
      screenTimestamp.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    screenPreviewImg.src = objectUrl;
  } catch (err) {
    showToast('Failed to reach iMac for screenshot');
    screenLoadingSpinner.style.display = 'none';
    screenTimestamp.textContent = 'Offline';
  }
}

if (btnOpenScreenModal) {
  btnOpenScreenModal.addEventListener('click', () => {
    screenModal.classList.add('active');
    captureAndDisplayScreen();
  });
}

if (screenModalClose) {
  screenModalClose.addEventListener('click', () => {
    screenModal.classList.remove('active');
  });
}

if (btnRefreshScreen) {
  btnRefreshScreen.addEventListener('click', () => {
    captureAndDisplayScreen();
  });
}

if (btnDownloadScreen) {
  btnDownloadScreen.addEventListener('click', () => {
    if (!apiToken) return;
    showToast('Downloading screenshot...');
    const dlUrl = `/api/screen/capture?download=true&token=${encodeURIComponent(apiToken)}&t=${Date.now()}`;
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = `iMac-Screen-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}

// Confirmation Prompt Helper with Hold-to-Confirm Support
let holdStartTime = null;
let holdAnimFrame = null;
let isHolding = false;
let isHoldRequired = false;
const REQUIRED_HOLD_MS = 2000;

function resetHoldState() {
  isHolding = false;
  holdStartTime = null;
  if (holdAnimFrame) {
    cancelAnimationFrame(holdAnimFrame);
    holdAnimFrame = null;
  }
  const fill = modalConfirm.querySelector('.hold-fill');
  if (fill) fill.style.width = '0%';
  modalConfirm.classList.remove('holding');
  if (isHoldRequired) {
    if (modalConfirmLabel) modalConfirmLabel.textContent = 'Hold to Confirm';
  }
}

function startHold(e) {
  if (!isHoldRequired) return;
  // Ignore non-primary mouse clicks (e.g. right click)
  if (e.type === 'mousedown' && e.button !== 0) return;
  e.preventDefault();

  isHolding = true;
  holdStartTime = performance.now();
  modalConfirm.classList.add('holding');

  const fill = modalConfirm.querySelector('.hold-fill');

  function tick(now) {
    if (!isHolding) return;
    const elapsed = now - holdStartTime;
    const pct = Math.min(100, (elapsed / REQUIRED_HOLD_MS) * 100);
    if (fill) fill.style.width = `${pct}%`;
    const remainingSec = Math.max(0, ((REQUIRED_HOLD_MS - elapsed) / 1000)).toFixed(1);
    if (modalConfirmLabel) modalConfirmLabel.textContent = `Hold (${remainingSec}s)`;

    if (elapsed >= REQUIRED_HOLD_MS) {
      // Completed hold!
      isHolding = false;
      if (navigator.vibrate) {
        try { navigator.vibrate([40, 60, 40]); } catch (_) {}
      }
      executeConfirmation();
      return;
    }
    holdAnimFrame = requestAnimationFrame(tick);
  }

  holdAnimFrame = requestAnimationFrame(tick);
}

function stopHold() {
  if (!isHoldRequired || !isHolding) return;
  resetHoldState();
}

// Attach hold listeners to modalConfirm
modalConfirm.addEventListener('mousedown', startHold);
window.addEventListener('mouseup', stopHold);

modalConfirm.addEventListener('touchstart', startHold, { passive: false });
window.addEventListener('touchend', stopHold);
window.addEventListener('touchcancel', stopHold);

async function executeConfirmation() {
  confirmModal.classList.remove('active');
  resetHoldState();
  if (pendingAction) {
    const act = pendingAction;
    pendingAction = null;
    await act();
  }
}

function requestConfirmation(title, desc, actionFn, requireHold = false) {
  modalTitle.textContent = title;
  modalDesc.textContent = desc;
  pendingAction = actionFn;
  isHoldRequired = requireHold;

  resetHoldState();

  if (requireHold) {
    modalConfirm.classList.add('modal-btn-hold');
    if (modalHoldHint) modalHoldHint.style.display = 'block';
    if (modalConfirmLabel) modalConfirmLabel.textContent = 'Hold to Confirm';
  } else {
    modalConfirm.classList.remove('modal-btn-hold');
    if (modalHoldHint) modalHoldHint.style.display = 'none';
    if (modalConfirmLabel) modalConfirmLabel.textContent = 'Confirm';
  }

  confirmModal.classList.add('active');
}

modalCancel.addEventListener('click', () => {
  confirmModal.classList.remove('active');
  resetHoldState();
  pendingAction = null;
});

modalConfirm.addEventListener('click', async (e) => {
  // If hold is required, click events are ignored (must complete 2s hold)
  if (isHoldRequired) {
    e.preventDefault();
    return;
  }
  await executeConfirmation();
});

// Timer Setup Modal Logic
timerOptionBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    timerOptionBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedTimerMinutes = parseInt(btn.getAttribute('data-mins'));
    if (customTimerMinsInput) customTimerMinsInput.value = '';
  });
});

if (customTimerMinsInput) {
  customTimerMinsInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    if (val > 0) {
      selectedTimerMinutes = val;
      timerOptionBtns.forEach(b => b.classList.remove('selected'));
    }
  });
}

timerModalCancel.addEventListener('click', () => {
  timerModal.classList.remove('active');
  pendingTimerApp = null;
});

timerModalConfirm.addEventListener('click', async () => {
  if (!pendingTimerApp) return;
  const mins = selectedTimerMinutes;
  const force = timerForceCheck ? timerForceCheck.checked : false;
  const app = pendingTimerApp;

  timerModal.classList.remove('active');
  pendingTimerApp = null;

  showToast(`Setting ${mins}m timer for ${app.name}...`);

  const res = await apiCall('/api/action/app-timer/set', 'POST', {
    pid: parseInt(app.pid),
    app_name: app.name,
    minutes: parseInt(mins),
    force: force
  });

  if (res && res.success) {
    showToast(res.message);
    fetchTelemetry();
  } else if (res && res.detail) {
    showToast(res.detail);
  }
});

window.openTimerModal = function(pid, name) {
  pendingTimerApp = { pid: parseInt(pid), name };
  timerModalTitle.textContent = `Timer for ${name}`;
  timerModalDesc.textContent = `Set when macOS should automatically close ${name}:`;
  selectedTimerMinutes = 15;
  timerOptionBtns.forEach(b => {
    if (b.getAttribute('data-mins') === '15') b.classList.add('selected');
    else b.classList.remove('selected');
  });
  if (customTimerMinsInput) customTimerMinsInput.value = '';
  if (timerForceCheck) timerForceCheck.checked = false;
  timerModal.classList.add('active');
};

window.handleTimerAction = function(pid, name) {
  const timer = activeTimers[pid] || activeTimers[String(pid)];
  if (timer) {
    requestConfirmation(
      `Cancel Timer for ${name}`,
      `A close timer is currently ticking (closing in ${formatRemainingTime(timer.remaining_seconds)}). Do you want to cancel this timer?`,
      async () => {
        const res = await apiCall('/api/action/app-timer/cancel', 'POST', { pid: parseInt(pid) });
        if (res && res.success) {
          showToast(res.message);
          fetchTelemetry();
        }
      }
    );
  } else {
    openTimerModal(pid, name);
  }
};

window.toggleAppCard = function(pid) {
  const card = document.getElementById(`app-card-${pid}`);
  if (!card) return;
  
  if (expandedPids.has(pid)) {
    expandedPids.delete(pid);
    card.classList.remove('expanded');
  } else {
    expandedPids.add(pid);
    card.classList.add('expanded');
  }
};

function formatRuntime(seconds) {
  if (!seconds || seconds <= 0) return '< 1m';
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  if (days > 0) {
    const remHrs = hrs % 24;
    return `${days}d ${remHrs}h`;
  }
  if (hrs > 0) {
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }
  return `${Math.max(1, mins)}m`;
}

function formatRemainingTime(seconds) {
  if (seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  }
  return `${secs}s`;
}

// Update Online / Offline State
function setOnlineState(isOnline) {
  if (isOnline) {
    consecutiveFailures = 0;
    connBadge.textContent = 'Connected';
    connBadge.style.color = 'var(--accent-emerald)';
    connBadge.style.borderColor = 'rgba(52, 211, 153, 0.3)';
    connBadge.style.background = 'rgba(52, 211, 153, 0.15)';
    if (offlineBanner) offlineBanner.classList.remove('active');
    if (mainControlsWrapper) mainControlsWrapper.classList.remove('controls-disabled');
  } else {
    consecutiveFailures++;
    if (consecutiveFailures >= 2) {
      connBadge.textContent = 'Offline';
      connBadge.style.color = 'var(--accent-rose)';
      connBadge.style.borderColor = 'rgba(244, 63, 94, 0.3)';
      connBadge.style.background = 'rgba(244, 63, 94, 0.15)';
      if (offlineBanner) offlineBanner.classList.add('active');
      if (mainControlsWrapper) mainControlsWrapper.classList.add('controls-disabled');
    }
  }
}

// API Helper with Safe Error & Timeout Handling
async function apiCall(endpoint, method = 'GET', body = null, timeoutMs = 6000) {
  if (!apiToken) {
    promptForToken();
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json'
  };

  try {
    const options = { method, headers, signal: controller.signal };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(endpoint, options);
    clearTimeout(timeoutId);
    
    if (res.status === 401) {
      showToast('Authentication failed. Re-enter token.');
      promptForToken();
      return null;
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      if (errJson && errJson.detail) {
        showToast(`Server error: ${errJson.detail}`);
      }
      return null;
    }

    const data = await res.json();
    setOnlineState(true);
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (endpoint.includes('/api/telemetry')) {
      setOnlineState(false);
    } else {
      showToast('Action failed: Request timed out or server unavailable.');
    }
    return null;
  }
}

function promptForToken() {
  const entered = prompt('Please enter your iMac Remote API Token:');
  if (entered) {
    apiToken = entered.trim();
    localStorage.setItem('imac_api_token', apiToken);
    fetchTelemetry();
  }
}

// Fetch Telemetry & App List
async function fetchTelemetry() {
  if (isFetching) return;
  isFetching = true;
  const data = await apiCall('/api/telemetry');
  isFetching = false;

  if (!data) return;

  // CPU
  statCpu.textContent = `${data.cpu_percent.toFixed(1)}%`;
  statCpuBar.style.width = `${Math.min(100, data.cpu_percent)}%`;

  // Memory
  statRam.textContent = `${data.memory_percent.toFixed(0)}%`;
  statRamBar.style.width = `${data.memory_percent}%`;

  // Internet block status
  isInternetBlocked = !!data.internet_blocked;
  if (isInternetBlocked) {
    netBtnText.textContent = 'Restore Internet';
    btnNetToggle.className = 'btn-action btn-danger';
  } else {
    netBtnText.textContent = 'Block Internet';
    btnNetToggle.className = 'btn-action btn-emerald';
  }

  // Volume & Mute
  if (document.activeElement !== volSlider) {
    volSlider.value = data.volume;
    volLabel.textContent = `${data.volume}%`;
  }
  muteText.textContent = data.muted ? 'Unmute' : 'Mute';

  // Active Timers map
  activeTimers = data.active_timers || {};

  // Running Apps Render (Option A: Tap-to-Expand Cards)
  renderAppsList(data.running_apps || []);
}

function renderAppsList(apps) {
  if (appsCount) appsCount.textContent = apps.length;

  if (!apps || apps.length === 0) {
    appsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 12px; font-size: 0.85rem;">No regular desktop apps running</div>';
    return;
  }

  appsContainer.innerHTML = apps.map(app => {
    let name = typeof app === 'object' ? app.name : app;
    let pid = typeof app === 'object' ? app.pid : '';
    let runtime = typeof app === 'object' ? (app.runtime_seconds || 0) : 0;
    let isFinder = typeof app === 'object' ? app.is_finder : (name === 'Finder');
    
    if (!name || typeof name !== 'string') name = 'App';
    const initial = name.charAt(0).toUpperCase();

    // Check if this app has an active timer
    const timer = activeTimers[pid] || activeTimers[String(pid)];
    const isExpanded = expandedPids.has(pid);

    return `
      <div class="expandable-app-card ${isExpanded ? 'expanded' : ''}" id="app-card-${pid}">
        <!-- Card Header (Always Visible, Full Width for Name + Inline Timer) -->
        <div class="app-card-header" onclick="${isFinder ? '' : `toggleAppCard(${pid})`}">
          <div class="app-card-left">
            <div class="app-icon-placeholder">${initial}</div>
            <div class="app-details">
              <div class="app-title-wrap">
                <span class="app-name-full">${escapeHtml(name)}</span>
                ${timer ? `
                  <span 
                    class="app-timer-badge-inline" 
                    id="timer-badge-${pid}"
                    title="Tap card to manage timer">
                    ⏱ ${formatRemainingTime(timer.remaining_seconds)}
                  </span>
                ` : ''}
              </div>
              <div class="app-meta-sub">
                <span class="app-pid-text">PID: ${pid}</span>
                <span class="app-meta-dot">•</span>
                <span class="app-runtime-text" title="Application Runtime">Running: ${formatRuntime(runtime)}</span>
              </div>
            </div>
          </div>
          
          <div class="app-card-right">
            ${isFinder ? `
              <span style="font-size: 0.75rem; color: var(--text-muted); padding: 4px 8px;">System</span>
            ` : `
              <svg class="chevron-icon" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            `}
          </div>
        </div>

        <!-- Expanded Actions Tray (Slides Open with Generous Touch Targets) -->
        ${isFinder ? '' : `
          <div class="app-actions-tray">
            <div class="tray-divider"></div>
            <div class="tray-buttons-grid">
              <button 
                class="tray-btn tray-btn-timer ${timer ? 'has-timer' : ''}" 
                id="tray-timer-btn-${pid}"
                onclick="event.stopPropagation(); handleTimerAction(${pid}, '${escapeJs(name)}')">
                ${timer ? '⏱ Cancel' : '⏱ Timer'}
              </button>
              <button 
                class="tray-btn tray-btn-quit" 
                onclick="event.stopPropagation(); quitApp(${pid}, '${escapeJs(name)}', false)">
                Quit
              </button>
              <button 
                class="tray-btn tray-btn-force" 
                onclick="event.stopPropagation(); quitApp(${pid}, '${escapeJs(name)}', true)">
                Force
              </button>
            </div>
          </div>
        `}
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}

function escapeJs(str) {
  return (str || '').replace(/'/g, "\\'");
}

// Single App Quit handler
window.quitApp = function(pid, name, force) {
  const actionTitle = force ? `Force Quit ${name}` : `Quit ${name}`;
  const desc = force
    ? `Force terminate ${name}? Any unsaved work will be lost immediately.`
    : `Gracefully close ${name}?`;

  requestConfirmation(actionTitle, desc, async () => {
    const res = await apiCall('/api/action/quit-app', 'POST', { pid: parseInt(pid), force });
    if (res) {
      showToast(res.message);
      setTimeout(fetchTelemetry, 700);
    }
  });
};

if (btnRefreshApps) {
  btnRefreshApps.addEventListener('click', () => {
    fetchTelemetry();
    showToast('App list refreshed');
  });
}

if (btnRetryConn) {
  btnRetryConn.addEventListener('click', () => {
    showToast('Checking connection to iMac...');
    fetchTelemetry();
  });
}

// Action Handlers
btnLock.addEventListener('click', async () => {
  const res = await apiCall('/api/action/lock', 'POST');
  if (res) showToast(res.message);
});

btnSleep.addEventListener('click', () => {
  requestConfirmation(
    'Sleep iMac',
    'Put the iMac to sleep? You may need to press a key or use wake-on-LAN to wake it.',
    async () => {
      const res = await apiCall('/api/action/sleep', 'POST');
      if (res) showToast(res.message);
    }
  );
});

btnQuitApps.addEventListener('click', () => {
  requestConfirmation(
    'Close All Applications',
    'This will gracefully quit all open desktop applications (except Finder).',
    async () => {
      const res = await apiCall('/api/action/quit-apps', 'POST');
      if (res) {
        showToast(res.message);
        setTimeout(fetchTelemetry, 1000);
      }
    }
  );
});

btnNetToggle.addEventListener('click', () => {
  const actionTitle = isInternetBlocked ? 'Restore Internet' : 'Block Internet Access';
  const desc = isInternetBlocked
    ? 'Restore external WAN internet access for iMac?'
    : 'Block external WAN internet access on iMac? (Local network & this remote control session will remain connected).';

  requestConfirmation(actionTitle, desc, async () => {
    const res = await apiCall('/api/action/internet/toggle', 'POST');
    if (res) {
      showToast(res.message);
      setTimeout(fetchTelemetry, 1000);
    }
  });
});

btnRestart.addEventListener('click', () => {
  requestConfirmation(
    'Restart iMac',
    'Are you sure you want to restart your iMac now?',
    async () => {
      const res = await apiCall('/api/action/restart', 'POST');
      if (res) showToast(res.message);
    },
    true
  );
});

btnShutdown.addEventListener('click', () => {
  requestConfirmation(
    'Shut Down iMac',
    'Are you sure you want to completely power off your iMac?',
    async () => {
      const res = await apiCall('/api/action/shutdown', 'POST');
      if (res) showToast(res.message);
    },
    true
  );
});

// Media / Volume
volSlider.addEventListener('input', (e) => {
  volLabel.textContent = `${e.target.value}%`;
});

volSlider.addEventListener('change', async (e) => {
  const res = await apiCall('/api/action/volume', 'POST', { volume: parseInt(e.target.value) });
  if (res) showToast(res.message);
});

btnMute.addEventListener('click', async () => {
  const res = await apiCall('/api/action/mute/toggle', 'POST');
  if (res) {
    showToast(res.message);
    fetchTelemetry();
  }
});

btnSettings.addEventListener('click', () => {
  promptForToken();
});

// Live second ticker for inline timer badges & tray buttons
setInterval(() => {
  for (const pid in activeTimers) {
    if (activeTimers[pid].remaining_seconds > 0) {
      activeTimers[pid].remaining_seconds--;
      const formatted = `⏱ ${formatRemainingTime(activeTimers[pid].remaining_seconds)}`;
      
      const inlineBadge = document.getElementById(`timer-badge-${pid}`);
      if (inlineBadge) inlineBadge.textContent = formatted;
      
      const trayBtn = document.getElementById(`tray-timer-btn-${pid}`);
      // Keep Cancel button text static so height never shifts
      if (trayBtn) trayBtn.textContent = '⏱ Cancel';
    }
  }
}, 1000);

// Register Progressive Web App Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration skipped:', err);
    });
  });
}

// Initial fetch & Polling Interval (every 3 seconds)
if (apiToken) {
  fetchTelemetry();
  setInterval(fetchTelemetry, 3000);
} else {
  promptForToken();
}
