// Screen Dimmer – universal dimmer content script

const OVERLAY_ID = 'screendimmer-overlay';
const MAX_Z = 2147483647;
const DEFAULT_LEVEL = 0.25;
const KEY = 'screendimmer_global_level';

let overlay = null;
let currentLevel = 0;
let aliveObserver = null;

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
  const v = Math.max(0, Math.min(1, Number(level || 0)));
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

// Startup: prefer sync; if not set, check local
chrome.storage.sync.get({ [KEY]: null }, (obj) => {
  if (obj[KEY] != null) {
    applyLevel(obj[KEY]);
  } else {
    chrome.storage.local.get({ [KEY]: DEFAULT_LEVEL }, (lo) => applyLevel(lo[KEY]));
  }
  startKeepAlive();
});

// React to both areas
chrome.storage.onChanged.addListener((changes, area) => {
  if (changes[KEY] && (area === 'sync' || area === 'local')) {
    applyLevel(changes[KEY].newValue);
  }
});
