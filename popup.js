document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggle');
  const slider = document.getElementById('brightness');
  const valueLabel = document.getElementById('value');

  function updateTab(data) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tabId = tabs[0].id;
      chrome.tabs.sendMessage(tabId, {
        command: 'apply',
        enabled: data.enabled,
        brightness: data.brightness
      });
    });
  }

  chrome.storage.sync.get({ enabled: true, brightness: 0.4 }, data => {
    toggle.checked = data.enabled;
    slider.value = Math.round(data.brightness * 100);
    valueLabel.textContent = `${slider.value}%`;
  });

  toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    const brightness = slider.value / 100;
    chrome.storage.sync.set({ enabled, brightness }, () => {
      updateTab({ enabled, brightness });
    });
  });

  slider.addEventListener('input', () => {
    const brightness = slider.value / 100;
    valueLabel.textContent = `${slider.value}%`;
    chrome.storage.sync.set({ brightness }, () => {
      chrome.storage.sync.get({ enabled: true }, data => {
        updateTab({ enabled: data.enabled, brightness });
      });
    });
  });
});
