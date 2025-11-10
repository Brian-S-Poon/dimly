(function (global) {
  const { clamp01 } = global.ScreenDimmerMath;
  const storage = global.ScreenDimmerStorage;
  const i18n = global.ScreenDimmerI18n;

  const getMessage = (key) => {
    if (i18n && typeof i18n.getMessage === 'function') {
      return i18n.getMessage(key);
    }
    return key || '';
  };

  const RESTRICTED_SITES = [
    {
      label: getMessage('restrictedSiteChromeWebStore'),
      matches: (url) => url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore')
    },
    {
      label: getMessage('restrictedSiteChromeWebStore'),
      matches: (url) => url.hostname === 'chromewebstore.google.com'
    }
  ];

  function resolveRestrictedHost(url) {
    for (let index = 0; index < RESTRICTED_SITES.length; index += 1) {
      const site = RESTRICTED_SITES[index];
      if (site.matches(url)) {
        return site.label;
      }
    }
    return null;
  }

  async function getActiveTabInfo() {
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
    if (!tab || !tab.url) {
      return { host: null, blockedHost: null };
    }
    try {
      const url = new URL(tab.url);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        const blockedHost = resolveRestrictedHost(url);
        if (blockedHost) {
          return { host: null, blockedHost };
        }
        return { host: url.hostname, blockedHost: null };
      }
    } catch (err) {
      // Ignore malformed URLs
    }
    return { host: null, blockedHost: null };
  }

  async function getActiveHost() {
    const info = await getActiveTabInfo();
    return info.host;
  }

  async function loadInitialData() {
    const [levelState, tabInfo] = await Promise.all([
      storage.getLevelState(),
      getActiveTabInfo()
    ]);
    const { host, blockedHost } = tabInfo;
    const normalizedGlobal = clamp01(levelState.globalLevel);
    const siteLevels = levelState.siteLevels || {};
    const currentSiteLevel = host && typeof siteLevels[host] === 'number'
      ? clamp01(siteLevels[host])
      : null;

    return {
      host,
      blockedHost,
      siteLevels,
      globalLevel: normalizedGlobal,
      currentSiteLevel,
      schedule: levelState.schedule
    };
  }

  global.ScreenDimmerPopupState = {
    getActiveHost,
    getActiveTabInfo,
    loadInitialData
  };
})(typeof window !== 'undefined' ? window : this);
