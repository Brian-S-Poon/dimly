console.log('Night Light loaded');
const OVERLAY_ID = 'nightlight-overlay';

function createOverlay(brightness) {
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '2147483647';
    document.documentElement.appendChild(overlay);
  }
  overlay.style.backgroundColor = `rgba(0,0,0,${brightness})`;
}

function removeOverlay() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) overlay.remove();
}

function applyState({ enabled, brightness }) {
  if (enabled) {
    createOverlay(brightness);
  } else {
    removeOverlay();
  }
}

function init() {
  const host = location.hostname;
  chrome.storage.sync.get(
    { enabled: true, brightness: 0.4, ignoreList: [] },
    data => {
      if (data.ignoreList.includes(host)) {
        removeOverlay();
        return;
      }
      applyState(data);
    }
  );
}

init();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.command === 'apply') {
    applyState(msg);
  }
});
