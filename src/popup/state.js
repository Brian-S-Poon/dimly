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
    const [globalLevel, host, siteLevels, schedule] = await Promise.all([
      storage.getGlobalLevel(),
      getActiveHost(),
      storage.getSiteLevels(),
      storage.getScheduleConfig()
    ]);
    const normalizedGlobal = clamp01(globalLevel);
    const currentSiteLevel = host && typeof siteLevels[host] === 'number'
      ? clamp01(siteLevels[host])
      : null;

    return {
      host,
      siteLevels,
      globalLevel: normalizedGlobal,
      currentSiteLevel,
      schedule
    };
  }

  global.ScreenDimmerPopupState = {
    getActiveHost,
    loadInitialData
  };
})(typeof window !== 'undefined' ? window : this);
