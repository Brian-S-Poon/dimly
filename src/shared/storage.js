(function (global) {
  const QUOTA_RE = /MAX_WRITE_OPERATIONS_PER_MINUTE/i;

  function storageGet(area, defaults) {
    return new Promise((resolve) => {
      chrome.storage[area].get(defaults, (items) => resolve(items));
    });
  }

  function clampChannel(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.min(255, Math.max(0, Math.round(num)));
  }

  function clampAlpha(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 1;
    return Math.min(1, Math.max(0, num));
  }

  function normalizePreset(preset) {
    if (typeof preset !== 'string') return DEFAULT_TINT_PRESET;
    if (preset === 'custom') return preset;
    if (Object.prototype.hasOwnProperty.call(TINT_PRESETS, preset)) {
      return preset;
    }
    return DEFAULT_TINT_PRESET;
  }

  function sanitizeTint(tint) {
    if (!tint || typeof tint !== 'object') {
      return Object.assign({}, DEFAULT_CUSTOM_TINT);
    }
    return {
      r: clampChannel(tint.r),
      g: clampChannel(tint.g),
      b: clampChannel(tint.b),
      a: clampAlpha(tint.a != null ? tint.a : DEFAULT_CUSTOM_TINT.a)
    };
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

  async function setTintPreset(preset) {
    const normalized = normalizePreset(preset);
    try {
      await chrome.storage.sync.set({ [TINT_PRESET_KEY]: normalized });
      await chrome.storage.local.remove([TINT_PRESET_KEY]);
    } catch (err) {
      if (isQuotaError()) {
        await chrome.storage.local.set({ [TINT_PRESET_KEY]: normalized });
      } else {
        throw err;
      }
    }
  }

  async function setCustomTint(tint) {
    const sanitized = sanitizeTint(tint);
    try {
      await chrome.storage.sync.set({ [CUSTOM_TINT_KEY]: sanitized });
      await chrome.storage.local.remove([CUSTOM_TINT_KEY]);
    } catch (err) {
      if (isQuotaError()) {
        await chrome.storage.local.set({ [CUSTOM_TINT_KEY]: sanitized });
      } else {
        throw err;
      }
    }
  }

  async function getTintState() {
    const [syncValues, localValues] = await Promise.all([
      storageGet('sync', { [TINT_PRESET_KEY]: null, [CUSTOM_TINT_KEY]: null }),
      storageGet('local', {
        [TINT_PRESET_KEY]: DEFAULT_TINT_PRESET,
        [CUSTOM_TINT_KEY]: DEFAULT_CUSTOM_TINT
      })
    ]);

    const presetSource = syncValues[TINT_PRESET_KEY] != null
      ? syncValues[TINT_PRESET_KEY]
      : localValues[TINT_PRESET_KEY];
    const customSource = syncValues[CUSTOM_TINT_KEY]
      || localValues[CUSTOM_TINT_KEY]
      || DEFAULT_CUSTOM_TINT;

    return {
      preset: normalizePreset(presetSource),
      customTint: sanitizeTint(customSource)
    };
  }

  global.ScreenDimmerStorage = {
    storageGet,
    getGlobalLevel,
    setGlobalLevel,
    getSiteLevels,
    setSiteLevels,
    getLevelState,
    setTintPreset,
    setCustomTint,
    getTintState
  };
})(typeof window !== 'undefined' ? window : this);
