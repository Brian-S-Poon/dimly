importScripts('../shared/constants.js', '../shared/math.js', '../shared/storage.js');

const storage = self.ScreenDimmerStorage;
const { clamp01 } = self.ScreenDimmerMath;

const SCHEDULE_ALARM_NAME = 'screendimmer.schedule.tick';
const MINUTES_PER_DAY = 24 * 60;
const MIN_WAKE_DELAY_MS = 5 * 1000;

let currentSchedule = DEFAULT_SCHEDULE;
let lastAppliedLevel = null;
let loadingSchedule = false;

function startOfDay(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function parseTimeToMinutes(time) {
  if (typeof time !== 'string') return 0;
  const match = time.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
}

function resolveRuleMinutes(rule) {
  if (!rule || typeof rule !== 'object') return 0;
  if (rule.type === 'custom') {
    return parseTimeToMinutes(rule.time || '00:00');
  }
  const base = rule.type === 'sunrise' ? 6 * 60 : 18 * 60;
  const offset = Number.isFinite(rule.offsetMinutes) ? rule.offsetMinutes : 0;
  return base + offset;
}

function minutesToDate(baseDate, minutes) {
  const midnight = startOfDay(baseDate);
  let totalMinutes = Math.round(minutes);
  let dayOffset = Math.floor(totalMinutes / MINUTES_PER_DAY);
  totalMinutes -= dayOffset * MINUTES_PER_DAY;
  if (totalMinutes < 0) {
    totalMinutes += MINUTES_PER_DAY;
    dayOffset -= 1;
  }
  const date = addDays(midnight, dayOffset);
  date.setMinutes(totalMinutes);
  return date;
}

function buildEvents(rules, referenceDate) {
  const events = [];
  const frames = [-1, 0, 1];
  frames.forEach((dayOffset) => {
    const baseDate = addDays(referenceDate, dayOffset);
    rules.forEach((rule) => {
      const minutes = resolveRuleMinutes(rule);
      const date = minutesToDate(baseDate, minutes);
      events.push({ date, rule });
    });
  });
  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return events;
}

function findActiveEvent(events, now) {
  if (!events.length) return null;
  let active = events[0];
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (event.date.getTime() <= now.getTime()) {
      active = event;
    } else {
      break;
    }
  }
  return active;
}

function scheduleNextAlarm(events, now) {
  const next = events.find((event) => event.date.getTime() > now.getTime());
  if (!next) {
    return;
  }
  const when = Math.max(next.date.getTime(), Date.now() + MIN_WAKE_DELAY_MS);
  chrome.alarms.clear(SCHEDULE_ALARM_NAME, () => {
    chrome.alarms.create(SCHEDULE_ALARM_NAME, { when });
  });
}

function clampLevel(value, fallback) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return clamp01(typeof fallback === 'number' ? fallback : DEFAULT_LEVEL);
  }
  return clamp01(value);
}

async function applySchedule(force = false) {
  if (!currentSchedule || !currentSchedule.enabled || !Array.isArray(currentSchedule.rules)) {
    chrome.alarms.clear(SCHEDULE_ALARM_NAME);
    return;
  }

  const now = new Date();
  const events = buildEvents(currentSchedule.rules, now);
  if (!events.length) {
    chrome.alarms.clear(SCHEDULE_ALARM_NAME);
    return;
  }

  const active = findActiveEvent(events, now);
  if (!active || !active.rule) {
    chrome.alarms.clear(SCHEDULE_ALARM_NAME);
    return;
  }

  const targetLevel = clampLevel(active.rule.level, currentSchedule.fallbackLevel);
  if (force || lastAppliedLevel == null || Math.abs(targetLevel - lastAppliedLevel) > 0.001) {
    try {
      await storage.setGlobalLevel(targetLevel);
      lastAppliedLevel = targetLevel;
    } catch (error) {
      console.error('ScreenDimmer schedule failed to set level', error);
    }
  }

  scheduleNextAlarm(events, now);
}

async function refreshSchedule(force = false) {
  if (loadingSchedule) return;
  loadingSchedule = true;
  try {
    const nextSchedule = await storage.getScheduleConfig();
    currentSchedule = nextSchedule;
    if (!currentSchedule.enabled) {
      chrome.alarms.clear(SCHEDULE_ALARM_NAME);
      lastAppliedLevel = null;
      if (force && typeof currentSchedule.fallbackLevel === 'number') {
        try {
          await storage.setGlobalLevel(clampLevel(currentSchedule.fallbackLevel));
        } catch (err) {
          console.error('ScreenDimmer schedule failed to restore fallback', err);
        }
      }
      return;
    }
    await applySchedule(true);
  } catch (error) {
    console.error('ScreenDimmer schedule failed to load configuration', error);
  } finally {
    loadingSchedule = false;
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === SCHEDULE_ALARM_NAME) {
    applySchedule(true);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === 'sync' || area === 'local') && changes[SCHEDULE_KEY]) {
    refreshSchedule(true);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  refreshSchedule(true);
});

chrome.runtime.onStartup.addListener(() => {
  refreshSchedule(true);
});

refreshSchedule(false);
