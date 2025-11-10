/* global DEFAULT_LEVEL, DEFAULT_SCHEDULE, DEFAULT_SCHEDULE_TRANSITION_MS, GLOBAL_KEY, SCHEDULE_KEY */
/* global ScreenDimmerStorage, ScreenDimmerMath */

importScripts('../shared/i18n.js', '../shared/constants.js', '../shared/math.js', '../shared/storage.js');

const storage = self.ScreenDimmerStorage;
const { clamp01 } = self.ScreenDimmerMath;
const ALARM_NAME = 'screendimmer_schedule_tick';

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

function resolveRuleTime(rule, referenceDate) {
  if (!rule) return null;
  return buildDateWithTime(referenceDate, rule.time);
}

function computePlan(schedule, now = new Date()) {
  if (!schedule || !Array.isArray(schedule.rules)) {
    return { active: null, next: null };
  }
  const availableRules = schedule.rules.filter((rule) => Boolean(rule));
  if (!availableRules.length) {
    return { active: null, next: null };
  }

  const occurrences = [];

  availableRules.forEach((rule) => {
    const today = resolveRuleTime(rule, now);
    const tomorrow = resolveRuleTime(rule, addDays(now, 1));
    const yesterday = resolveRuleTime(rule, addDays(now, -1));
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
