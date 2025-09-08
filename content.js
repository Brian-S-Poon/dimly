// Pro baseline content script: per-site persistence + robust overlay.
const OVERLAY_ID = 'nightlight-overlay';
const MAX_Z = 2147483647;          // stays above most UI
const DEFAULT_LEVEL = 0.25;        // gentle default
const KEY = `nightlight-level:${location.hostname}`;

let currentLevel = 0;
let overlay = null;
let aliveObserver = null;

// Create or return the overlay
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
    background: 'rgba(0,0,0,0)', // will be set by applyLevel
    zIndex: String(MAX_Z)
  });

  // Prefer <html> root for top-most stacking
  (document.documentElement || document.body || document.head || document)
    .appendChild(overlay);

  return overlay;
}

// Clamp 0..1 and paint
function applyLevel(level) {
  const v = Math.max(0, Math.min(1, Number(level || 0)));
  currentLevel = v;
  ensureOverlay().style.background = `rgba(0,0,0,${v})`;
}

// Keep overlay alive against DOM rewrites (SPAs, portals, etc.)
function startKeepAlive() {
  if (aliveObserver) return;
  aliveObserver = new MutationObserver(() => {
    if (!overlay || !overlay.isConnected) {
      ensureOverlay();
      applyLevel(currentLevel);
    } else {
      // Reassert top-mostness if the page added a higher layer
      overlay.style.zIndex = String(MAX_Z);
    }
  });
  aliveObserver.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });
}

// Follow fullscreen (e.g., videos)
function handleFullscreen() {
  const host = document.fullscreenElement || document.documentElement;
  if (!overlay) ensureOverlay();
  if (overlay.parentElement !== host && host) {
    overlay.remove();
    host.appendChild(overlay);
    applyLevel(currentLevel);
  }
}
['fullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange']
  .forEach(evt => document.addEventListener(evt, handleFullscreen, true));

// Re-apply after SPA navigations
(function patchHistoryForSPA() {
  const push = history.pushState;
  const replace = history.replaceState;
  function onNav() {
    chrome.storage.sync.get(KEY, (obj) => {
      const saved = obj[KEY];
      applyLevel(saved ?? currentLevel ?? DEFAULT_LEVEL);
    });
  }
  history.pushState = function (...args) { const r = push.apply(this, args); onNav(); return r; };
  history.replaceState = function (...args) { const r = replace.apply(this, args); onNav(); return r; };
  window.addEventListener('popstate', onNav);
})();

// Init: load saved level for this hostname
chrome.storage.sync.get(KEY, (obj) => {
  const level = obj[KEY];
  applyLevel(level ?? DEFAULT_LEVEL);
  startKeepAlive();
});

// Messaging API for popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try {
    if (msg?.type === 'NIGHTLIGHT_GET_LEVEL') {
      sendResponse({ ok: true, level: currentLevel });
      return true;
    }
    if (msg?.type === 'NIGHTLIGHT_SET_LEVEL') {
      const level = Math.max(0, Math.min(1, Number(msg.level)));
      applyLevel(level);
      chrome.storage.sync.set({ [KEY]: level });
      sendResponse({ ok: true, level });
      return true;
    }
    if (msg?.type === 'NIGHTLIGHT_TOGGLE') {
      const level = currentLevel > 0 ? 0 : DEFAULT_LEVEL;
      applyLevel(level);
      chrome.storage.sync.set({ [KEY]: level });
      sendResponse({ ok: true, level });
      return true;
    }
  } catch (e) {
    sendResponse({ ok: false, error: String(e) });
  }
});
