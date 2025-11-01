(function (global) {
  const { clamp01 } = global.ScreenDimmerMath;
  const storage = global.ScreenDimmerStorage;

  let cache = {};

  function normalizeLevels(levels) {
    const normalized = {};
    if (!levels || typeof levels !== 'object') {
      return normalized;
    }
    Object.keys(levels).forEach((host) => {
      const value = levels[host];
      if (typeof value === 'number' && Number.isFinite(value)) {
        normalized[host] = clamp01(value);
      }
    });
    return normalized;
  }

  function getCache() {
    return Object.assign({}, cache);
  }

  function setCache(levels) {
    cache = normalizeLevels(levels);
    return getCache();
  }

  function getLevel(host) {
    if (!host || !Object.prototype.hasOwnProperty.call(cache, host)) {
      return null;
    }
    return clamp01(cache[host]);
  }

  async function persist(nextLevels) {
    const normalized = normalizeLevels(nextLevels);
    await storage.setSiteLevels(normalized);
    cache = normalized;
    return getCache();
  }

  async function upsert(host, level) {
    if (!host) {
      return { levels: getCache(), level: null };
    }
    const normalizedLevel = clamp01(typeof level === 'number' ? level : 0);
    const nextLevels = Object.assign({}, cache, { [host]: normalizedLevel });
    const levels = await persist(nextLevels);
    return { levels, level: normalizedLevel };
  }

  async function remove(host) {
    if (!host) {
      return { levels: getCache() };
    }
    if (!Object.prototype.hasOwnProperty.call(cache, host)) {
      return { levels: getCache() };
    }
    const nextLevels = Object.assign({}, cache);
    delete nextLevels[host];
    const levels = await persist(nextLevels);
    return { levels };
  }

  async function reset() {
    const levels = await persist({});
    return { levels };
  }

  global.ScreenDimmerSiteStorage = {
    getCache,
    setCache,
    getLevel,
    upsert,
    remove,
    reset
  };
})(typeof window !== 'undefined' ? window : this);
