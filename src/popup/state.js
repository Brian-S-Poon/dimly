(function (global) {
  const { clamp01 } = global.ScreenDimmerMath;
  const storage = global.ScreenDimmerStorage;

  const RESTRICTED_SITES = [
    {
      label: 'Chrome Web Store',
      matches: (url) => url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore')
    },
    {
      label: 'Chrome Web Store',
      matches: (url) => url.hostname === 'chromewebstore.google.com'
    }
  ];

  function normalizeTint(tint) {
    if (typeof tint !== 'string') {
      return DEFAULT_TINT;
    }
    const trimmed = tint.trim();
    if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
      const hex = trimmed.slice(1).toLowerCase();
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }
    return DEFAULT_TINT;
  }

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
      schedule: levelState.schedule,
      tintColor: normalizeTint(levelState.tintColor)
    };
  }

  global.ScreenDimmerPopupState = {
    getActiveHost,
    getActiveTabInfo,
    loadInitialData
  };
})(typeof window !== 'undefined' ? window : this);
