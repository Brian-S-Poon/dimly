const slider = document.querySelector('#level');
const pct = document.querySelector('#pct');
const toggleBtn = document.querySelector('#toggle');

const KEY = 'screendimmer_global_level';
const DEFAULT_LEVEL = 0.25;

function clamp01(x){ return Math.max(0, Math.min(1, Number(x || 0))); }
function setUI(v){
  const val = clamp01(v);
  slider.value = String(val);
  pct.textContent = Math.round(val * 100) + '%';
}

// --- Debounced writer to sync ---
let writeTimer = null;
let lastLevel = DEFAULT_LEVEL;

async function writeSync(level) {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(async () => {
    try {
      await chrome.storage.sync.set({ [KEY]: level });
    } catch (e) {
      if (chrome.runtime.lastError &&
          /MAX_WRITE_OPERATIONS_PER_MINUTE/i.test(chrome.runtime.lastError.message)) {
        await chrome.storage.local.set({ [KEY]: level, [`${KEY}:dirty`]: true });
      }
    }
  }, 250); // adjust delay if needed
}

// Initialize UI
chrome.storage.sync.get({ [KEY]: DEFAULT_LEVEL }, (obj) => {
  lastLevel = obj[KEY];
  setUI(lastLevel);
});

// Input while dragging: update UI immediately, delay writes
slider.addEventListener('input', (e) => {
  const level = clamp01(e.target.value);
  lastLevel = level;
  setUI(level);
  writeSync(level);
});

// Commit on release as well
slider.addEventListener('change', (e) => {
  const level = clamp01(e.target.value);
  lastLevel = level;
  setUI(level);
  writeSync(level);
});

// Toggle writes once
toggleBtn.addEventListener('click', async () => {
  const obj = await chrome.storage.sync.get({ [KEY]: DEFAULT_LEVEL });
  const next = obj[KEY] > 0 ? 0 : DEFAULT_LEVEL;
  lastLevel = next;
  setUI(next);
  try {
    await chrome.storage.sync.set({ [KEY]: next });
  } catch (e) {
    if (chrome.runtime.lastError &&
        /MAX_WRITE_OPERATIONS_PER_MINUTE/i.test(chrome.runtime.lastError.message)) {
      await chrome.storage.local.set({ [KEY]: next, [`${KEY}:dirty`]: true });
    }
  }
});
