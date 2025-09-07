// Minimal page-dimmer: creates one fixed overlay and updates it on demand.
const OVERLAY_ID = 'nightlight-min-overlay';

function ensureOverlay() {
  let el = document.getElementById(OVERLAY_ID);
  if (el) return el;

  el = document.createElement('div');
  el.id = OVERLAY_ID;
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    background: 'rgba(0,0,0,0)', // start transparent
    zIndex: '2147483647'         // sit on top
  });
  (document.documentElement || document.body).appendChild(el);
  return el;
}

function setLevel(alpha) {
  const level = Math.max(0, Math.min(1, Number(alpha || 0)));
  ensureOverlay().style.background = `rgba(0,0,0,${level})`;
}

// Create overlay ASAP so the slider has something to talk to.
ensureOverlay();

// Listen for popup messages: set/get the current dim level for this tab.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'SET_DIM_LEVEL') {
    setLevel(msg.value);
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === 'GET_DIM_LEVEL') {
    const el = ensureOverlay();
    const m = el.style.background.match(/rgba\(0,0,0,([\d.]+)\)/);
    const level = m ? Number(m[1]) : 0;
    sendResponse({ ok: true, value: level });
    return true;
  }
});
