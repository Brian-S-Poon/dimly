(function (global) {
  const { clamp01 } = global.ScreenDimmerMath;

  const slider = document.querySelector('#level');
  const pct = document.querySelector('#pct');
  const toggleBtn = document.querySelector('#toggle');
  const globalStatus = document.querySelector('#global-status');
  const siteControls = document.querySelector('#site-controls');
  const siteHostLabel = document.querySelector('#site-host');
  const siteStatus = document.querySelector('#site-status');
  const siteToggleBtn = document.querySelector('#site-toggle');
  const siteHint = document.querySelector('#site-hint');
  const scheduleEnabledInput = document.querySelector('#schedule-enabled');
  const scheduleStatus = document.querySelector('#schedule-status');
  const scheduleConfig = document.querySelector('#schedule-config');
  const scheduleError = document.querySelector('#schedule-error');
  const scheduleRules = [0, 1].map((index) => ({
    level: document.querySelector(`#schedule-level-${index}`),
    levelPill: document.querySelector(`#schedule-level-pill-${index}`),
    type: document.querySelector(`#schedule-type-${index}`),
    timeWrapper: document.querySelector(`#schedule-time-wrapper-${index}`),
    time: document.querySelector(`#schedule-time-${index}`),
    offsetWrapper: document.querySelector(`#schedule-offset-wrapper-${index}`),
    offset: document.querySelector(`#schedule-offset-${index}`)
  }));

  function updateLevel(level) {
    const val = clamp01(level);
    if (slider) slider.value = String(val);
    if (pct) pct.textContent = Math.round(val * 100) + '%';
  }

  function updateGlobal(level) {
    const val = clamp01(level);
    const isOn = val > 0;
    if (toggleBtn) {
      toggleBtn.textContent = isOn ? 'Turn off' : 'Turn on';
      toggleBtn.setAttribute('aria-pressed', String(isOn));
    }
    if (globalStatus) {
      globalStatus.textContent = isOn
        ? `Dimmer is on at ${Math.round(val * 100)}%.`
        : 'Dimmer is off.';
    }
  }

  function renderSite({ host, lockedLevel, globalLevel, message }) {
    if (!siteControls || !siteHostLabel || !siteStatus) return;
    siteControls.hidden = false;

    if (!host) {
      siteHostLabel.textContent = 'Per-site dimming';
      siteStatus.textContent = 'This page does not support per-site controls.';
      if (siteHint) {
        siteHint.hidden = false;
        siteHint.textContent = 'Visit another website (HTTP or HTTPS) to set a custom dim level.';
      }
      if (siteToggleBtn) {
        siteToggleBtn.hidden = true;
        siteToggleBtn.disabled = true;
      }
      return;
    }

    siteHostLabel.textContent = `Site · ${host}`;
    const isLocked = typeof lockedLevel === 'number';

    if (siteToggleBtn) {
      siteToggleBtn.hidden = false;
      siteToggleBtn.textContent = isLocked ? 'Unlock site' : 'Lock site';
    }

    if (message) {
      siteStatus.textContent = message;
    } else if (isLocked) {
      siteStatus.textContent = `Locked at ${Math.round(clamp01(lockedLevel) * 100)}%.`;
    } else {
      siteStatus.textContent = `Using global level (${Math.round(clamp01(globalLevel) * 100)}%).`;
    }

    if (siteHint) {
      siteHint.hidden = false;
      siteHint.textContent = 'Overrides apply only to this site.';
    }

    if (siteToggleBtn) {
      siteToggleBtn.disabled = false;
    }
  }

  function setSiteToggleDisabled(disabled) {
    if (siteToggleBtn) {
      siteToggleBtn.disabled = disabled;
    }
  }

  function setGlobalControlsDisabled(disabled) {
    if (slider) slider.disabled = disabled;
    if (toggleBtn) toggleBtn.disabled = disabled;
  }

  function updateScheduleEnabled(enabled) {
    if (scheduleEnabledInput) scheduleEnabledInput.checked = Boolean(enabled);
    if (scheduleConfig) {
      scheduleConfig.hidden = false;
      scheduleConfig.classList.toggle('schedule-disabled', !enabled);
    }
  }

  function updateScheduleStatus(text) {
    if (scheduleStatus) {
      scheduleStatus.textContent = text;
    }
  }

  function setScheduleError(message) {
    if (!scheduleError) return;
    if (message) {
      scheduleError.hidden = false;
      scheduleError.textContent = message;
    } else {
      scheduleError.hidden = true;
      scheduleError.textContent = '';
    }
  }

  function setScheduleInputsDisabled(disabled) {
    scheduleRules.forEach((rule) => {
      if (!rule) return;
      if (rule.level) rule.level.disabled = disabled;
      if (rule.type) rule.type.disabled = disabled;
      if (rule.time) rule.time.disabled = disabled;
      if (rule.offset) rule.offset.disabled = disabled;
    });
    if (scheduleEnabledInput) scheduleEnabledInput.disabled = disabled;
  }

  function updateScheduleRule(index, rule) {
    const node = scheduleRules[index];
    if (!node) return;
    if (typeof rule.level === 'number') {
      const v = clamp01(rule.level);
      if (node.level) node.level.value = String(v);
      if (node.levelPill) node.levelPill.textContent = Math.round(v * 100) + '%';
    }
    if (rule.type) {
      if (node.type) node.type.value = rule.type;
      if (node.timeWrapper) node.timeWrapper.hidden = rule.type !== 'custom';
      if (node.offsetWrapper) node.offsetWrapper.hidden = rule.type === 'custom';
    }
    if (typeof rule.time === 'string' && node.time) {
      node.time.value = rule.time;
    }
    if (typeof rule.offsetMinutes === 'number' && node.offset) {
      node.offset.value = String(rule.offsetMinutes);
    }
  }

  function bindEvents({ onLevelInput, onLevelChange, onToggleClick, onSiteToggleClick, onScheduleToggle, onScheduleRuleChange }) {
    if (slider && onLevelInput) {
      slider.addEventListener('input', onLevelInput);
    }
    if (slider && onLevelChange) {
      slider.addEventListener('change', onLevelChange);
    }
    if (toggleBtn && onToggleClick) {
      toggleBtn.addEventListener('click', onToggleClick);
    }
    if (siteToggleBtn && onSiteToggleClick) {
      siteToggleBtn.addEventListener('click', onSiteToggleClick);
    }
    if (scheduleEnabledInput && onScheduleToggle) {
      scheduleEnabledInput.addEventListener('change', (event) => {
        onScheduleToggle(Boolean(event.target.checked));
      });
    }
    if (Array.isArray(scheduleRules) && onScheduleRuleChange) {
      scheduleRules.forEach((node, index) => {
        if (!node) return;
        if (node.level) {
          node.level.addEventListener('input', (event) => {
            const value = clamp01(event.target.value);
            if (node.levelPill) node.levelPill.textContent = Math.round(value * 100) + '%';
            onScheduleRuleChange(index, { level: value });
          });
          node.level.addEventListener('change', (event) => {
            const value = clamp01(event.target.value);
            onScheduleRuleChange(index, { level: value });
          });
        }
        if (node.type) {
          node.type.addEventListener('change', (event) => {
            const value = event.target.value;
            if (node.timeWrapper) node.timeWrapper.hidden = value !== 'custom';
            if (node.offsetWrapper) node.offsetWrapper.hidden = value === 'custom';
            onScheduleRuleChange(index, { type: value });
          });
        }
        if (node.time) {
          node.time.addEventListener('change', (event) => {
            onScheduleRuleChange(index, { time: event.target.value });
          });
        }
        if (node.offset) {
          node.offset.addEventListener('change', (event) => {
            const value = Number(event.target.value);
            onScheduleRuleChange(index, { offsetMinutes: value });
          });
        }
      });
    }
  }

  global.ScreenDimmerPopupUI = {
    updateLevel,
    updateGlobal,
    renderSite,
    setSiteToggleDisabled,
    bindEvents,
    setGlobalControlsDisabled,
    updateScheduleEnabled,
    updateScheduleStatus,
    updateScheduleRule,
    setScheduleError,
    setScheduleInputsDisabled
  };
})(typeof window !== 'undefined' ? window : this);
