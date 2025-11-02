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

  async function setScheduleConfig(config) {
    try {
      await chrome.storage.sync.set({ [SCHEDULE_KEY]: config });
      await chrome.storage.local.remove([SCHEDULE_KEY]);
    } catch (err) {
      if (isQuotaError()) {
        await chrome.storage.local.set({ [SCHEDULE_KEY]: config });
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

  function normalizeSchedule(value) {
    if (!value || typeof value !== 'object') {
      return Object.assign({}, DEFAULT_SCHEDULE, {
        rules: DEFAULT_SCHEDULE.rules.map((rule) => Object.assign({}, rule))
      });
    }

    const enabled = Boolean(value.enabled);
    const fallbackLevel = typeof value.fallbackLevel === 'number'
      ? clampScheduleLevel(value.fallbackLevel)
      : DEFAULT_SCHEDULE.fallbackLevel;

    const rules = Array.isArray(value.rules) && value.rules.length
      ? value.rules.map((rule, index) => normalizeRule(rule, index))
      : DEFAULT_SCHEDULE.rules.map((rule) => Object.assign({}, rule));

    return { enabled, fallbackLevel, rules };
  }

  function clampScheduleLevel(level) {
    return Math.min(Math.max(Number.isFinite(level) ? level : DEFAULT_LEVEL, 0), 1);
  }

  function normalizeRule(rule, index) {
    const base = DEFAULT_SCHEDULE.rules[index] || DEFAULT_SCHEDULE.rules[0];
    const label = typeof rule?.label === 'string' && rule.label.trim()
      ? rule.label.trim()
      : base.label;
    const type = rule?.type === 'sunrise' || rule?.type === 'sunset' || rule?.type === 'custom'
      ? rule.type
      : base.type;
    const time = typeof rule?.time === 'string' ? rule.time : base.time;
    const offsetMinutes = Number.isFinite(rule?.offsetMinutes)
      ? Math.max(Math.min(rule.offsetMinutes, 720), -720)
      : base.offsetMinutes || 0;
    const level = clampScheduleLevel(rule?.level);
    const id = typeof rule?.id === 'string' && rule.id ? rule.id : base.id;

    const normalized = { id, label, type, level };
    if (type === 'custom') {
      normalized.time = sanitizeTimeString(time, base.time);
    } else {
      normalized.offsetMinutes = offsetMinutes;
    }
    if (type !== 'custom' && typeof base.time === 'string') {
      normalized.time = base.time;
    }
    return normalized;
  }

  function sanitizeTimeString(value, fallback) {
    const match = typeof value === 'string' && value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (match) {
      const hours = match[1].padStart(2, '0');
      const minutes = match[2];
      return `${hours}:${minutes}`;
    }
    const fallbackMatch = typeof fallback === 'string'
      ? fallback.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
      : null;
    if (fallbackMatch) {
      const hours = fallbackMatch[1].padStart(2, '0');
      const minutes = fallbackMatch[2];
      return `${hours}:${minutes}`;
    }
    return '06:00';
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
      storageGet('sync', { [GLOBAL_KEY]: null, [SITE_KEY]: null, [SCHEDULE_KEY]: null }),
      storageGet('local', { [GLOBAL_KEY]: DEFAULT_LEVEL, [SITE_KEY]: null, [SCHEDULE_KEY]: null })
    ]);

    const siteLevels = Object.assign({}, localValues[SITE_KEY] || {}, syncValues[SITE_KEY] || {});
    const globalLevel = syncValues[GLOBAL_KEY] != null
      ? syncValues[GLOBAL_KEY]
      : localValues[GLOBAL_KEY];
    const schedule = normalizeSchedule(syncValues[SCHEDULE_KEY] || localValues[SCHEDULE_KEY]);

    return { globalLevel, siteLevels, schedule };
  }

  async function getScheduleConfig() {
    const [syncValues, localValues] = await Promise.all([
      storageGet('sync', { [SCHEDULE_KEY]: null }),
      storageGet('local', { [SCHEDULE_KEY]: null })
    ]);
    const value = syncValues[SCHEDULE_KEY] != null
      ? syncValues[SCHEDULE_KEY]
      : localValues[SCHEDULE_KEY];
    return normalizeSchedule(value);
  }

  global.ScreenDimmerStorage = {
    storageGet,
    getGlobalLevel,
    setGlobalLevel,
    getSiteLevels,
    setSiteLevels,
    getLevelState,
    getScheduleConfig,
    setScheduleConfig
  };
})(typeof window !== 'undefined' ? window : this);
