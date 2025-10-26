const slider = document.querySelector('#level');
const pct = document.querySelector('#pct');
const toggleBtn = document.querySelector('#toggle');
const siteControls = document.querySelector('#site-controls');
const siteHostLabel = document.querySelector('#site-host');
const siteStatus = document.querySelector('#site-status');
const siteToggleBtn = document.querySelector('#site-toggle');

const KEY = 'screendimmer_global_level';
const DEFAULT_LEVEL = 0.25;
const SITE_KEY = 'screendimmer_site_levels';
const QUOTA_RE = /MAX_WRITE_OPERATIONS_PER_MINUTE/i;

function clamp01(x){ return Math.max(0, Math.min(1, Number(x || 0))); }
function setUI(v){
  const val = clamp01(v);
  slider.value = String(val);
  pct.textContent = Math.round(val * 100) + '%';
  updateSiteUI();
}

// --- Debounced writer to sync ---
let writeTimer = null;
let lastLevel = DEFAULT_LEVEL;
let currentHost = null;
let siteLevelsCache = {};
let currentSiteLevel = null;

function updateSiteUI() {
  if (!siteControls || !siteHostLabel || !siteStatus) return;
  if (!currentHost) {
    siteControls.hidden = true;
    return;
  }

  siteControls.hidden = false;
  siteHostLabel.textContent = `This site: ${currentHost}`;
  const locked = typeof currentSiteLevel === 'number';
  if (siteToggleBtn) siteToggleBtn.disabled = false;

  if (locked) {
    if (siteToggleBtn) siteToggleBtn.textContent = 'Unlock this site';
    siteStatus.textContent = `Locked at ${Math.round(clamp01(currentSiteLevel) * 100)}% on this site.`;
  } else {
    if (siteToggleBtn) siteToggleBtn.textContent = 'Lock this site at current level';
    siteStatus.textContent = `Uses the global dimmer level (${Math.round(clamp01(lastLevel) * 100)}%).`;
  }
}

function storageGet(area, defaults) {
  return new Promise((resolve) => {
    chrome.storage[area].get(defaults, (items) => resolve(items));
  });
}

async function loadSiteLevels() {
  const syncValues = await storageGet('sync', { [SITE_KEY]: null });
  const localValues = await storageGet('local', { [SITE_KEY]: null });
  return Object.assign({}, localValues[SITE_KEY] || {}, syncValues[SITE_KEY] || {});
}

async function persistSiteLevels(levels) {
  try {
    await chrome.storage.sync.set({ [SITE_KEY]: levels });
    await chrome.storage.local.remove([SITE_KEY]);
  } catch (e) {
    if (chrome.runtime.lastError && QUOTA_RE.test(chrome.runtime.lastError.message)) {
      await chrome.storage.local.set({ [SITE_KEY]: levels });
    } else {
      throw e;
    }
  }
}

async function getActiveHost() {
  const tabs = await new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (found) => {
      if (chrome.runtime.lastError) {
        resolve([]);
      } else {
        resolve(found || []);
      }
    });
  });

  const tab = tabs[0];
  if (!tab || !tab.url) return null;
  try {
    const url = new URL(tab.url);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.hostname;
    }
  } catch (err) {
    // Ignore malformed URLs
  }
  return null;
}

async function initSiteControls() {
  if (!siteControls || !siteToggleBtn || !siteHostLabel || !siteStatus) return;
  const host = await getActiveHost();
  currentHost = host;
  if (!host) {
    updateSiteUI();
    return;
  }

  siteLevelsCache = await loadSiteLevels();
  currentSiteLevel = typeof siteLevelsCache[host] === 'number'
    ? clamp01(siteLevelsCache[host])
    : null;
  updateSiteUI();
}

async function writeSync(level) {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(async () => {
    try {
      await chrome.storage.sync.set({ [KEY]: level });
    } catch (e) {
      if (chrome.runtime.lastError &&
          QUOTA_RE.test(chrome.runtime.lastError.message)) {
        await chrome.storage.local.set({ [KEY]: level });
      }
    }
  }, 250); // adjust delay if needed
}

// Initialize UI
chrome.storage.sync.get({ [KEY]: DEFAULT_LEVEL }, (obj) => {
  lastLevel = obj[KEY];
  setUI(lastLevel);
});

// Input while dragging: update UI immediately, delay writes
slider.addEventListener('input', (e) => {
  const level = clamp01(e.target.value);
  lastLevel = level;
  setUI(level);
  writeSync(level);
});

// Commit on release as well
slider.addEventListener('change', (e) => {
  const level = clamp01(e.target.value);
  lastLevel = level;
  setUI(level);
  writeSync(level);
});

// Toggle writes to sync; if write quotas are hit, mirror to local so the state persists
toggleBtn.addEventListener('click', async () => {
  const obj = await chrome.storage.sync.get({ [KEY]: DEFAULT_LEVEL });
  const next = obj[KEY] > 0 ? 0 : DEFAULT_LEVEL;
  lastLevel = next;
  setUI(next);
  try {
    await chrome.storage.sync.set({ [KEY]: next });
  } catch (e) {
    if (chrome.runtime.lastError &&
        QUOTA_RE.test(chrome.runtime.lastError.message)) {
      await chrome.storage.local.set({ [KEY]: next });
    }
  }
});

if (siteToggleBtn) {
  siteToggleBtn.addEventListener('click', async () => {
    if (!currentHost) return;
    const locking = typeof currentSiteLevel !== 'number';
    const targetLevel = locking ? clamp01(lastLevel) : null;
    const previousLevel = siteLevelsCache[currentHost];

    siteToggleBtn.disabled = true;
    try {
      if (locking) {
        siteLevelsCache[currentHost] = targetLevel;
        currentSiteLevel = targetLevel;
      } else {
        delete siteLevelsCache[currentHost];
        currentSiteLevel = null;
      }
      await persistSiteLevels(siteLevelsCache);
      siteStatus.textContent = locking
        ? `Locked at ${Math.round(targetLevel * 100)}% on this site.`
        : `Uses the global dimmer level (${Math.round(clamp01(lastLevel) * 100)}%).`;
    } catch (err) {
      if (typeof previousLevel === 'number') {
        siteLevelsCache[currentHost] = previousLevel;
        currentSiteLevel = clamp01(previousLevel);
      } else {
        delete siteLevelsCache[currentHost];
        currentSiteLevel = null;
      }
      siteStatus.textContent = 'Could not update site lock. Please try again.';
    } finally {
      siteToggleBtn.disabled = false;
      updateSiteUI();
    }
  });
}

initSiteControls();
