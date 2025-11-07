(function (global) {
  const QUOTA_RE = /MAX_WRITE_OPERATIONS_PER_MINUTE/i;
  const clamp01 = global.ScreenDimmerMath && typeof global.ScreenDimmerMath.clamp01 === 'function'
    ? global.ScreenDimmerMath.clamp01
    : (value) => Math.max(0, Math.min(1, Number(value || 0)));
  const SOLAR_SCHEDULE_ENABLED = Boolean(global.SCREEN_DIMMER_SOLAR_SCHEDULE_ENABLED);

  function cloneDefaults(defaults) {
    if (!defaults || typeof defaults !== 'object') {
      return defaults;
    }
    if (Array.isArray(defaults)) {
      return defaults.slice();
    }
    return Object.assign({}, defaults);
  }

  function storageGet(area, defaults) {
    return new Promise((resolve, reject) => {
      chrome.storage[area].get(defaults, (items) => {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) {
          if (typeof defaults !== 'undefined') {
            resolve(cloneDefaults(defaults));
          } else {
            reject(error);
          }
          return;
        }
        resolve(items);
      });
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

  function cloneScheduleDefault() {
    return JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
  }

  function normalizeSchedule(schedule) {
    const base = cloneScheduleDefault();
    const normalized = Object.assign({}, base, typeof schedule === 'object' && schedule ? schedule : {});
    normalized.enabled = Boolean(normalized.enabled);

    const transitionMs = Number(normalized.transitionMs);
    normalized.transitionMs = Number.isFinite(transitionMs) && transitionMs >= 0 ? Math.min(transitionMs, 60000) : base.transitionMs;

    const fallbackLevel = Number(normalized.fallbackLevel);
    normalized.fallbackLevel = Number.isFinite(fallbackLevel)
      ? clamp01(Math.max(0, Math.min(1, fallbackLevel)))
      : DEFAULT_LEVEL;

    delete normalized.location;

    const rules = Array.isArray(normalized.rules) ? normalized.rules : [];
    const seenIds = new Set();
    normalized.rules = rules.map((rule, index) => {
      const fallbackRule = base.rules[index] || base.rules[0];
      const safeRule = Object.assign({}, fallbackRule, typeof rule === 'object' && rule ? rule : {});
      let id = typeof safeRule.id === 'string' && safeRule.id.trim() ? safeRule.id.trim() : `rule-${Date.now()}-${index}`;
      while (seenIds.has(id)) {
        id = `${id}-${Math.random().toString(16).slice(2, 6)}`;
      }
      seenIds.add(id);
      safeRule.id = id;
      delete safeRule.label;
      safeRule.enabled = Boolean(safeRule.enabled);

      const fallbackLevel = fallbackRule && typeof fallbackRule.level === 'number'
        ? fallbackRule.level
        : DEFAULT_LEVEL;
      const level = Number(safeRule.level);
      safeRule.level = Number.isFinite(level) ? clamp01(level) : clamp01(fallbackLevel);

      const fallbackTime = fallbackRule && typeof fallbackRule.time === 'string'
        ? fallbackRule.time
        : '19:00';
      const isSolarRule = SOLAR_SCHEDULE_ENABLED && safeRule.type === SCHEDULE_RULE_TYPES.SOLAR;

      if (isSolarRule) {
        safeRule.type = SCHEDULE_RULE_TYPES.SOLAR;
        const event = safeRule.event === SCHEDULE_SOLAR_EVENTS.SUNRISE
          ? SCHEDULE_SOLAR_EVENTS.SUNRISE
          : SCHEDULE_SOLAR_EVENTS.SUNSET;
        safeRule.event = event;
        const offset = Number(safeRule.offsetMinutes);
        safeRule.offsetMinutes = Number.isFinite(offset)
          ? Math.max(-720, Math.min(720, offset))
          : 0;
        safeRule.time = null;
      } else {
        const time = typeof safeRule.time === 'string' ? safeRule.time.trim() : '';
        const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(time);
        safeRule.time = match ? `${match[1].padStart(2, '0')}:${match[2]}` : fallbackTime;
        if (SOLAR_SCHEDULE_ENABLED) {
          safeRule.type = SCHEDULE_RULE_TYPES.FIXED;
          safeRule.event = SCHEDULE_SOLAR_EVENTS.SUNSET;
          safeRule.offsetMinutes = 0;
        } else {
          delete safeRule.type;
          delete safeRule.event;
          delete safeRule.offsetMinutes;
        }
      }

      return safeRule;
    });

    return normalized;
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

  async function setSchedule(schedule) {
    const normalized = normalizeSchedule(schedule);
    try {
      await chrome.storage.sync.set({ [SCHEDULE_KEY]: normalized });
      await chrome.storage.local.remove([SCHEDULE_KEY]);
    } catch (err) {
      if (isQuotaError()) {
        await chrome.storage.local.set({ [SCHEDULE_KEY]: normalized });
      } else {
        throw err;
      }
    }
    return normalized;
  }

  async function getSiteLevels() {
    const [syncValues, localValues] = await Promise.all([
      storageGet('sync', { [SITE_KEY]: null }),
      storageGet('local', { [SITE_KEY]: null })
    ]);
    return Object.assign({}, localValues[SITE_KEY] || {}, syncValues[SITE_KEY] || {});
  }

  async function getSchedule() {
    const defaultSchedule = cloneScheduleDefault();
    const [syncValuesRaw, localValuesRaw] = await Promise.all([
      storageGet('sync', null),
      storageGet('local', { [SCHEDULE_KEY]: defaultSchedule })
    ]);

    const syncValues = syncValuesRaw && typeof syncValuesRaw === 'object'
      ? syncValuesRaw
      : {};
    const localValues = localValuesRaw && typeof localValuesRaw === 'object'
      ? localValuesRaw
      : { [SCHEDULE_KEY]: defaultSchedule };

    const hasSyncSchedule = Object.prototype.hasOwnProperty.call(syncValues, SCHEDULE_KEY)
      && syncValues[SCHEDULE_KEY] != null;
    const syncSchedule = hasSyncSchedule ? syncValues[SCHEDULE_KEY] : null;
    const localSchedule = localValues[SCHEDULE_KEY] != null
      ? localValues[SCHEDULE_KEY]
      : defaultSchedule;

    // When sync storage runs out of quota we fall back to local storage writes.
    // In that scenario sync will return an empty object even though the user
    // still has a valid schedule in local storage. Prefer the local copy so the
    // schedule does not silently reset to defaults.
    const source = hasSyncSchedule ? syncSchedule : localSchedule;
    return normalizeSchedule(source);
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
      storageGet('local', { [GLOBAL_KEY]: DEFAULT_LEVEL, [SITE_KEY]: null, [SCHEDULE_KEY]: cloneScheduleDefault() })
    ]);

    const siteLevels = Object.assign({}, localValues[SITE_KEY] || {}, syncValues[SITE_KEY] || {});
    const globalLevel = syncValues[GLOBAL_KEY] != null
      ? syncValues[GLOBAL_KEY]
      : localValues[GLOBAL_KEY];

    const scheduleRaw = syncValues[SCHEDULE_KEY] != null ? syncValues[SCHEDULE_KEY] : localValues[SCHEDULE_KEY];
    const schedule = normalizeSchedule(scheduleRaw);

    return { globalLevel, siteLevels, schedule };
  }

  global.ScreenDimmerStorage = {
    storageGet,
    getGlobalLevel,
    setGlobalLevel,
    getSiteLevels,
    setSiteLevels,
    setSchedule,
    getSchedule,
    getLevelState
  };
})(typeof window !== 'undefined' ? window : this);
