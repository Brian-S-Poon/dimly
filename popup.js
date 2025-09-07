const $ = (s) => document.querySelector(s);
const slider = $('#level');
const pct = $('#pct');
const msg = $('#msg');
const host = $('#host');
const toggleBtn = $('#toggle');

function setUI(val) {
  const v = Math.max(0, Math.min(1, Number(val || 0)));
  slider.value = String(v);
  pct.textContent = Math.round(v * 100) + '%';
}

async function withActiveTab(fn) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(fn(tabs[0])));
  });
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

// Init: show hostname and current level (if content script is injected here)
withActiveTab(async (tab) => {
  try { host.textContent = new URL(tab.url).hostname; } catch {}
  const res = await send(tab.id, { type: 'GET_DIM_LEVEL' });
  if (res?.ok) setUI(res.value);
  else if ((res?.error || '').includes('Receiving end does not exist')) {
    msg.textContent = "This page can't be dimmed (browser-restricted).";
    slider.disabled = true;
    toggleBtn.disabled = true;
  } else if (!res?.ok) {
    msg.textContent = 'Not ready on this page.';
  }

  slider.addEventListener('input', async (e) => {
    const val = Number(e.target.value);
    setUI(val);
    await send(tab.id, { type: 'SET_DIM_LEVEL', value: val });
  });

  toggleBtn.addEventListener('click', async () => {
    const res = await send(tab.id, { type: 'GET_DIM_LEVEL' });
    const current = res?.ok ? res.value : 0;
    const next = current > 0 ? 0 : 0.25;
    setUI(next);
    await send(tab.id, { type: 'SET_DIM_LEVEL', value: next });
  });
});
