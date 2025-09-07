document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('list');
  const status = document.getElementById('status');

  chrome.storage.sync.get({ ignoreList: [] }, data => {
    list.value = data.ignoreList.join('\n');
  });

  document.getElementById('save').addEventListener('click', () => {
    const hosts = list.value
      .split('\n')
      .map(h => h.trim())
      .filter(Boolean);
    chrome.storage.sync.set({ ignoreList: hosts }, () => {
      status.textContent = 'Saved';
      setTimeout(() => (status.textContent = ''), 1500);
    });
  });
});
