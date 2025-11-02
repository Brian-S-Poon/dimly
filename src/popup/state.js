(function (global) {
  const { clamp01 } = global.ScreenDimmerMath;
  const storage = global.ScreenDimmerStorage;

  async function getActiveHost() {
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (found) => {
        if (chrome.runtime.lastError) {
          resolve([]);
        } else {
          resolve(found || []);
        }
      });
    });

    const tab = tabs[0];
    if (!tab || !tab.url) return null;
    try {
      const url = new URL(tab.url);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.hostname;
      }
    } catch (err) {
      // Ignore malformed URLs
    }
    return null;
  }

  async function loadInitialData() {
    const [levelState, host] = await Promise.all([
      storage.getLevelState(),
      getActiveHost()
    ]);
    const normalizedGlobal = clamp01(levelState.globalLevel);
    const siteLevels = levelState.siteLevels || {};
    const currentSiteLevel = host && typeof siteLevels[host] === 'number'
      ? clamp01(siteLevels[host])
      : null;

    return {
      host,
      siteLevels,
      globalLevel: normalizedGlobal,
      currentSiteLevel,
      schedule: levelState.schedule
    };
  }

  global.ScreenDimmerPopupState = {
    getActiveHost,
    loadInitialData
  };
})(typeof window !== 'undefined' ? window : this);
