import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';

let tabsResult = [];
let originalGlobals = {};
let windowStub;
let storageState;

function clamp01(value) {
  const num = Number(value ?? 0);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

before(async () => {
  storageState = { globalLevel: 0, siteLevels: {} };
  originalGlobals = {
    window: globalThis.window,
    ScreenDimmerMath: globalThis.ScreenDimmerMath,
    ScreenDimmerStorage: globalThis.ScreenDimmerStorage,
    chrome: globalThis.chrome
  };

  windowStub = {
    ScreenDimmerMath: { clamp01 },
    ScreenDimmerStorage: {
      getGlobalLevel: () => Promise.resolve(storageState.globalLevel),
      getSiteLevels: () => Promise.resolve({ ...storageState.siteLevels })
    }
  };
  windowStub.window = windowStub;

  globalThis.window = windowStub;
  globalThis.ScreenDimmerMath = windowStub.ScreenDimmerMath;
  globalThis.ScreenDimmerStorage = windowStub.ScreenDimmerStorage;

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
  globalThis.chrome.runtime.lastError = null;
});

after(() => {
  globalThis.window = originalGlobals.window;
  globalThis.ScreenDimmerMath = originalGlobals.ScreenDimmerMath;
  globalThis.ScreenDimmerStorage = originalGlobals.ScreenDimmerStorage;
  globalThis.chrome = originalGlobals.chrome;
});

function setStorage(values) {
  storageState.globalLevel = values.globalLevel;
  storageState.siteLevels = values.siteLevels;
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
  assert.equal(result.globalLevel, 1);
  assert.equal(result.currentSiteLevel, 0.8);
  assert.deepEqual(result.siteLevels, { 'example.com': 0.8 });
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
  assert.equal(data.globalLevel, 0);
  assert.equal(data.currentSiteLevel, null);
});
