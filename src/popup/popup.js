(function (global) {
  const { clamp01 } = global.ScreenDimmerMath;
  const storage = global.ScreenDimmerStorage;
  const ui = global.ScreenDimmerPopupUI;
  const state = global.ScreenDimmerPopupState;

  let writeTimer = null;
  let lastLevel = DEFAULT_LEVEL;
  let currentHost = null;
  let currentSiteLevel = null;
  let siteLevelsCache = {};
  let tintPreset = DEFAULT_TINT_PRESET;
  let customTint = Object.assign({}, DEFAULT_CUSTOM_TINT);

  function cloneTint(tint) {
    if (!tint) return { r: 0, g: 0, b: 0, a: 1 };
    return {
      r: Number(tint.r) || 0,
      g: Number(tint.g) || 0,
      b: Number(tint.b) || 0,
      a: typeof tint.a === 'number' ? Math.min(1, Math.max(0, tint.a)) : 1
    };
  }

  function applyLevel(level) {
    lastLevel = clamp01(level);
    ui.updateLevel(lastLevel);
    ui.updateGlobal(lastLevel);
    ui.renderSite({
      host: currentHost,
      lockedLevel: currentSiteLevel,
      globalLevel: lastLevel
    });
  }

  function applyTintState(preset, tint) {
    tintPreset = typeof preset === 'string' ? preset : DEFAULT_TINT_PRESET;
    customTint = cloneTint(tint || customTint);
    ui.updateTint({ preset: tintPreset, customTint });
  }

  function updateSiteUI(message) {
    ui.renderSite({
      host: currentHost,
      lockedLevel: currentSiteLevel,
      globalLevel: lastLevel,
      message
    });
  }

  function hexToTint(hex) {
    if (typeof hex !== 'string' || !/^#?[0-9a-fA-F]{6}$/.test(hex)) {
      return cloneTint(customTint);
    }
    const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return { r, g, b, a: 1 };
  }

  function notifyTintChange() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) return;
      const tab = tabs && tabs[0];
      if (!tab || typeof tab.id !== 'number') return;
      chrome.tabs.sendMessage(tab.id, {
        type: 'screendimmer:update-tint',
        preset: tintPreset,
        customTint
      }, () => {
        // Ignore missing receivers
        void chrome.runtime.lastError;
      });
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

  async function handleTintPresetChange(event) {
    const value = typeof event.target.value === 'string'
      ? event.target.value
      : DEFAULT_TINT_PRESET;
    applyTintState(value, customTint);
    try {
      await storage.setTintPreset(value);
    } catch (err) {
      console.error('Failed to update tint preset', err);
    }
    notifyTintChange();
  }

  async function handleCustomTintInput(event) {
    const nextTint = hexToTint(event.target.value);
    customTint = nextTint;
    const previousPreset = tintPreset;
    applyTintState('custom', customTint);
    try {
      await storage.setCustomTint(customTint);
      if (previousPreset !== 'custom') {
        await storage.setTintPreset('custom');
      }
    } catch (err) {
      console.error('Failed to update custom tint', err);
    }
    notifyTintChange();
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

  async function handleToggleClick() {
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
    const previousLevel = siteLevelsCache[currentHost];

    ui.setSiteToggleDisabled(true);
    try {
      if (locking) {
        const nextLevels = Object.assign({}, siteLevelsCache, { [currentHost]: targetLevel });
        await storage.setSiteLevels(nextLevels);
        siteLevelsCache = nextLevels;
        currentSiteLevel = targetLevel;
      } else {
        const nextLevels = Object.assign({}, siteLevelsCache);
        delete nextLevels[currentHost];
        await storage.setSiteLevels(nextLevels);
        siteLevelsCache = nextLevels;
        currentSiteLevel = null;
      }
      updateSiteUI();
    } catch (err) {
      console.error('Failed to update site override', err);
      if (typeof previousLevel === 'number') {
        siteLevelsCache[currentHost] = previousLevel;
        currentSiteLevel = clamp01(previousLevel);
      } else {
        delete siteLevelsCache[currentHost];
        currentSiteLevel = null;
      }
      updateSiteUI('Update failed. Try again.');
    } finally {
      ui.setSiteToggleDisabled(false);
    }
  }

  async function init() {
    ui.bindEvents({
      onLevelInput: handleLevelInput,
      onLevelChange: handleLevelChange,
      onToggleClick: handleToggleClick,
      onSiteToggleClick: handleSiteToggleClick,
      onTintPresetChange: handleTintPresetChange,
      onCustomTintInput: handleCustomTintInput
    });

    try {
      const initial = await state.loadInitialData();
      lastLevel = initial.globalLevel;
      currentHost = initial.host;
      siteLevelsCache = initial.siteLevels || {};
      currentSiteLevel = initial.currentSiteLevel;
      applyTintState(initial.tintPreset, initial.customTint);
      applyLevel(lastLevel);
      updateSiteUI();
    } catch (err) {
      console.error('Failed to initialize popup', err);
      applyLevel(DEFAULT_LEVEL);
      updateSiteUI('Unable to read saved settings.');
    }
  }

  init();
})(typeof window !== 'undefined' ? window : this);
