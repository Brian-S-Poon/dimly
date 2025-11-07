import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';

let originalGlobals = {};
let storageGet;
let nextResult;
let nextError;
let windowStub;

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
    SCHEDULE_RULE_TYPES: globalThis.SCHEDULE_RULE_TYPES,
    SCHEDULE_SOLAR_EVENTS: globalThis.SCHEDULE_SOLAR_EVENTS,
    chrome: globalThis.chrome,
    ScreenDimmerStorage: globalThis.ScreenDimmerStorage
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
  globalThis.SCHEDULE_RULE_TYPES = { FIXED: 'fixed', SOLAR: 'solar' };
  globalThis.SCHEDULE_SOLAR_EVENTS = { SUNRISE: 'sunrise', SUNSET: 'sunset' };

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
});

beforeEach(() => {
  nextResult = { sync: undefined, local: undefined };
  nextError = { sync: null, local: null };
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
        enabled: true
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
  assert.equal('location' in result, false);
});
