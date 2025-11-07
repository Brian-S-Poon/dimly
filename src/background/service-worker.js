/* global DEFAULT_LEVEL, DEFAULT_SCHEDULE, DEFAULT_SCHEDULE_TRANSITION_MS, GLOBAL_KEY, SCHEDULE_KEY, SCHEDULE_RULE_TYPES, SCHEDULE_SOLAR_EVENTS */
/* global ScreenDimmerStorage, ScreenDimmerMath */

importScripts('../shared/constants.js', '../shared/math.js', '../shared/storage.js');

const storage = self.ScreenDimmerStorage;
const { clamp01 } = self.ScreenDimmerMath;
const SOLAR_SCHEDULE_ENABLED = Boolean(self.SCREEN_DIMMER_SOLAR_SCHEDULE_ENABLED);
const ALARM_NAME = 'screendimmer_schedule_tick';
const FALLBACK_SOLAR_TIMES = {
  [SCHEDULE_SOLAR_EVENTS.SUNRISE]: '06:00',
  [SCHEDULE_SOLAR_EVENTS.SUNSET]: '18:00'
};

let currentSchedule = null;
let currentRuleId = null;
let pendingTimeout = null;

function hasAlarms() {
  return typeof chrome.alarms !== 'undefined' && chrome.alarms && typeof chrome.alarms.create === 'function';
}

function clearTimer() {
  if (hasAlarms()) {
    chrome.alarms.clear(ALARM_NAME);
  }
  if (pendingTimeout) {
    clearTimeout(pendingTimeout);
    pendingTimeout = null;
  }
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function parseTimeString(timeString) {
  const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(timeString || '');
  if (!match) return null;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

function buildDateWithTime(baseDate, timeString) {
  const parts = parseTimeString(timeString);
  if (!parts) return null;
  const value = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), parts.hours, parts.minutes, 0, 0);
  return value;
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
  return Math.floor(diff / 86400000);
}

function calculateSolarEvent(baseDate, location, event) {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
    return buildDateWithTime(baseDate, FALLBACK_SOLAR_TIMES[event]);
  }

  const zenith = 90.8333; // official sunrise/sunset
  const d2r = Math.PI / 180;
  const r2d = 180 / Math.PI;

  const day = dayOfYear(baseDate);
  const lngHour = location.longitude / 15;
  const approx = event === SCHEDULE_SOLAR_EVENTS.SUNRISE
    ? day + ((6 - lngHour) / 24)
    : day + ((18 - lngHour) / 24);

  const M = (0.9856 * approx) - 3.289;
  let L = M + (1.916 * Math.sin(d2r * M)) + (0.020 * Math.sin(2 * d2r * M)) + 282.634;
  L = (L + 360) % 360;

  let RA = r2d * Math.atan(0.91764 * Math.tan(d2r * L));
  RA = (RA + 360) % 360;
  const Lquadrant = Math.floor(L / 90) * 90;
  const RAquadrant = Math.floor(RA / 90) * 90;
  RA = (RA + (Lquadrant - RAquadrant)) / 15;

  const sinDec = 0.39782 * Math.sin(d2r * L);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(d2r * zenith) - (sinDec * Math.sin(d2r * location.latitude))) /
    (cosDec * Math.cos(d2r * location.latitude));

  if (cosH > 1 || cosH < -1) {
    return buildDateWithTime(baseDate, FALLBACK_SOLAR_TIMES[event]);
  }

  let H = event === SCHEDULE_SOLAR_EVENTS.SUNRISE
    ? 360 - r2d * Math.acos(cosH)
    : r2d * Math.acos(cosH);
  H /= 15;

  const T = H + RA - (0.06571 * approx) - 6.622;
  let UT = T - lngHour;
  UT = (UT % 24 + 24) % 24;
  const offsetHours = -baseDate.getTimezoneOffset() / 60;
  const localT = (UT + offsetHours + 24) % 24;

  const result = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0);
  result.setMinutes(Math.round(localT * 60));
  return result;
}

function isSolarRule(rule) {
  return SOLAR_SCHEDULE_ENABLED && rule && rule.type === SCHEDULE_RULE_TYPES.SOLAR;
}

