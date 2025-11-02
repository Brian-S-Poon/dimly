(function (global) {
  const { clamp01 } = global.ScreenDimmerMath;
  const storage = global.ScreenDimmerStorage;
  const ui = global.ScreenDimmerPopupUI;
  const state = global.ScreenDimmerPopupState;

  let writeTimer = null;
  let lastLevel = DEFAULT_LEVEL;
  let currentHost = null;
  let currentSiteLevel = null;
  let siteLevelsCache = {};
  let scheduleConfig = Object.assign({}, DEFAULT_SCHEDULE, {
    rules: DEFAULT_SCHEDULE.rules.map((rule) => Object.assign({}, rule))
  });
  let scheduleWriteTimer = null;

  function ensureScheduleRuleCount() {
    if (!scheduleConfig) return;
    if (!Array.isArray(scheduleConfig.rules)) {
      scheduleConfig.rules = [];
    }
    const required = DEFAULT_SCHEDULE.rules.length;
    for (let i = 0; i < required; i += 1) {
      if (!scheduleConfig.rules[i]) {
        const base = DEFAULT_SCHEDULE.rules[i] || DEFAULT_SCHEDULE.rules[0];
        scheduleConfig.rules[i] = Object.assign({}, base);
      }
    }
  }

  function applyLevel(level) {
    lastLevel = clamp01(level);
    ui.updateLevel(lastLevel);
    ui.updateGlobal(lastLevel);
    if (scheduleConfig && !scheduleConfig.enabled) {
      scheduleConfig.fallbackLevel = lastLevel;
    }
    ui.renderSite({
      host: currentHost,
      lockedLevel: currentSiteLevel,
      globalLevel: lastLevel
    });
  }

  function updateSiteUI(message) {
    ui.renderSite({
      host: currentHost,
      lockedLevel: currentSiteLevel,
      globalLevel: lastLevel,
      message
    });
  }

  function updateScheduleStatusText() {
    if (!scheduleConfig || !scheduleConfig.enabled) {
      ui.updateScheduleStatus('Schedule is off. Adjust the rules and enable it when you are ready.');
      return;
    }
    ui.updateScheduleStatus('Schedule is on. Global controls are automated.');
  }

  function renderSchedule() {
    if (!scheduleConfig) return;
    ensureScheduleRuleCount();
    ui.updateScheduleEnabled(Boolean(scheduleConfig.enabled));
    scheduleConfig.rules.forEach((rule, index) => {
      ui.updateScheduleRule(index, rule);
    });
    updateScheduleStatusText();
    ui.setGlobalControlsDisabled(Boolean(scheduleConfig.enabled));
  }

  function clampOffset(value) {
    if (!Number.isFinite(value)) return 0;
    const limited = Math.max(-720, Math.min(720, Math.round(value)));
    return limited;
  }

  function sanitizeTime(value, fallback) {
    const match = typeof value === 'string' && value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2]}`;
    }
    return fallback || '06:00';
  }

  function cloneScheduleForWrite() {
    return {
      enabled: Boolean(scheduleConfig.enabled),
      fallbackLevel: clamp01(scheduleConfig.fallbackLevel),
      rules: (scheduleConfig.rules || []).map((rule, index) => {
        const base = DEFAULT_SCHEDULE.rules[index] || DEFAULT_SCHEDULE.rules[0];
        const next = Object.assign({}, base, rule);
        next.level = clamp01(next.level);
        if (next.type === 'custom') {
          next.time = sanitizeTime(next.time, base.time || '06:00');
          delete next.offsetMinutes;
        } else {
          next.offsetMinutes = clampOffset(next.offsetMinutes || 0);
          delete next.time;
        }
        return next;
      })
    };
  }

  function validateSchedulePayload(payload) {
    if (!payload || !Array.isArray(payload.rules) || payload.rules.length === 0) {
      return { valid: false, message: 'Add at least one schedule rule.' };
    }
    for (let i = 0; i < payload.rules.length; i += 1) {
      const rule = payload.rules[i];
      if (!rule || typeof rule.type !== 'string') {
        return { valid: false, message: 'Choose a rule type.' };
      }
      if (rule.type === 'custom') {
        if (!rule.time || !/^([01]?\d|2[0-3]):([0-5]\d)$/.test(rule.time)) {
          return { valid: false, message: 'Enter a valid custom time (HH:MM).' };
        }
      } else if (!Number.isFinite(rule.offsetMinutes) || rule.offsetMinutes < -720 || rule.offsetMinutes > 720) {
        return { valid: false, message: 'Offsets must be between -720 and 720 minutes.' };
      }
    }
    return { valid: true };
  }

  function queueScheduleWrite(immediate = false) {
    clearTimeout(scheduleWriteTimer);
    const perform = async () => {
      scheduleWriteTimer = null;
      const payload = cloneScheduleForWrite();
      const validation = validateSchedulePayload(payload);
      if (!validation.valid) {
        ui.setScheduleError(validation.message);
        return;
      }
      ui.setScheduleError('');
      try {
        await storage.setScheduleConfig(payload);
      } catch (err) {
        console.error('Failed to persist schedule configuration', err);
        ui.setScheduleError('Failed to save schedule. Try again.');
      }
    };
    if (immediate) {
      perform();
    } else {
      scheduleWriteTimer = setTimeout(perform, 300);
    }
  }

  function handleScheduleToggle(enabled) {
    scheduleConfig.enabled = Boolean(enabled);
    if (scheduleConfig.enabled) {
      scheduleConfig.fallbackLevel = lastLevel;
    }
    renderSchedule();
    queueScheduleWrite(true);
  }

  function handleScheduleRuleChange(index, changes) {
    if (!scheduleConfig || !Array.isArray(scheduleConfig.rules)) return;
    ensureScheduleRuleCount();
    const current = Object.assign({}, scheduleConfig.rules[index] || {});
    if (typeof changes.level === 'number') {
      current.level = clamp01(changes.level);
    }
    if (changes.type) {
      current.type = changes.type;
      if (current.type === 'custom') {
        current.time = sanitizeTime(current.time || '06:00', '06:00');
        delete current.offsetMinutes;
      } else {
        current.offsetMinutes = clampOffset(current.offsetMinutes || 0);
      }
    }
    if (typeof changes.time === 'string') {
      current.time = sanitizeTime(changes.time, current.time || '06:00');
    }
    if (typeof changes.offsetMinutes === 'number') {
      current.offsetMinutes = clampOffset(changes.offsetMinutes);
    }
    scheduleConfig.rules[index] = current;
    renderSchedule();
    queueScheduleWrite();
  }

  function scheduleGlobalWrite(level) {
    clearTimeout(writeTimer);
    writeTimer = setTimeout(async () => {
      try {
        await storage.setGlobalLevel(level);
      } catch (err) {
        console.error('Failed to persist global level', err);
      }
    }, 250);
  }

  function handleLevelInput(event) {
    const value = clamp01(event.target.value);
    applyLevel(value);
    scheduleGlobalWrite(value);
  }

  function handleLevelChange(event) {
    const value = clamp01(event.target.value);
    applyLevel(value);
    scheduleGlobalWrite(value);
    if (scheduleConfig && !scheduleConfig.enabled) {
      queueScheduleWrite();
    }
  }

  async function handleToggleClick() {
    const nextLevel = lastLevel > 0 ? 0 : DEFAULT_LEVEL;
    applyLevel(nextLevel);
    try {
      await storage.setGlobalLevel(nextLevel);
    } catch (err) {
      console.error('Failed to toggle global level', err);
    }
    if (scheduleConfig && !scheduleConfig.enabled) {
      queueScheduleWrite();
    }
  }

  async function handleSiteToggleClick() {
    if (!currentHost) return;
    const locking = typeof currentSiteLevel !== 'number';
    const targetLevel = locking ? clamp01(lastLevel) : null;
    const previousLevel = siteLevelsCache[currentHost];

    ui.setSiteToggleDisabled(true);
    try {
      if (locking) {
        const nextLevels = Object.assign({}, siteLevelsCache, { [currentHost]: targetLevel });
        await storage.setSiteLevels(nextLevels);
        siteLevelsCache = nextLevels;
        currentSiteLevel = targetLevel;
      } else {
        const nextLevels = Object.assign({}, siteLevelsCache);
        delete nextLevels[currentHost];
        await storage.setSiteLevels(nextLevels);
        siteLevelsCache = nextLevels;
        currentSiteLevel = null;
      }
      updateSiteUI();
    } catch (err) {
      console.error('Failed to update site override', err);
      if (typeof previousLevel === 'number') {
        siteLevelsCache[currentHost] = previousLevel;
        currentSiteLevel = clamp01(previousLevel);
      } else {
        delete siteLevelsCache[currentHost];
        currentSiteLevel = null;
      }
      updateSiteUI('Update failed. Try again.');
    } finally {
      ui.setSiteToggleDisabled(false);
    }
  }

  async function init() {
    ui.bindEvents({
      onLevelInput: handleLevelInput,
      onLevelChange: handleLevelChange,
      onToggleClick: handleToggleClick,
      onSiteToggleClick: handleSiteToggleClick,
      onScheduleToggle: handleScheduleToggle,
      onScheduleRuleChange: handleScheduleRuleChange
    });

    try {
      const initial = await state.loadInitialData();
      lastLevel = initial.globalLevel;
      currentHost = initial.host;
      siteLevelsCache = initial.siteLevels || {};
      currentSiteLevel = initial.currentSiteLevel;
      scheduleConfig = Object.assign({}, initial.schedule || DEFAULT_SCHEDULE, {
        rules: (initial.schedule && initial.schedule.rules
          ? initial.schedule.rules.map((rule) => Object.assign({}, rule))
          : DEFAULT_SCHEDULE.rules.map((rule) => Object.assign({}, rule)))
      });
      if (typeof scheduleConfig.fallbackLevel !== 'number') {
        scheduleConfig.fallbackLevel = DEFAULT_LEVEL;
      }
      ensureScheduleRuleCount();
      applyLevel(lastLevel);
      updateSiteUI();
      renderSchedule();
    } catch (err) {
      console.error('Failed to initialize popup', err);
      applyLevel(DEFAULT_LEVEL);
      updateSiteUI('Unable to read saved settings.');
      scheduleConfig = Object.assign({}, DEFAULT_SCHEDULE, {
        rules: DEFAULT_SCHEDULE.rules.map((rule) => Object.assign({}, rule))
      });
      ensureScheduleRuleCount();
      renderSchedule();
    }
  }

  init();
})(typeof window !== 'undefined' ? window : this);
