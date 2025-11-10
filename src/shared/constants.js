const DEFAULT_LEVEL = 0.25;
const GLOBAL_KEY = 'screendimmer_global_level';
const SITE_KEY = 'screendimmer_site_levels';
const SCHEDULE_KEY = 'screendimmer_schedule';
const GLOBAL_ROOT = typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this);
const RESTRICTED_PAGE_MESSAGE = (() => {
  const i18n = GLOBAL_ROOT && GLOBAL_ROOT.ScreenDimmerI18n;
  if (i18n && typeof i18n.getMessage === 'function') {
    const localized = i18n.getMessage('restrictedPageMessage');
    if (localized) {
      return localized;
    }
  }
  if (typeof chrome !== 'undefined' && chrome && chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
    const localized = chrome.i18n.getMessage('restrictedPageMessage');
    if (localized) {
      return localized;
    }
  }
  return 'Chrome prevents extensions from running on this page.';
})();
const DEFAULT_SCHEDULE_TRANSITION_MS = 800;
const DEFAULT_SCHEDULE = Object.freeze({
  enabled: false,
  transitionMs: DEFAULT_SCHEDULE_TRANSITION_MS,
  fallbackLevel: DEFAULT_LEVEL,
  rules: Object.freeze([
    Object.freeze({
      id: 'daytime',
      time: '07:00',
      level: 0.15
    }),
    Object.freeze({
      id: 'night',
      time: '21:00',
      level: 0.55
    })
  ])
});

