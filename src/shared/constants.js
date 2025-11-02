const DEFAULT_LEVEL = 0.25;
const GLOBAL_KEY = 'screendimmer_global_level';
const SITE_KEY = 'screendimmer_site_levels';
const SCHEDULE_KEY = 'screendimmer_schedule';
const RESTRICTED_PAGE_MESSAGE = "Chrome prevents extensions from running on this page, so Screen Dimmer can't dim it.";
const SCHEDULE_RULE_TYPES = Object.freeze({
  FIXED: 'fixed',
  SOLAR: 'solar'
});
const SCHEDULE_SOLAR_EVENTS = Object.freeze({
  SUNRISE: 'sunrise',
  SUNSET: 'sunset'
});
const DEFAULT_SCHEDULE_TRANSITION_MS = 800;
const DEFAULT_SCHEDULE = Object.freeze({
  enabled: false,
  transitionMs: DEFAULT_SCHEDULE_TRANSITION_MS,
  fallbackLevel: DEFAULT_LEVEL,
  location: null,
  rules: Object.freeze([
    Object.freeze({
      id: 'daytime',
      label: 'Daytime',
      type: SCHEDULE_RULE_TYPES.FIXED,
      time: '07:00',
      level: 0.15,
      enabled: true
    }),
    Object.freeze({
      id: 'night',
      label: 'Night',
      type: SCHEDULE_RULE_TYPES.FIXED,
      time: '21:00',
      level: 0.55,
      enabled: true
    })
  ])
});

