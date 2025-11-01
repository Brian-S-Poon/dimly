// Screen Dimmer – universal dimmer content script

const { clamp01 } = window.ScreenDimmerMath;
const storage = window.ScreenDimmerStorage;

const OVERLAY_ID = 'screendimmer-overlay';
const MAX_Z = 2147483647;

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

async function loadLevel() {
  const host = location.hostname;
  try {
    const { globalLevel, siteLevels } = await storage.getLevelState();
    if (host && siteLevels && siteLevels[host] != null) {
      applyLevel(siteLevels[host]);
    } else {
      applyLevel(globalLevel);
    }
    startKeepAlive();
  } catch (err) {
    console.error('Failed to load dimmer level', err);
    applyLevel(DEFAULT_LEVEL);
  }
}

loadLevel();

// React to changes in either storage area
chrome.storage.onChanged.addListener((changes, area) => {
  if ((changes[GLOBAL_KEY] || changes[SITE_KEY]) && (area === 'sync' || area === 'local')) {
    loadLevel();
  }
});
