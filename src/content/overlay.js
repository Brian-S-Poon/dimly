// Screen Dimmer – universal dimmer content script

const OVERLAY_ID = 'screendimmer-overlay';
const MAX_Z = 2147483647;
const DEFAULT_LEVEL = 0.25;
const GLOBAL_KEY = 'screendimmer_global_level';
const SITE_KEY = 'screendimmer_site_levels';

let overlay = null;
let currentLevel = 0;
let aliveObserver = null;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

function ensureOverlay() {
  if (overlay && overlay.isConnected) return overlay;
  overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    background: 'rgba(0,0,0,0)',
    zIndex: String(MAX_Z)
  });
  (document.documentElement || document.body || document.head || document)
    .appendChild(overlay);
  return overlay;
}

function applyLevel(level) {
  const v = clamp01(level);
  currentLevel = v;
  ensureOverlay().style.background = `rgba(0,0,0,${v})`;
}

function startKeepAlive() {
  if (aliveObserver) return;
  aliveObserver = new MutationObserver(() => {
    if (!overlay || !overlay.isConnected) {
      ensureOverlay();
      applyLevel(currentLevel);
    } else {
      overlay.style.zIndex = String(MAX_Z);
    }
  });
  aliveObserver.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });
}

function handleFullscreen() {
  const host = document.fullscreenElement || document.documentElement;
  if (!overlay) ensureOverlay();
  if (host && overlay.parentElement !== host) {
    overlay.remove();
    host.appendChild(overlay);
    applyLevel(currentLevel);
  }
}
['fullscreenchange','webkitfullscreenchange','msfullscreenchange']
  .forEach(e => document.addEventListener(e, handleFullscreen, true));

function loadLevel() {
  const host = location.hostname;
  chrome.storage.sync.get({ [GLOBAL_KEY]: null, [SITE_KEY]: null }, (syncValues) => {
    chrome.storage.local.get({ [GLOBAL_KEY]: DEFAULT_LEVEL, [SITE_KEY]: null }, (localValues) => {
      const combinedSiteLevels = Object.assign({}, localValues[SITE_KEY] || {}, syncValues[SITE_KEY] || {});
      const siteLevel = combinedSiteLevels && combinedSiteLevels[host] != null
        ? combinedSiteLevels[host]
        : null;

      if (siteLevel != null) {
        applyLevel(siteLevel);
      } else if (syncValues[GLOBAL_KEY] != null) {
        applyLevel(syncValues[GLOBAL_KEY]);
      } else {
        applyLevel(localValues[GLOBAL_KEY]);
      }
      startKeepAlive();
    });
  });
}

loadLevel();

// React to changes in either storage area
chrome.storage.onChanged.addListener((changes, area) => {
  if ((changes[GLOBAL_KEY] || changes[SITE_KEY]) && (area === 'sync' || area === 'local')) {
    loadLevel();
  }
});