function resolveRuleTime(rule, schedule, referenceDate) {
  if (!rule) return null;
  if (isSolarRule(rule)) {
    const base = calculateSolarEvent(referenceDate, schedule.location, rule.event);
    if (!base) return null;
    const offset = Number(rule.offsetMinutes) || 0;
    if (offset) {
      base.setMinutes(base.getMinutes() + offset);
    }
    return base;
  }
  return buildDateWithTime(referenceDate, rule.time);
}

function computePlan(schedule, now = new Date()) {
  if (!schedule || !Array.isArray(schedule.rules)) {
    return { active: null, next: null };
  }
  const enabledRules = schedule.rules.filter((rule) => rule && rule.enabled);
  if (!enabledRules.length) {
    return { active: null, next: null };
  }

  const occurrences = [];

  enabledRules.forEach((rule) => {
    const today = resolveRuleTime(rule, schedule, now);
    const tomorrow = resolveRuleTime(rule, schedule, addDays(now, 1));
    const yesterday = resolveRuleTime(rule, schedule, addDays(now, -1));
    if (today) occurrences.push({ rule, time: today });
    if (tomorrow) occurrences.push({ rule, time: tomorrow });
    if (yesterday) occurrences.push({ rule, time: yesterday });
  });

  if (!occurrences.length) {
    return { active: null, next: null };
  }

  const future = occurrences
    .filter((item) => item.time.getTime() > now.getTime())
    .sort((a, b) => a.time.getTime() - b.time.getTime());
  const past = occurrences
    .filter((item) => item.time.getTime() <= now.getTime())
    .sort((a, b) => b.time.getTime() - a.time.getTime());

  return {
    active: past[0] || future[future.length - 1] || null,
    next: future[0] || null
  };
}

async function applyLevelForRule(rule, schedule) {
  if (!rule) {
    if (typeof schedule?.fallbackLevel === 'number') {
      await storage.setGlobalLevel(clamp01(schedule.fallbackLevel));
    }
    currentRuleId = null;
    return;
  }
  if (rule.rule && rule.rule.id) {
    currentRuleId = rule.rule.id;
  }
  const level = clamp01(rule.rule ? rule.rule.level : rule.level);
  try {
    await storage.setGlobalLevel(level);
  } catch (error) {
    console.error('ScreenDimmer scheduler failed to apply level', error);
  }
}

function scheduleNextRun(timestamp) {
  clearTimer();
  if (!timestamp) return;
  const delay = Math.max(1000, timestamp - Date.now());
  if (hasAlarms()) {
    chrome.alarms.create(ALARM_NAME, { when: Date.now() + delay });
  } else {
    pendingTimeout = setTimeout(() => {
      pendingTimeout = null;
      refreshSchedule();
    }, delay);
  }
}

async function refreshSchedule(force) {
  try {
    currentSchedule = await storage.getSchedule();
  } catch (error) {
    console.error('ScreenDimmer scheduler failed to read schedule', error);
    return;
  }

  if (!currentSchedule || !currentSchedule.enabled) {
    clearTimer();
    currentRuleId = null;
    return;
  }

  const now = new Date();
  const plan = computePlan(currentSchedule, now);
  if (!plan.active && !plan.next) {
    await applyLevelForRule(null, currentSchedule);
    clearTimer();
    return;
  }

  if (plan.active && (!currentRuleId || currentRuleId !== (plan.active.rule && plan.active.rule.id) || force)) {
    await applyLevelForRule(plan.active, currentSchedule);
  }

  if (plan.next && plan.next.time) {
    scheduleNextRun(plan.next.time.getTime());
  } else {
    clearTimer();
  }
}

chrome.runtime.onInstalled?.addListener(() => {
  refreshSchedule(true);
});

chrome.runtime.onStartup?.addListener(() => {
  refreshSchedule(true);
});

if (hasAlarms()) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm && alarm.name === ALARM_NAME) {
      refreshSchedule(true);
    }
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync' && areaName !== 'local') return;
  if (changes[SCHEDULE_KEY]) {
    refreshSchedule(true);
  }
});

refreshSchedule(true);
