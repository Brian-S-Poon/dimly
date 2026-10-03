(function (global) {
  const { clamp01 } = global.ScreenDimmerMath;
  const storage = global.ScreenDimmerStorage;
  const siteStorage = global.ScreenDimmerSiteStorage;
  const ui = global.ScreenDimmerPopupUI;
  const state = global.ScreenDimmerPopupState;
  const engagement = global.ScreenDimmerEngagement;
  const i18n = global.ScreenDimmerI18n;
  const optionsButton = document.querySelector('#open-options');

  const getMessage = (key, substitutions) => {
    if (i18n && typeof i18n.getMessage === 'function') {
      return i18n.getMessage(key, substitutions);
    }
    if (Array.isArray(substitutions) && substitutions.length) {
      return substitutions.join(' ');
    }
    return key || '';
  };

  let writeTimer = null;
  let lastLevel = DEFAULT_LEVEL;
  let currentHost = null;
  let currentSiteLevel = null;
  let managerVisible = false;
  let blockedHost = null;
  let scheduleLocked = false;
  let activeEngagementPrompt = null;
  let engagementHandled = false;
  let engagementBusy = false;

  function openExternalTab(url) {
    return new Promise((resolve, reject) => {
      if (!url || url === 'REPLACE_WITH_FINAL_FEEDBACK_SURVEY_URL') {
        reject(new Error('Engagement destination is not configured'));
        return;
      }
      chrome.tabs.create({ url }, () => {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async function initEngagement() {
    if (!engagement || engagementHandled || activeEngagementPrompt) return;
    const result = await engagement.initializeOpen();
    if (!result || !result.prompt || engagementHandled) return;
    activeEngagementPrompt = result.prompt;
    ui.renderEngagementPrompt(activeEngagementPrompt);
  }

  async function runEngagementUpdate(operation) {
    if (!activeEngagementPrompt || engagementBusy || engagementHandled) return false;
    engagementBusy = true;
    ui.setEngagementBusy(true);
    ui.setEngagementError('');
    try {
      await operation(activeEngagementPrompt);
      engagementHandled = true;
      ui.hideEngagementPrompt();
      return true;
    } catch (err) {
      console.error('Failed to persist engagement preference', err);
      ui.setEngagementError(getMessage('engagementPersistenceError'));
      return false;
    } finally {
      engagementBusy = false;
      ui.setEngagementBusy(false);
    }
  }

  async function handleEngagementPrimary() {
    const prompt = activeEngagementPrompt;
    const persisted = await runEngagementUpdate((type) => engagement.action(type));
    if (!persisted) return;
    try {
      await openExternalTab(engagement.getUrl(prompt));
    } catch (err) {
      console.error('Failed to open engagement destination', err);
      engagementHandled = false;
      ui.renderEngagementPrompt(prompt);
      ui.setEngagementError(getMessage('engagementExternalError'));
      ui.setEngagementBusy(false);
    }
  }

  function handleEngagementSnooze() {
    return runEngagementUpdate((type) => engagement.snooze(type));
  }

  function handleEngagementDismiss() {
    return runEngagementUpdate((type) => engagement.dismiss(type));
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

  function applyScheduleLock(enabled) {
    scheduleLocked = Boolean(enabled);
    ui.setScheduleLock(scheduleLocked);
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
    if (scheduleLocked) return;
    const value = clamp01(event.target.value);
    applyLevel(value);
    scheduleGlobalWrite(value);
  }

  function handleLevelChange(event) {
    if (scheduleLocked) return;
    const value = clamp01(event.target.value);
    applyLevel(value);
    scheduleGlobalWrite(value);
  }

  async function handleToggleClick() {
    if (scheduleLocked) return;
    const nextLevel = lastLevel > 0 ? 0 : DEFAULT_LEVEL;
    applyLevel(nextLevel);
    try {
      await storage.setGlobalLevel(nextLevel);
    } catch (err) {
      console.error('Failed to toggle global level', err);
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
      updateSiteUI(getMessage('popupErrorUpdateFailed'));
      syncManagerUI(getMessage('popupErrorUpdateFailed'));
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
      syncManagerUI(getMessage('popupStatusUpdatedHost', [host]));
    } catch (err) {
      console.error('Failed to update site override', err);
      siteStorage.setCache(previousLevels);
      if (host === currentHost) {
        currentSiteLevel = siteStorage.getLevel(currentHost);
        updateSiteUI(getMessage('popupErrorUpdateFailed'));
      }
      syncManagerUI(getMessage('popupErrorUpdateFailed'));
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
      syncManagerUI(getMessage('popupStatusRemovedHost', [host]));
    } catch (err) {
      console.error('Failed to remove site override', err);
      siteStorage.setCache(previousLevels);
      if (host === currentHost) {
        currentSiteLevel = siteStorage.getLevel(currentHost);
        updateSiteUI(getMessage('popupErrorUpdateFailed'));
      }
      syncManagerUI(getMessage('popupErrorUpdateFailed'));
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
      syncManagerUI(getMessage('popupStatusAllCleared'));
    } catch (err) {
      console.error('Failed to reset site overrides', err);
      siteStorage.setCache(previousLevels);
      if (currentHost) {
        currentSiteLevel = siteStorage.getLevel(currentHost);
        updateSiteUI(getMessage('popupErrorUpdateFailed'));
      }
      syncManagerUI(getMessage('popupStatusResetFailed'));
    }
  }

  async function init() {
    ui.bindEvents({
      onLevelInput: handleLevelInput,
      onLevelChange: handleLevelChange,
      onToggleClick: handleToggleClick,
      onSiteToggleClick: handleSiteToggleClick,
      onManageOpen: handleManageOpen,
      onManageClose: handleManageClose,
      onManagerLevelChange: handleManagerLevelChange,
      onManagerDelete: handleManagerDelete,
      onManagerReset: handleManagerReset,
      onEngagementPrimary: handleEngagementPrimary,
      onEngagementSnooze: handleEngagementSnooze,
      onEngagementDismiss: handleEngagementDismiss
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
      applyScheduleLock(initial.scheduleEnabled);
      applyLevel(lastLevel);
      updateSiteUI();
      syncManagerUI('');
    } catch (err) {
      console.error('Failed to initialize popup', err);
      applyLevel(DEFAULT_LEVEL);
      updateSiteUI(getMessage('popupErrorReadSettings'));
    }

    initEngagement().catch((err) => {
      console.error('Failed to initialize engagement prompt', err);
      ui.hideEngagementPrompt();
    });
  }

  init();
})(typeof window !== 'undefined' ? window : this);
