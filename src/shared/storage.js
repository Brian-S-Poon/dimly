(function (global) {
  const QUOTA_RE = /MAX_WRITE_OPERATIONS_PER_MINUTE/i;

  function storageGet(area, defaults) {
    return new Promise((resolve) => {
      chrome.storage[area].get(defaults, (items) => resolve(items));
    });
  }

  function isQuotaError() {
    const message = chrome.runtime.lastError && chrome.runtime.lastError.message;
    return Boolean(message && QUOTA_RE.test(message));
  }

  async function setGlobalLevel(level) {
    try {
      await chrome.storage.sync.set({ [GLOBAL_KEY]: level });
      await chrome.storage.local.remove([GLOBAL_KEY]);
    } catch (err) {
      if (isQuotaError()) {
        await chrome.storage.local.set({ [GLOBAL_KEY]: level });
      } else {
        throw err;
      }
    }
  }

  async function setSiteLevels(levels) {
    try {
      await chrome.storage.sync.set({ [SITE_KEY]: levels });
      await chrome.storage.local.remove([SITE_KEY]);
    } catch (err) {
      if (isQuotaError()) {
        await chrome.storage.local.set({ [SITE_KEY]: levels });
      } else {
        throw err;
      }
    }
  }

  async function getSiteLevels() {
    const [syncValues, localValues] = await Promise.all([
      storageGet('sync', { [SITE_KEY]: null }),
      storageGet('local', { [SITE_KEY]: null })
    ]);
    return Object.assign({}, localValues[SITE_KEY] || {}, syncValues[SITE_KEY] || {});
  }

  async function getGlobalLevel() {
    const [syncValues, localValues] = await Promise.all([
      storageGet('sync', { [GLOBAL_KEY]: null }),
      storageGet('local', { [GLOBAL_KEY]: DEFAULT_LEVEL })
    ]);
    if (syncValues[GLOBAL_KEY] != null) {
      return syncValues[GLOBAL_KEY];
    }
    return localValues[GLOBAL_KEY];
  }

  async function getLevelState() {
    const [syncValues, localValues] = await Promise.all([
      storageGet('sync', { [GLOBAL_KEY]: null, [SITE_KEY]: null }),
      storageGet('local', { [GLOBAL_KEY]: DEFAULT_LEVEL, [SITE_KEY]: null })
    ]);

    const siteLevels = Object.assign({}, localValues[SITE_KEY] || {}, syncValues[SITE_KEY] || {});
    const globalLevel = syncValues[GLOBAL_KEY] != null
      ? syncValues[GLOBAL_KEY]
      : localValues[GLOBAL_KEY];

    return { globalLevel, siteLevels };
  }

  global.ScreenDimmerStorage = {
    storageGet,
    getGlobalLevel,
    setGlobalLevel,
    getSiteLevels,
    setSiteLevels,
    getLevelState
  };
})(typeof window !== 'undefined' ? window : this);
