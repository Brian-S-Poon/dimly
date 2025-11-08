import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';

let tabsResult = [];
let originalGlobals = {};
let windowStub;
let storageState;
let defaultSchedule;

function clamp01(value) {
  const num = Number(value ?? 0);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

before(async () => {
  defaultSchedule = {
    enabled: false,
    transitionMs: 800,
    fallbackLevel: 0.25,
    rules: []
  };
  globalThis.DEFAULT_SCHEDULE = defaultSchedule;
  storageState = { globalLevel: 0, siteLevels: {}, schedule: defaultSchedule, tintColor: '#000000' };
  originalGlobals = {
    window: globalThis.window,
    ScreenDimmerMath: globalThis.ScreenDimmerMath,
    ScreenDimmerStorage: globalThis.ScreenDimmerStorage,
    chrome: globalThis.chrome,
    DEFAULT_TINT: globalThis.DEFAULT_TINT
  };

  windowStub = {
    ScreenDimmerMath: { clamp01 },
    ScreenDimmerStorage: {
      getLevelState: () => Promise.resolve({
        globalLevel: storageState.globalLevel,
        siteLevels: { ...storageState.siteLevels },
        schedule: storageState.schedule,
        tintColor: storageState.tintColor
      })
    }
  };
  windowStub.window = windowStub;

  globalThis.window = windowStub;
  globalThis.ScreenDimmerMath = windowStub.ScreenDimmerMath;
  globalThis.ScreenDimmerStorage = windowStub.ScreenDimmerStorage;
  globalThis.DEFAULT_TINT = '#000000';

  globalThis.chrome = {
    tabs: {
      query: (_query, callback) => {
        const result = tabsResult.slice();
        queueMicrotask(() => {
          globalThis.chrome.runtime.lastError = null;
          callback(result);
        });
      }
    },
    runtime: {
      lastError: null
    }
  };

  await import('../src/popup/state.js');
});

beforeEach(() => {
  tabsResult = [];
  storageState.globalLevel = 0;
  storageState.siteLevels = {};
  storageState.schedule = JSON.parse(JSON.stringify(defaultSchedule));
  storageState.tintColor = '#000000';
  globalThis.chrome.runtime.lastError = null;
});

after(() => {
  globalThis.window = originalGlobals.window;
  globalThis.ScreenDimmerMath = originalGlobals.ScreenDimmerMath;
  globalThis.ScreenDimmerStorage = originalGlobals.ScreenDimmerStorage;
  globalThis.chrome = originalGlobals.chrome;
  if (typeof originalGlobals.DEFAULT_TINT === 'undefined') {
    delete globalThis.DEFAULT_TINT;
  } else {
    globalThis.DEFAULT_TINT = originalGlobals.DEFAULT_TINT;
  }
});

function setStorage(values) {
  storageState.globalLevel = values.globalLevel;
  storageState.siteLevels = values.siteLevels;
  const scheduleValue = values.schedule || defaultSchedule;
  storageState.schedule = JSON.parse(JSON.stringify(scheduleValue));
  storageState.tintColor = values.tintColor || '#000000';
}

test('loadInitialData returns host and clamps persisted levels', async () => {
  const state = windowStub.ScreenDimmerPopupState;
  setStorage({
    globalLevel: 1.5,
    siteLevels: { 'example.com': 0.8 }
  });
  tabsResult = [{ url: 'https://example.com/page' }];

  const result = await state.loadInitialData();
  assert.equal(result.host, 'example.com');
  assert.equal(result.blockedHost, null);
  assert.equal(result.globalLevel, 1);
  assert.equal(result.currentSiteLevel, 0.8);
  assert.deepEqual(result.siteLevels, { 'example.com': 0.8 });
  assert.deepEqual(result.schedule, DEFAULT_SCHEDULE);
  assert.equal(result.tintColor, '#000000');
});

test('getActiveHost returns null for unsupported protocols', async () => {
  const state = windowStub.ScreenDimmerPopupState;
  setStorage({
    globalLevel: -0.2,
    siteLevels: { extensions: 0.4 }
  });
  tabsResult = [{ url: 'chrome://extensions/' }];

  const host = await state.getActiveHost();
  assert.equal(host, null);

  const data = await state.loadInitialData();
  assert.equal(data.host, null);
  assert.equal(data.blockedHost, null);
  assert.equal(data.globalLevel, 0);
  assert.equal(data.currentSiteLevel, null);
  assert.deepEqual(data.schedule, DEFAULT_SCHEDULE);
  assert.equal(data.tintColor, '#000000');
});

test('loadInitialData flags Chrome Web Store as restricted', async () => {
  const state = windowStub.ScreenDimmerPopupState;
  setStorage({
    globalLevel: 0.5,
    siteLevels: { 'chromewebstore.google.com': 0.3 }
  });
  tabsResult = [{ url: 'https://chromewebstore.google.com/detail/abcdef' }];

  const host = await state.getActiveHost();
  assert.equal(host, null);

  const data = await state.loadInitialData();
  assert.equal(data.host, null);
  assert.equal(data.blockedHost, 'Chrome Web Store');
  assert.equal(data.currentSiteLevel, null);
  assert.equal(data.tintColor, '#000000');
});
