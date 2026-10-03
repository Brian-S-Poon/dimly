import test from 'node:test';
import assert from 'node:assert/strict';

async function loadPopup({ engagementResult = { prompt: 'feedback' }, actionError = null } = {}) {
  const calls = [];
  let handlers;
  const ui = {
    bindEvents(value) { handlers = value; calls.push('bind'); },
    updateLevel() { calls.push('core-level'); },
    updateGlobal() {}, renderSite() {}, setScheduleLock() {}, updateManageSummary() {},
    renderManager() {}, setManagerStatus() {}, focusManagerClose() {}, focusManageButton() {},
    setSiteToggleDisabled() {},
    setManagerVisible(value) { calls.push(`manager:${value}`); },
    renderEngagementPrompt(type) { calls.push(`render:${type}`); },
    hideEngagementPrompt() { calls.push('hide'); },
    setEngagementBusy(value) { calls.push(`busy:${value}`); },
    setEngagementError(message) { calls.push(`error:${message}`); }
  };
  const engagement = {
    async initializeOpen() {
      calls.push('engagement-init');
      if (engagementResult instanceof Error) throw engagementResult;
      return engagementResult;
    },
    async action(type) {
      calls.push(`persist:${type}`);
      if (actionError) throw actionError;
    },
    async snooze(type) { calls.push(`snooze:${type}`); },
    async dismiss(type) { calls.push(`dismiss:${type}`); },
    getUrl() { return 'https://example.com/engagement'; }
  };
  const windowStub = {
    ScreenDimmerMath: { clamp01: (value) => Number(value) },
    ScreenDimmerStorage: { setGlobalLevel: async () => {} },
    ScreenDimmerSiteStorage: {
      getCache: () => ({}), setCache() {}, getLevel: () => null,
      upsert: async () => ({}), remove: async () => {}, reset: async () => {}
    },
    ScreenDimmerPopupUI: ui,
    ScreenDimmerPopupState: {
      async loadInitialData() {
        calls.push('core-load');
        return { globalLevel: 0.25, host: 'example.com', blockedHost: null, siteLevels: {}, scheduleEnabled: false };
      }
    },
    ScreenDimmerEngagement: engagement,
    ScreenDimmerI18n: { getMessage: (key) => key },
    chrome: null
  };
  windowStub.window = windowStub;
  const chromeStub = {
    runtime: { lastError: null },
    tabs: {
      create(_options, callback) { calls.push('tab-create'); callback(); }
    }
  };
  windowStub.chrome = chromeStub;

  const previous = {
    window: globalThis.window, document: globalThis.document, chrome: globalThis.chrome,
    DEFAULT_LEVEL: globalThis.DEFAULT_LEVEL, RESTRICTED_PAGE_MESSAGE: globalThis.RESTRICTED_PAGE_MESSAGE
  };
  globalThis.window = windowStub;
  globalThis.chrome = chromeStub;
  globalThis.DEFAULT_LEVEL = 0.25;
  globalThis.RESTRICTED_PAGE_MESSAGE = 'restricted';
  globalThis.document = { querySelector: () => null };
  await import(`../src/popup/popup.js?test=${Math.random()}`);
  await new Promise((resolve) => setTimeout(resolve, 0));

  return {
    calls,
    handlers,
    restore() {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    }
  };
}

test('engagement failure is isolated from core popup initialization', async () => {
  const fixture = await loadPopup({ engagementResult: new Error('engagement failed') });
  try {
    assert.ok(fixture.calls.indexOf('core-level') < fixture.calls.indexOf('engagement-init'));
    assert.ok(fixture.calls.includes('hide'));
    assert.ok(fixture.handlers.onToggleClick, 'core controls remain bound');
  } finally {
    fixture.restore();
  }
});

test('primary action persists before navigation and handling does not select a replacement', async () => {
  const fixture = await loadPopup();
  try {
    assert.equal(fixture.calls.filter((call) => call === 'render:feedback').length, 1);
    await fixture.handlers.onEngagementPrimary();
    assert.ok(fixture.calls.indexOf('persist:feedback') < fixture.calls.indexOf('tab-create'));
    assert.equal(fixture.calls.filter((call) => call === 'engagement-init').length, 1);
    assert.ok(fixture.calls.includes('hide'));
    fixture.handlers.onManageOpen();
    fixture.handlers.onManageClose();
    assert.ok(fixture.calls.includes('manager:true'));
    assert.ok(fixture.calls.includes('manager:false'));
  } finally {
    fixture.restore();
  }
});

test('failed action persistence prevents external navigation', async () => {
  const fixture = await loadPopup({ actionError: new Error('write failed') });
  try {
    await fixture.handlers.onEngagementPrimary();
    assert.equal(fixture.calls.includes('tab-create'), false);
    assert.ok(fixture.calls.includes('error:engagementPersistenceError'));
    assert.ok(fixture.calls.includes('busy:false'));
  } finally {
    fixture.restore();
  }
});
