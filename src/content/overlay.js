// Screen Dimmer – universal dimmer content script

const { clamp01 } = window.ScreenDimmerMath;
const storage = window.ScreenDimmerStorage;

const OVERLAY_ID = 'screendimmer-overlay';
const MAX_Z = 2147483647;
const DEFAULT_TRANSITION_MS = typeof DEFAULT_SCHEDULE_TRANSITION_MS === 'number'
  ? DEFAULT_SCHEDULE_TRANSITION_MS
  : 800;
const DEFAULT_TINT_COLOR = typeof DEFAULT_TINT === 'string' ? DEFAULT_TINT : '#000000';
const REFRESH_MESSAGE = 'screendimmer:refresh';

let overlay = null;
let currentLevel = 0;
let aliveObserver = null;
let currentTransitionMs = DEFAULT_TRANSITION_MS;
let currentTint = DEFAULT_TINT_COLOR;

function normalizeTint(value) {
  if (typeof value !== 'string') {
    return DEFAULT_TINT_COLOR;
  }
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const hex = trimmed.slice(1).toLowerCase();
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  return DEFAULT_TINT_COLOR;
}

function tintToRgb(tint) {
  const normalized = normalizeTint(tint);
  const hex = normalized.slice(1);
  return {
    normalized,
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

function ensureOverlay() {
  if (overlay && overlay.isConnected) return overlay;
  overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  const { r, g, b } = tintToRgb(currentTint);
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    background: `rgba(${r},${g},${b},0)`,
    zIndex: String(MAX_Z),
    transition: currentTransitionMs > 0 ? `background ${currentTransitionMs / 1000}s ease` : 'none'
  });
  (document.documentElement || document.body || document.head || document)
    .appendChild(overlay);
  return overlay;
}

function updateTransition(ms) {
  const value = Number.isFinite(ms) ? Math.max(0, Math.min(ms, 60000)) : DEFAULT_TRANSITION_MS;
  if (value === currentTransitionMs && overlay) {
    return;
  }
  currentTransitionMs = value;
  const el = ensureOverlay();
  el.style.transition = currentTransitionMs > 0
    ? `background ${currentTransitionMs / 1000}s ease`
    : 'none';
}

function applyLevel(level, tint) {
  const v = clamp01(level);
  const { normalized, r, g, b } = tintToRgb(typeof tint === 'undefined' ? currentTint : tint);
  currentTint = normalized;
  currentLevel = v;
  const el = ensureOverlay();
  el.style.background = `rgba(${r},${g},${b},${v})`;
}

function startKeepAlive() {
  if (aliveObserver) return;
  aliveObserver = new MutationObserver(() => {
    if (!overlay || !overlay.isConnected) {
      ensureOverlay();
      applyLevel(currentLevel, currentTint);
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
    applyLevel(currentLevel, currentTint);
  }
}
['fullscreenchange','webkitfullscreenchange','msfullscreenchange']
  .forEach(e => document.addEventListener(e, handleFullscreen, true));

async function loadLevel() {
  const host = location.hostname;
  try {
    const { globalLevel, siteLevels, schedule, tintColor } = await storage.getLevelState();
    const transitionTarget = schedule && typeof schedule.transitionMs === 'number'
      ? schedule.transitionMs
      : DEFAULT_TRANSITION_MS;
    updateTransition(transitionTarget);
    if (host && siteLevels && siteLevels[host] != null) {
      applyLevel(siteLevels[host], tintColor);
    } else {
      applyLevel(globalLevel, tintColor);
    }
    startKeepAlive();
  } catch (err) {
    console.error('Failed to load dimmer level', err);
    applyLevel(DEFAULT_LEVEL, DEFAULT_TINT_COLOR);
    updateTransition(DEFAULT_TRANSITION_MS);
  }
}

loadLevel();

// React to changes in either storage area
chrome.storage.onChanged.addListener((changes, area) => {
  if ((changes[GLOBAL_KEY] || changes[SITE_KEY] || changes[SCHEDULE_KEY] || changes[TINT_KEY]) && (area === 'sync' || area === 'local')) {
    loadLevel();
  }
});

if (chrome && chrome.runtime && chrome.runtime.onMessage && typeof chrome.runtime.onMessage.addListener === 'function') {
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === REFRESH_MESSAGE) {
      loadLevel();
    }
  });
}

function resetForTest() {
  if (overlay && typeof overlay.remove === 'function') {
    overlay.remove();
  }
  if (aliveObserver && typeof aliveObserver.disconnect === 'function') {
    aliveObserver.disconnect();
  }
  overlay = null;
  currentLevel = 0;
  aliveObserver = null;
  currentTransitionMs = DEFAULT_TRANSITION_MS;
  currentTint = DEFAULT_TINT_COLOR;
}

if (typeof window !== 'undefined') {
  window.ScreenDimmerOverlay = Object.assign({}, window.ScreenDimmerOverlay, {
    ensureOverlay,
    applyLevel,
    loadLevel,
    updateTransition,
    _resetForTest: resetForTest
  });
}
