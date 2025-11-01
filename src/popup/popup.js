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

  function updateSiteUI(message) {
    ui.renderSite({
      host: currentHost,
      lockedLevel: currentSiteLevel,
      globalLevel: lastLevel,
      message
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
      onSiteToggleClick: handleSiteToggleClick
    });

    try {
      const initial = await state.loadInitialData();
      lastLevel = initial.globalLevel;
      currentHost = initial.host;
      siteLevelsCache = initial.siteLevels || {};
      currentSiteLevel = initial.currentSiteLevel;
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
