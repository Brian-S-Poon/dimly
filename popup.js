const $ = (s) => document.querySelector(s);
const slider = $('#level');
const pct = $('#pct');
const msg = $('#msg');
const host = $('#host');
const toggleBtn = $('#toggle');

function clamp01(x) { return Math.max(0, Math.min(1, Number(x || 0))); }
function setUI(val) {
  const v = clamp01(val);
  slider.value = String(v);
  pct.textContent = Math.round(v * 100) + '%';
}

function send(tabId, payload) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, payload, (res) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(res || { ok: false });
      }
    });
  });
}

async function init() {
  // Get active tab (requires "tabs" permission)
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) { msg.textContent = 'No active tab.'; return; }

  // Show host for clarity
  try { host.textContent = new URL(tab.url).hostname; } catch {}

  // Restricted pages: content script won’t be injected → catch & explain
  const res = await send(tab.id, { type: 'NIGHTLIGHT_GET_LEVEL' });
  if (!res?.ok) {
    if ((res?.error || '').includes('Receiving end does not exist')) {
      msg.textContent = "This page can't be dimmed (browser-restricted).";
      slider.disabled = true;
      toggleBtn.disabled = true;
      return;
    }
    msg.textContent = 'Not available on this page.';
    return;
  }

  // Initialize UI with current value
  setUI(res.level);

  slider.addEventListener('input', async (e) => {
    const level = clamp01(e.target.value);
    setUI(level);
    const r = await send(tab.id, { type: 'NIGHTLIGHT_SET_LEVEL', level });
    if (!r?.ok) msg.textContent = 'Failed to apply dimmer.';
    else msg.textContent = '';
  });

  toggleBtn.addEventListener('click', async () => {
    const r0 = await send(tab.id, { type: 'NIGHTLIGHT_GET_LEVEL' });
    const next = clamp01((r0?.ok ? r0.level : 0) > 0 ? 0 : 0.25);
    setUI(next);
    const r1 = await send(tab.id, { type: 'NIGHTLIGHT_SET_LEVEL', level: next });
    if (!r1?.ok) msg.textContent = 'Failed to toggle.';
    else msg.textContent = '';
  });
}

init();
