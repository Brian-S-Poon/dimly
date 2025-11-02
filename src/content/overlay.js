// Screen Dimmer – universal dimmer content script

const { clamp01 } = window.ScreenDimmerMath;
const storage = window.ScreenDimmerStorage;

const OVERLAY_ID = 'screendimmer-overlay';
const MAX_Z = 2147483647;

let overlay = null;
let currentLevel = 0;
let aliveObserver = null;
let transitionsReady = false;

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
    backgroundColor: 'rgba(0,0,0,0)',
    transition: 'background-color 0.45s ease',
    zIndex: String(MAX_Z)
  });
  (document.documentElement || document.body || document.head || document)
    .appendChild(overlay);
  return overlay;
}

function setOverlayLevel(value, immediate) {
  const node = ensureOverlay();
  if (immediate) {
    node.style.transition = 'none';
    node.style.backgroundColor = `rgba(0,0,0,${value})`;
    requestAnimationFrame(() => {
      node.style.transition = 'background-color 0.45s ease';
      transitionsReady = true;
    });
  } else {
    if (!transitionsReady) {
      node.style.transition = 'background-color 0.45s ease';
      transitionsReady = true;
    }
    node.style.backgroundColor = `rgba(0,0,0,${value})`;
  }
}

function applyLevel(level, options = {}) {
  const v = clamp01(level);
  currentLevel = v;
  setOverlayLevel(v, Boolean(options.immediate));
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

let hasLoadedInitial = false;

async function loadLevel() {
  const host = location.hostname;
  try {
    const { globalLevel, siteLevels } = await storage.getLevelState();
    if (host && siteLevels && siteLevels[host] != null) {
      applyLevel(siteLevels[host], { immediate: !hasLoadedInitial });
    } else {
      applyLevel(globalLevel, { immediate: !hasLoadedInitial });
    }
    startKeepAlive();
    hasLoadedInitial = true;
  } catch (err) {
    console.error('Failed to load dimmer level', err);
    applyLevel(DEFAULT_LEVEL, { immediate: !hasLoadedInitial });
    hasLoadedInitial = true;
  }
}

loadLevel();

// React to changes in either storage area
chrome.storage.onChanged.addListener((changes, area) => {
  if ((changes[GLOBAL_KEY] || changes[SITE_KEY]) && (area === 'sync' || area === 'local')) {
    loadLevel();
  }
});
