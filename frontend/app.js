// iMac Remote Controller Client Script v3

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

// Modal Elements
const confirmModal = document.getElementById('confirm-modal');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');
const toastEl = document.getElementById('toast');

let pendingAction = null;

// Toast Helper
function showToast(msg, duration = 2500) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), duration);
}

// Modal Prompt Helper
function requestConfirmation(title, desc, actionFn) {
  modalTitle.textContent = title;
  modalDesc.textContent = desc;
  pendingAction = actionFn;
  confirmModal.classList.add('active');
}

modalCancel.addEventListener('click', () => {
  confirmModal.classList.remove('active');
  pendingAction = null;
});

modalConfirm.addEventListener('click', async () => {
  confirmModal.classList.remove('active');
  if (pendingAction) {
    const act = pendingAction;
    pendingAction = null;
    await act();
  }
});

// API Helper
async function apiCall(endpoint, method = 'GET', body = null) {
  if (!apiToken) {
    promptForToken();
    return null;
  }

  const headers = {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json'
  };

  try {
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(endpoint, options);
    
    if (res.status === 401) {
      showToast('Authentication failed. Re-enter token.');
      promptForToken();
      return null;
    }

    return await res.json();
  } catch (err) {
    connBadge.textContent = 'Offline';
    connBadge.style.color = 'var(--accent-rose)';
    connBadge.style.borderColor = 'rgba(244, 63, 94, 0.3)';
    connBadge.style.background = 'rgba(244, 63, 94, 0.15)';
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
let isFetching = false;
let isInternetBlocked = false;

async function fetchTelemetry() {
  if (isFetching) return;
  isFetching = true;
  const data = await apiCall('/api/telemetry');
  isFetching = false;

  if (!data) return;

  // Connection badge active
  connBadge.textContent = 'Connected';
  connBadge.style.color = 'var(--accent-emerald)';
  connBadge.style.borderColor = 'rgba(52, 211, 153, 0.3)';
  connBadge.style.background = 'rgba(52, 211, 153, 0.15)';

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

  // Running Apps Render (Force Quit style list)
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
    let isFinder = typeof app === 'object' ? app.is_finder : (name === 'Finder');
    
    if (!name || typeof name !== 'string') name = 'App';
    const initial = name.charAt(0).toUpperCase();

    return `
      <div class="force-quit-item" data-pid="${pid}">
        <div class="app-meta">
          <div class="app-icon-placeholder">${initial}</div>
          <div class="app-details">
            <span class="app-name-text">${escapeHtml(name)}</span>
            ${pid ? `<span class="app-pid-text">PID: ${pid}</span>` : ''}
          </div>
        </div>
        <div class="app-btn-group">
          ${isFinder ? `
            <span style="font-size: 0.75rem; color: var(--text-muted); padding: 4px 8px;">System</span>
          ` : `
            <button class="btn-quit-single" onclick="quitApp(${pid}, '${escapeJs(name)}', false)">Quit</button>
            <button class="btn-force-quit-single" onclick="quitApp(${pid}, '${escapeJs(name)}', true)">Force</button>
          `}
        </div>
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
    }
  );
});

btnShutdown.addEventListener('click', () => {
  requestConfirmation(
    'Shut Down iMac',
    'Are you sure you want to completely power off your iMac?',
    async () => {
      const res = await apiCall('/api/action/shutdown', 'POST');
      if (res) showToast(res.message);
    }
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

// Initial fetch & Polling Interval (every 3 seconds)
if (apiToken) {
  fetchTelemetry();
  setInterval(fetchTelemetry, 3000);
} else {
  promptForToken();
}
