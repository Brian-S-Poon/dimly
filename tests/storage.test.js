import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';

let originalGlobals = {};
let storageGet;
let nextResult;
let nextError;
let windowStub;
let siteStorage;
const noopSetSiteLevels = async () => {};

function clone(obj) {
  if (typeof obj === 'undefined') {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
}

before(async () => {
  originalGlobals = {
    window: globalThis.window,
    DEFAULT_LEVEL: globalThis.DEFAULT_LEVEL,
    DEFAULT_SCHEDULE: globalThis.DEFAULT_SCHEDULE,
    GLOBAL_KEY: globalThis.GLOBAL_KEY,
    SITE_KEY: globalThis.SITE_KEY,
    SCHEDULE_KEY: globalThis.SCHEDULE_KEY,
    chrome: globalThis.chrome,
    ScreenDimmerStorage: globalThis.ScreenDimmerStorage,
    ScreenDimmerSiteStorage: globalThis.ScreenDimmerSiteStorage
  };

  windowStub = {
    ScreenDimmerMath: {
      clamp01(value) {
        const num = Number(value ?? 0);
        if (Number.isNaN(num)) return 0;
        return Math.max(0, Math.min(1, num));
      }
    }
  };
  windowStub.window = windowStub;

  globalThis.window = windowStub;

  globalThis.DEFAULT_LEVEL = 0.25;
  globalThis.DEFAULT_SCHEDULE = {
    enabled: false,
    transitionMs: 800,
    fallbackLevel: 0.25,
    rules: []
  };
  globalThis.GLOBAL_KEY = 'test_global_key';
  globalThis.SITE_KEY = 'test_site_key';
  globalThis.SCHEDULE_KEY = 'test_schedule_key';
  nextResult = { sync: undefined, local: undefined };
  nextError = { sync: null, local: null };

  const makeGet = (area) => (defaults, callback) => {
    queueMicrotask(() => {
      const error = nextError[area] || null;
      globalThis.chrome.runtime.lastError = error;
      const handler = nextResult[area];
      const value = typeof handler === 'function'
        ? handler(defaults)
        : handler !== undefined
          ? handler
          : defaults;
      callback(value);
      globalThis.chrome.runtime.lastError = null;
    });
  };

  globalThis.chrome = {
    runtime: { lastError: null },
    storage: {
      sync: { get: makeGet('sync') },
      local: { get: makeGet('local') }
    }
  };

  await import('../src/shared/storage.js');
  storageGet = globalThis.window.ScreenDimmerStorage.storageGet;
  globalThis.ScreenDimmerStorage = globalThis.window.ScreenDimmerStorage;

  await import('../src/popup/site-storage.js');
  siteStorage = globalThis.window.ScreenDimmerSiteStorage;
  globalThis.ScreenDimmerSiteStorage = siteStorage;
});

beforeEach(() => {
  nextResult = { sync: undefined, local: undefined };
  nextError = { sync: null, local: null };
  if (siteStorage) {
    siteStorage.setCache({});
  }
  if (globalThis.ScreenDimmerStorage) {
    globalThis.ScreenDimmerStorage.setSiteLevels = noopSetSiteLevels;
  }
});

after(() => {
  if (originalGlobals.window === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalGlobals.window;
  }
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (typeof value === 'undefined') {
      delete globalThis[key];
    } else {
      globalThis[key] = value;
    }
  }
});

test('storageGet resolves with stored values when available', async () => {
  nextResult.sync = (defaults) => ({ ...clone(defaults), level: 0.75 });

  const result = await storageGet('sync', { level: 0.5 });
  assert.deepEqual(result, { level: 0.75 });
});

test('storageGet resolves with defaults when a runtime error occurs', async () => {
  nextError.sync = new Error('boom');
  nextResult.sync = (defaults) => ({ ...clone(defaults), level: 0.9 });

  const result = await storageGet('sync', { level: 0.5 });
  assert.deepEqual(result, { level: 0.5 });
});

test('storageGet rejects when no defaults are provided and an error occurs', async () => {
  nextError.sync = new Error('bad news');

  await assert.rejects(storageGet('sync'), /bad news/);
});

test('getSchedule falls back to local copy when sync is missing', async () => {
  const schedule = {
    enabled: true,
    transitionMs: 1200,
    fallbackLevel: 0.6,
    rules: [
      {
        id: 'evening',
        time: '21:30',
        level: 0.7,
        enabled: false
      }
    ]
  };

  nextResult.sync = {};
  nextResult.local = (defaults) => ({ ...clone(defaults), [SCHEDULE_KEY]: schedule });

  const result = await globalThis.ScreenDimmerStorage.getSchedule();
  assert.equal(result.enabled, true);
  assert.equal(result.transitionMs, 1200);
  assert.equal(result.fallbackLevel, 0.6);
  assert.equal(result.rules.length, 1);
  assert.equal(result.rules[0].time, '21:30');
  assert.equal(result.rules[0].level, 0.7);
  assert.equal('enabled' in result.rules[0], false);
  assert.equal('location' in result, false);
});

test('site storage cache updates only after persistence succeeds', async () => {
  siteStorage.setCache({ 'example.com': 0.2 });

  let resolvePersist;
  const pending = new Promise((resolve) => {
    resolvePersist = resolve;
  });
  const capturedLevels = [];

  globalThis.ScreenDimmerStorage.setSiteLevels = async (levels) => {
    capturedLevels.push(levels);
    return pending;
  };

  const persistPromise = siteStorage.upsert('new.example.com', 0.6);

  assert.deepEqual(siteStorage.getCache(), { 'example.com': 0.2 });
  resolvePersist();
  await persistPromise;

  assert.deepEqual(capturedLevels, [{ 'example.com': 0.2, 'new.example.com': 0.6 }]);
  assert.deepEqual(siteStorage.getCache(), { 'example.com': 0.2, 'new.example.com': 0.6 });
});

test('site storage restores previous cache when persistence fails', async () => {
  siteStorage.setCache({ 'existing.com': 0.4 });
  const error = new Error('persist failed');

  globalThis.ScreenDimmerStorage.setSiteLevels = async () => {
    throw error;
  };

  await assert.rejects(siteStorage.remove('existing.com'), /persist failed/);
  assert.deepEqual(siteStorage.getCache(), { 'existing.com': 0.4 });
});
