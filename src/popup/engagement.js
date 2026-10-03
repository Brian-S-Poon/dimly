(function (global) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const CONFIG = Object.freeze({
    storageKey: 'screendimmer_engagement',
    feedbackMinAgeMs: 7 * DAY_MS,
    feedbackMinOpens: 5,
    reviewMinAgeMs: 21 * DAY_MS,
    reviewMinOpens: 10,
    globalCooldownMs: 14 * DAY_MS,
    snoozeMs: 28 * DAY_MS,
    popupOpenIntervalMs: 30 * 60 * 1000,
    feedbackUrl: 'https://form.jotform.com/262756756954071',
    reviewUrl: 'https://chromewebstore.google.com/detail/dimly-%E2%80%94-screen-dimmer-for/elkdfophogmfbiffkgjpomjajihklnmk/reviews'
  });
  const STATUSES = new Set(['pending', 'actioned', 'dismissed']);
  const PLACEHOLDER_RE = /^(?:REPLACE_WITH_|YOUR_|TODO)/i;

  function isValidDestination(value) {
    if (typeof value !== 'string' || PLACEHOLDER_RE.test(value)) return false;
    try {
      return new URL(value).protocol === 'https:';
    } catch (error) {
      return false;
    }
  }

  function getDestination(type) {
    const value = type === 'feedback' ? CONFIG.feedbackUrl : type === 'review' ? CONFIG.reviewUrl : null;
    return isValidDestination(value) ? value : null;
  }

  function timestamp(value, fallback = null) {
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
  }

  function normalizePrompt(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      status: STATUSES.has(source.status) ? source.status : 'pending',
      snoozedUntil: timestamp(source.snoozedUntil)
    };
  }

  function createState(now) {
    return {
      version: 1,
      firstSeenAt: now,
      popupOpenCount: 1,
      lastCountedOpenAt: now,
      lastPromptAt: null,
      feedback: normalizePrompt(),
      review: normalizePrompt()
    };
  }

  function normalizeState(value, now = Date.now()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return createState(now);
    if (Number.isInteger(value.version) && value.version > 1) return null;
    return {
      version: 1,
      firstSeenAt: timestamp(value.firstSeenAt, now),
      popupOpenCount: Number.isFinite(value.popupOpenCount) && value.popupOpenCount >= 0
        ? Math.floor(value.popupOpenCount) : 0,
      lastCountedOpenAt: timestamp(value.lastCountedOpenAt),
      lastPromptAt: timestamp(value.lastPromptAt),
      feedback: normalizePrompt(value.feedback),
      review: normalizePrompt(value.review)
    };
  }

  function localGet() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([CONFIG.storageKey], (items) => {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) reject(error);
        else resolve(items ? items[CONFIG.storageKey] : undefined);
      });
    });
  }

  function localSet(state) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [CONFIG.storageKey]: state }, () => {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) reject(error);
        else resolve(state);
      });
    });
  }

  function selectEligiblePrompt(state, now = Date.now(), destinations = null) {
    if (!state) return null;
    const available = destinations || {
      feedback: getDestination('feedback'),
      review: getDestination('review')
    };
    if (state.lastPromptAt != null && now - state.lastPromptAt < CONFIG.globalCooldownMs) return null;
    const eligible = (type, minAge, minOpens) => {
      const prompt = state[type];
      return prompt.status === 'pending'
        && (prompt.snoozedUntil == null || now >= prompt.snoozedUntil)
        && now - state.firstSeenAt >= minAge
        && state.popupOpenCount >= minOpens;
    };
    if (available.feedback && eligible('feedback', CONFIG.feedbackMinAgeMs, CONFIG.feedbackMinOpens)) return 'feedback';
    if (available.review && eligible('review', CONFIG.reviewMinAgeMs, CONFIG.reviewMinOpens)) return 'review';
    return null;
  }

  async function initializeOpen(now = Date.now()) {
    const stored = await localGet();
    if (typeof stored === 'undefined') {
      await localSet(createState(now));
      return { prompt: null };
    }
    const state = normalizeState(stored, now);
    if (!state) return { prompt: null };
    if (state.lastCountedOpenAt == null || now - state.lastCountedOpenAt >= CONFIG.popupOpenIntervalMs) {
      state.popupOpenCount += 1;
      state.lastCountedOpenAt = now;
    }
    await localSet(state);
    const prompt = selectEligiblePrompt(state, now);
    if (!prompt) return { prompt: null };
    state.lastPromptAt = now;
    await localSet(state);
    return { prompt };
  }

  async function updatePrompt(type, transform, now = Date.now()) {
    if (type !== 'feedback' && type !== 'review') throw new Error('Unknown engagement prompt');
    const state = normalizeState(await localGet(), now);
    if (!state) throw new Error('Unsupported engagement state version');
    transform(state[type]);
    await localSet(state);
    return state;
  }

  function snooze(type, now = Date.now()) {
    return updatePrompt(type, (prompt) => { prompt.snoozedUntil = now + CONFIG.snoozeMs; }, now);
  }

  function dismiss(type, now = Date.now()) {
    return updatePrompt(type, (prompt) => { prompt.status = 'dismissed'; prompt.snoozedUntil = null; }, now);
  }

  function action(type, now = Date.now()) {
    return updatePrompt(type, (prompt) => { prompt.status = 'actioned'; prompt.snoozedUntil = null; }, now);
  }

  global.ScreenDimmerEngagement = {
    CONFIG, createState, normalizeState, selectEligiblePrompt,
    initializeOpen, snooze, dismiss, action, isValidDestination, getDestination
  };
})(typeof window !== 'undefined' ? window : this);
