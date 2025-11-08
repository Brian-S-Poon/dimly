(function (global) {
  const { clamp01 } = global.ScreenDimmerMath;
  const storage = global.ScreenDimmerStorage;
  const siteStorage = global.ScreenDimmerSiteStorage;
  const ui = global.ScreenDimmerPopupUI;
  const state = global.ScreenDimmerPopupState;
  const optionsButton = document.querySelector('#open-options');

  let writeTimer = null;
  let lastLevel = DEFAULT_LEVEL;
  let currentHost = null;
  let currentSiteLevel = null;
  let managerVisible = false;
  let blockedHost = null;
  let currentTint = DEFAULT_TINT;

  function normalizeTint(value) {
    if (typeof value !== 'string') {
      return DEFAULT_TINT;
    }
    const trimmed = value.trim();
    if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
      const hex = trimmed.slice(1).toLowerCase();
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }
    return DEFAULT_TINT;
  }

  function openOptionsPage() {
    if (!global.chrome || !chrome.runtime) {
      return;
    }
    if (typeof chrome.runtime.openOptionsPage === 'function') {
      chrome.runtime.openOptionsPage();
      return;
    }
    if (typeof chrome.runtime.getURL === 'function') {
      const url = chrome.runtime.getURL('src/options/index.html');
      global.open(url, '_blank', 'noopener');
    }
  }

  function syncManagerUI(message) {
    const levels = siteStorage.getCache();
    ui.updateManageSummary(levels);
    if (managerVisible) {
      ui.renderManager(levels);
      ui.setManagerStatus(message || '');
    }
  }

  function applyLevel(level) {
    lastLevel = clamp01(level);
    ui.updateLevel(lastLevel);
    ui.updateGlobal(lastLevel);
    ui.renderSite({
      host: currentHost,
      lockedLevel: currentSiteLevel,
      globalLevel: lastLevel,
      blockedHost
    });
  }

  function applyTint(tint) {
    currentTint = normalizeTint(tint);
    ui.updateTint(currentTint);
  }

  function updateSiteUI(message) {
    let finalMessage = message;
    if (!finalMessage && blockedHost) {
      finalMessage = RESTRICTED_PAGE_MESSAGE;
    }
    ui.renderSite({
      host: currentHost,
      lockedLevel: currentSiteLevel,
      globalLevel: lastLevel,
      message: finalMessage,
      blockedHost
    });
  }

  function scheduleGlobalWrite(level) {
    clearTimeout(writeTimer);
    writeTimer = setTimeout(async () => {
      try {
        await storage.setGlobalLevel(level);
      } catch (err) {
        console.error('Failed to persist global level', err);
      }
    }, 250);
  }

  function handleLevelInput(event) {
    const value = clamp01(event.target.value);
    applyLevel(value);
    scheduleGlobalWrite(value);
  }

  function handleLevelChange(event) {
    const value = clamp01(event.target.value);
    applyLevel(value);
    scheduleGlobalWrite(value);
  }

  async function broadcastRefresh() {
    if (!global.chrome || !chrome.tabs || typeof chrome.tabs.query !== 'function') {
      return;
    }
    try {
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({}, (results) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve([]);
          } else {
            resolve(results || []);
          }
        });
      });
      if (!Array.isArray(tabs)) return;
      tabs.forEach((tab) => {
        if (!tab || tab.id == null || typeof chrome.tabs.sendMessage !== 'function') {
          return;
        }
        chrome.tabs.sendMessage(tab.id, { type: 'screendimmer:refresh' }, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            // Ignore errors for tabs without the content script.
          }
        });
      });
    } catch (err) {
      console.error('Failed to broadcast refresh', err);
    }
  }

  async function handleToggleClick() {
    const nextLevel = lastLevel > 0 ? 0 : DEFAULT_LEVEL;
    applyLevel(nextLevel);
    try {
      await storage.setGlobalLevel(nextLevel);
      await broadcastRefresh();
    } catch (err) {
      console.error('Failed to toggle global level', err);
    }
  }

  async function handleTintChange(tintValue) {
    const normalized = normalizeTint(tintValue);
    applyTint(normalized);
    try {
      await storage.setGlobalTint(normalized);
      await broadcastRefresh();
    } catch (err) {
      console.error('Failed to update tint color', err);
    }
  }

  async function handleSiteToggleClick() {
    if (!currentHost) return;
    const locking = typeof currentSiteLevel !== 'number';
    const targetLevel = locking ? clamp01(lastLevel) : null;
    const previousLevels = siteStorage.getCache();
    const previousLevel = previousLevels[currentHost];

    ui.setSiteToggleDisabled(true);
    try {
      if (locking) {
        const { level } = await siteStorage.upsert(currentHost, targetLevel);
        currentSiteLevel = level;
      } else {
        await siteStorage.remove(currentHost);
        currentSiteLevel = null;
      }
      updateSiteUI();
      syncManagerUI('');
    } catch (err) {
      console.error('Failed to update site override', err);
      siteStorage.setCache(previousLevels);
      if (typeof previousLevel === 'number') {
        currentSiteLevel = clamp01(previousLevel);
      } else {
        currentSiteLevel = null;
      }
      updateSiteUI('Update failed. Try again.');
      syncManagerUI('Update failed. Try again.');
    } finally {
      ui.setSiteToggleDisabled(false);
    }
  }

  function handleManageOpen() {
    managerVisible = true;
    ui.renderManager(siteStorage.getCache());
    ui.setManagerVisible(true);
    ui.setManagerStatus('');
    ui.focusManagerClose();
  }

  function handleManageClose() {
    managerVisible = false;
    ui.setManagerVisible(false);
    ui.setManagerStatus('');
    ui.focusManageButton();
  }

  async function handleManagerLevelChange(host, value) {
    if (!host) return;
    const previousLevels = siteStorage.getCache();
    try {
      const { level } = await siteStorage.upsert(host, clamp01(value));
      if (host === currentHost) {
        currentSiteLevel = level;
        updateSiteUI();
      }
      syncManagerUI(`Updated ${host}.`);
    } catch (err) {
      console.error('Failed to update site override', err);
      siteStorage.setCache(previousLevels);
      if (host === currentHost) {
        currentSiteLevel = siteStorage.getLevel(currentHost);
        updateSiteUI('Update failed. Try again.');
      }
      syncManagerUI('Update failed. Try again.');
    }
  }

  async function handleManagerDelete(host) {
    if (!host) return;
    const previousLevels = siteStorage.getCache();
    try {
      await siteStorage.remove(host);
      if (host === currentHost) {
        currentSiteLevel = null;
        updateSiteUI();
      }
      syncManagerUI(`Removed ${host}.`);
    } catch (err) {
      console.error('Failed to remove site override', err);
      siteStorage.setCache(previousLevels);
      if (host === currentHost) {
        currentSiteLevel = siteStorage.getLevel(currentHost);
        updateSiteUI('Update failed. Try again.');
      }
      syncManagerUI('Update failed. Try again.');
    }
  }

  async function handleManagerReset() {
    const previousLevels = siteStorage.getCache();
    try {
      await siteStorage.reset();
      if (currentHost && previousLevels[currentHost] != null) {
        currentSiteLevel = null;
        updateSiteUI();
      }
      syncManagerUI('All site settings cleared.');
    } catch (err) {
      console.error('Failed to reset site overrides', err);
      siteStorage.setCache(previousLevels);
      if (currentHost) {
        currentSiteLevel = siteStorage.getLevel(currentHost);
        updateSiteUI('Update failed. Try again.');
      }
      syncManagerUI('Reset failed. Try again.');
    }
  }

  async function init() {
    ui.bindEvents({
      onLevelInput: handleLevelInput,
      onLevelChange: handleLevelChange,
      onToggleClick: handleToggleClick,
      onTintChange: handleTintChange,
      onSiteToggleClick: handleSiteToggleClick,
      onManageOpen: handleManageOpen,
      onManageClose: handleManageClose,
      onManagerLevelChange: handleManagerLevelChange,
      onManagerDelete: handleManagerDelete,
      onManagerReset: handleManagerReset
    });

    if (optionsButton) {
      optionsButton.addEventListener('click', () => {
        try {
          openOptionsPage();
        } catch (err) {
          console.error('Failed to open options page', err);
        }
      });
    }

    try {
      const initial = await state.loadInitialData();
      lastLevel = initial.globalLevel;
      currentHost = initial.host;
      blockedHost = initial.blockedHost || null;
      siteStorage.setCache(initial.siteLevels || {});
      currentSiteLevel = siteStorage.getLevel(currentHost);
      applyTint(initial.tintColor || DEFAULT_TINT);
      applyLevel(lastLevel);
      updateSiteUI();
      syncManagerUI('');
    } catch (err) {
      console.error('Failed to initialize popup', err);
      applyLevel(DEFAULT_LEVEL);
      applyTint(DEFAULT_TINT);
      updateSiteUI('Unable to read saved settings.');
    }
  }

  init();
})(typeof window !== 'undefined' ? window : this);
