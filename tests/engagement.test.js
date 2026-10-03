import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';

let originalWindow;
let originalChrome;
let windowStub;
let stored;
let readError;
let writeError;
let writes;

before(async () => {
  originalWindow = globalThis.window;
  originalChrome = globalThis.chrome;
  windowStub = {};
  windowStub.window = windowStub;
  globalThis.window = windowStub;
  globalThis.chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        get(_keys, callback) {
          queueMicrotask(() => {
            globalThis.chrome.runtime.lastError = readError;
            callback(stored === undefined ? {} : { screendimmer_engagement: structuredClone(stored) });
            globalThis.chrome.runtime.lastError = null;
          });
        },
        set(items, callback) {
          queueMicrotask(() => {
            globalThis.chrome.runtime.lastError = writeError;
            if (!writeError) {
              stored = structuredClone(items.screendimmer_engagement);
              writes.push(structuredClone(stored));
            }
            callback();
            globalThis.chrome.runtime.lastError = null;
          });
        }
      }
    }
  };
  await import('../src/popup/engagement.js');
});

beforeEach(() => {
  stored = undefined;
  readError = null;
  writeError = null;
  writes = [];
  globalThis.chrome.runtime.lastError = null;
});

after(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalChrome === undefined) delete globalThis.chrome;
  else globalThis.chrome = originalChrome;
});

test('first initialization creates local state and never shows a prompt', async () => {
  const engagement = windowStub.ScreenDimmerEngagement;
  const now = 1_000_000;
  const result = await engagement.initializeOpen(now);
  assert.deepEqual(result, { prompt: null });
  assert.deepEqual(stored, engagement.createState(now));
  assert.equal(writes.length, 1);
});

test('normalization preserves valid values and safely recovers malformed fields', () => {
  const { normalizeState } = windowStub.ScreenDimmerEngagement;
  const normalized = normalizeState({
    firstSeenAt: 10,
    popupOpenCount: 7.9,
    lastCountedOpenAt: 'bad',
    lastPromptAt: 20,
    feedback: { status: 'dismissed', snoozedUntil: 30 },
    review: { status: 'unknown', snoozedUntil: -1 }
  }, 100);
  assert.deepEqual(normalized, {
    version: 1,
    firstSeenAt: 10,
    popupOpenCount: 7,
    lastCountedOpenAt: null,
    lastPromptAt: 20,
    feedback: { status: 'dismissed', snoozedUntil: 30 },
    review: { status: 'pending', snoozedUntil: null }
  });
  assert.deepEqual(normalizeState('broken', 100), windowStub.ScreenDimmerEngagement.createState(100));
});

test('popup opens count only after the rapid-open interval', async () => {
  const engagement = windowStub.ScreenDimmerEngagement;
  const now = 10_000_000;
  stored = engagement.createState(now);
  await engagement.initializeOpen(now + engagement.CONFIG.popupOpenIntervalMs - 1);
  assert.equal(stored.popupOpenCount, 1);
  await engagement.initializeOpen(now + engagement.CONFIG.popupOpenIntervalMs);
  assert.equal(stored.popupOpenCount, 2);
});

test('eligibility enforces age, open counts, cooldown, snooze, and priority', () => {
  const engagement = windowStub.ScreenDimmerEngagement;
  const destinations = { feedback: 'https://feedback.example', review: 'https://review.example' };
  const now = 100 * 24 * 60 * 60 * 1000;
  const state = engagement.createState(0);
  state.popupOpenCount = 10;
  assert.equal(engagement.selectEligiblePrompt(state, now, destinations), 'feedback');
  state.feedback.snoozedUntil = now + engagement.CONFIG.snoozeMs;
  assert.equal(engagement.selectEligiblePrompt(state, now, destinations), 'review');
  state.lastPromptAt = now - engagement.CONFIG.globalCooldownMs + 1;
  assert.equal(engagement.selectEligiblePrompt(state, now, destinations), null);
  state.lastPromptAt = null;
  state.feedback.snoozedUntil = null;
  state.popupOpenCount = 4;
  assert.equal(engagement.selectEligiblePrompt(state, 7 * 24 * 60 * 60 * 1000, destinations), null);
  state.popupOpenCount = 5;
  assert.equal(engagement.selectEligiblePrompt(state, 7 * 24 * 60 * 60 * 1000, destinations), 'feedback');
  state.feedback.status = 'dismissed';
  state.popupOpenCount = 10;
  assert.equal(engagement.selectEligiblePrompt(state, 21 * 24 * 60 * 60 * 1000 - 1, destinations), null);
  assert.equal(engagement.selectEligiblePrompt(state, 21 * 24 * 60 * 60 * 1000, destinations), 'review');
});

test('eligible prompt impression is persisted before it is returned', async () => {
  const engagement = windowStub.ScreenDimmerEngagement;
  const now = 30 * 24 * 60 * 60 * 1000;
  stored = engagement.createState(0);
  stored.popupOpenCount = 10;
  stored.lastCountedOpenAt = now;
  const result = await engagement.initializeOpen(now);
  assert.deepEqual(result, { prompt: 'review' });
  assert.equal(stored.lastPromptAt, now);
  assert.equal(writes.length, 2);
});

test('destination validation rejects placeholders and non-HTTPS URLs', () => {
  const engagement = windowStub.ScreenDimmerEngagement;
  assert.equal(engagement.getDestination('feedback'), null);
  assert.equal(engagement.isValidDestination('REPLACE_WITH_SURVEY'), false);
  assert.equal(engagement.isValidDestination('http://example.com'), false);
  assert.equal(engagement.isValidDestination('not a url'), false);
  assert.equal(engagement.isValidDestination('https://example.com/survey'), true);

  const state = engagement.createState(0);
  state.popupOpenCount = 10;
  assert.equal(engagement.selectEligiblePrompt(state, 30 * 24 * 60 * 60 * 1000), 'review');
});

test('future schema versions fail closed without overwriting stored state', async () => {
  const engagement = windowStub.ScreenDimmerEngagement;
  stored = { version: 2, futureField: true };
  assert.equal(engagement.normalizeState(stored, 100), null);
  assert.deepEqual(await engagement.initializeOpen(100), { prompt: null });
  assert.equal(writes.length, 0);
  assert.deepEqual(stored, { version: 2, futureField: true });
});

test('snooze, dismiss, and action update only the selected prompt', async () => {
  const engagement = windowStub.ScreenDimmerEngagement;
  const now = 5000;
  stored = engagement.createState(0);
  await engagement.snooze('feedback', now);
  assert.equal(stored.feedback.snoozedUntil, now + engagement.CONFIG.snoozeMs);
  assert.equal(stored.review.status, 'pending');
  await engagement.dismiss('review', now);
  assert.equal(stored.review.status, 'dismissed');
  assert.equal(stored.feedback.status, 'pending');
  await engagement.action('feedback', now);
  assert.equal(stored.feedback.status, 'actioned');
  assert.equal(stored.review.status, 'dismissed');
});

test('local read and write failures reject and do not fabricate success', async () => {
  const engagement = windowStub.ScreenDimmerEngagement;
  readError = new Error('read failed');
  await assert.rejects(engagement.initializeOpen(100), /read failed/);
  readError = null;
  writeError = new Error('write failed');
  await assert.rejects(engagement.initializeOpen(100), /write failed/);
  assert.equal(writes.length, 0);
});
