const DEFAULT_LEVEL = 0.25;
const GLOBAL_KEY = 'screendimmer_global_level';
const SITE_KEY = 'screendimmer_site_levels';
const SCHEDULE_KEY = 'screendimmer_schedule';

const DEFAULT_SCHEDULE_RULES = [
  {
    id: 'day',
    label: 'Daytime',
    type: 'sunrise',
    time: '07:00',
    offsetMinutes: 0,
    level: 0
  },
  {
    id: 'night',
    label: 'Nighttime',
    type: 'sunset',
    time: '19:00',
    offsetMinutes: 0,
    level: 0.6
  }
];

const DEFAULT_SCHEDULE = {
  enabled: false,
  fallbackLevel: DEFAULT_LEVEL,
  rules: DEFAULT_SCHEDULE_RULES.map((rule) => Object.assign({}, rule))
};

