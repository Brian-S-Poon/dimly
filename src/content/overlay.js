// Screen Dimmer – universal dimmer content script

const { clamp01 } = window.ScreenDimmerMath;
const storage = window.ScreenDimmerStorage;

const OVERLAY_ID = 'screendimmer-overlay';
const MAX_Z = 2147483647;

let overlay = null;
let currentLevel = 0;
let currentTintPreset = DEFAULT_TINT_PRESET;
let currentCustomTint = Object.assign({}, DEFAULT_CUSTOM_TINT);
let resolvedTint = { r: 0, g: 0, b: 0 };
let aliveObserver = null;

function cloneTint(tint) {
  if (!tint) return { r: 0, g: 0, b: 0 };
  return {
    r: Number(tint.r) || 0,
    g: Number(tint.g) || 0,
    b: Number(tint.b) || 0
  };
}

function applyTintState(preset, customTint) {
  currentTintPreset = preset || DEFAULT_TINT_PRESET;
  currentCustomTint = Object.assign({}, customTint || DEFAULT_CUSTOM_TINT);
  const source = currentTintPreset === 'custom'
    ? currentCustomTint
    : TINT_PRESETS[currentTintPreset] || TINT_PRESETS[DEFAULT_TINT_PRESET];
  resolvedTint = cloneTint(source);
}

applyTintState(DEFAULT_TINT_PRESET, DEFAULT_CUSTOM_TINT);

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
  const tint = resolvedTint || cloneTint(TINT_PRESETS[DEFAULT_TINT_PRESET]);
  ensureOverlay().style.background = `rgba(${tint.r},${tint.g},${tint.b},${v})`;
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

async function loadState() {
  const host = location.hostname;
  try {
    const [{ globalLevel, siteLevels }, tintState] = await Promise.all([
      storage.getLevelState(),
      storage.getTintState()
    ]);

    applyTintState(tintState && tintState.preset, tintState && tintState.customTint);

    if (host && siteLevels && siteLevels[host] != null) {
      applyLevel(siteLevels[host]);
    } else {
      applyLevel(globalLevel);
    }
    startKeepAlive();
  } catch (err) {
    console.error('Failed to load dimmer state', err);
    applyTintState(DEFAULT_TINT_PRESET, DEFAULT_CUSTOM_TINT);
    applyLevel(DEFAULT_LEVEL);
  }
}

loadState();

// React to changes in either storage area
chrome.storage.onChanged.addListener((changes, area) => {
  const isRelevantArea = area === 'sync' || area === 'local';
  if (!isRelevantArea) return;

  if (changes[GLOBAL_KEY] || changes[SITE_KEY] || changes[TINT_PRESET_KEY] || changes[CUSTOM_TINT_KEY]) {
    loadState();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'screendimmer:update-tint') {
    applyTintState(message.preset, message.customTint);
    applyLevel(currentLevel);
  }
});
