(function (global) {
  const storage = global.ScreenDimmerStorage;
  const { clamp01 } = global.ScreenDimmerMath;

  const section = document.querySelector('#schedule-controls');
  if (!section || !storage) {
    global.ScreenDimmerSchedule = { init: () => {} };
    return;
  }

  const toggleEl = section.querySelector('#schedule-enabled');
  const statusEl = section.querySelector('#schedule-status');
  const editorEl = section.querySelector('#schedule-editor');
  const fallbackEl = section.querySelector('#schedule-fallback');
  const fallbackPctEl = section.querySelector('#schedule-fallback-pct');
  const transitionEl = section.querySelector('#schedule-transition');
  const addRuleBtn = section.querySelector('#schedule-add-rule');
  const rulesListEl = section.querySelector('#schedule-rules');

  const SOLAR_SCHEDULE_ENABLED = Boolean(global.SCREEN_DIMMER_SOLAR_SCHEDULE_ENABLED);

  const RULE_TYPE_LABELS = SOLAR_SCHEDULE_ENABLED
    ? {
        [SCHEDULE_RULE_TYPES.FIXED]: 'Custom time',
        [SCHEDULE_RULE_TYPES.SOLAR]: 'Sunrise/sunset'
      }
    : null;

  const SOLAR_EVENT_LABELS = SOLAR_SCHEDULE_ENABLED
    ? {
        [SCHEDULE_SOLAR_EVENTS.SUNRISE]: 'Sunrise',
        [SCHEDULE_SOLAR_EVENTS.SUNSET]: 'Sunset'
      }
    : null;

  const cssEscape = (value) => {
    if (global.CSS && typeof global.CSS.escape === 'function') {
      return global.CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
  };

  let scheduleState = null;
  let saveTimer = null;
  let statusTimer = null;
  let isSaving = false;
  let eventsBound = false;

  function cloneSchedule(data) {
    try {
      return JSON.parse(JSON.stringify(data || DEFAULT_SCHEDULE));
    } catch (err) {
      return JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
    }
  }

  function generateId() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return `rule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function setStatus(message, isError) {
    if (!statusEl) return;
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }
    if (!message) {
      statusEl.textContent = '';
      statusEl.hidden = true;
      statusEl.classList.remove('schedule-status-error');
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.classList.toggle('schedule-status-error', Boolean(isError));
    if (!isError) {
      statusTimer = setTimeout(() => {
        statusEl.textContent = '';
        statusEl.hidden = true;
        statusEl.classList.remove('schedule-status-error');
        statusTimer = null;
      }, 3000);
    }
  }

  function updateEditorState() {
    if (!editorEl) return;
    editorEl.disabled = !scheduleState.enabled;
  }

  function updateToggle() {
    if (!toggleEl) return;
    toggleEl.checked = Boolean(scheduleState.enabled);
    updateEditorState();
  }

  function updateFallbackDisplay(value) {
    if (fallbackPctEl) {
      const pct = Math.round(clamp01(value) * 100);
      fallbackPctEl.textContent = `${pct}%`;
    }
  }

  function renderGeneral() {
    updateToggle();
    if (fallbackEl) {
      fallbackEl.value = String(clamp01(scheduleState.fallbackLevel));
      updateFallbackDisplay(scheduleState.fallbackLevel);
    }
    if (transitionEl) {
      const seconds = Math.round((Number(scheduleState.transitionMs || DEFAULT_SCHEDULE_TRANSITION_MS) / 1000) * 10) / 10;
      transitionEl.value = Number.isFinite(seconds) ? String(seconds) : '0.8';
    }
  }

  function formatFixedRuleName(rule) {
    if (!rule) return 'Rule';
    const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(rule.time || '');
    if (!match) {
      return 'Custom time';
    }
    const hours24 = Number(match[1]);
    const minutes = match[2];
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return `${hours12}:${minutes} ${period}`;
  }

  function formatSolarRuleName(rule) {
    if (!SOLAR_SCHEDULE_ENABLED || !SOLAR_EVENT_LABELS) {
      return 'Rule';
    }
    const base = rule && rule.event === SCHEDULE_SOLAR_EVENTS.SUNRISE ? 'Sunrise' : 'Sunset';
    return base;
  }

  function getRuleName(rule, index) {
    if (!rule || typeof rule !== 'object') {
      return `Rule ${index + 1}`;
    }
    if (SOLAR_SCHEDULE_ENABLED && rule.type === SCHEDULE_RULE_TYPES.SOLAR) {
      return formatSolarRuleName(rule);
    }
    const name = formatFixedRuleName(rule);
    return name || `Rule ${index + 1}`;
  }

  function createRuleElement(rule, index) {
    const li = document.createElement('li');
    li.className = 'schedule-rule-item';
    li.dataset.ruleId = rule.id;

    const titleRow = document.createElement('div');
    titleRow.className = 'schedule-rule-row';

    const nameBlock = document.createElement('div');
    nameBlock.className = 'schedule-rule-name';
    nameBlock.dataset.role = 'rule-name';
    const nameLabel = document.createElement('span');
    nameLabel.className = 'schedule-label';
    nameLabel.textContent = 'Rule';
    nameBlock.appendChild(nameLabel);
    const nameValue = document.createElement('div');
    nameValue.className = 'schedule-rule-name-value';
    nameValue.dataset.role = 'rule-name-value';
    nameValue.textContent = getRuleName(rule, typeof index === 'number' ? index : 0);
    nameBlock.appendChild(nameValue);
    titleRow.appendChild(nameBlock);

    li.appendChild(titleRow);

    const controlsRow = document.createElement('div');
    controlsRow.className = 'schedule-rule-row';

    let eventWrap = null;

    if (SOLAR_SCHEDULE_ENABLED && RULE_TYPE_LABELS && SOLAR_EVENT_LABELS) {
      const typeWrap = document.createElement('label');
      typeWrap.innerHTML = `<span class="schedule-label">Type</span>`;
      const typeSelect = document.createElement('select');
      typeSelect.dataset.action = 'type';
      Object.keys(RULE_TYPE_LABELS).forEach((typeKey) => {
        const option = document.createElement('option');
        option.value = typeKey;
        option.textContent = RULE_TYPE_LABELS[typeKey];
        if (typeKey === rule.type) option.selected = true;
        typeSelect.appendChild(option);
      });
      typeWrap.appendChild(typeSelect);
      controlsRow.appendChild(typeWrap);

      eventWrap = document.createElement('label');
      eventWrap.dataset.role = 'event-container';
      eventWrap.innerHTML = `<span class="schedule-label">Event</span>`;
      const eventSelect = document.createElement('select');
      eventSelect.dataset.action = 'event';
      Object.keys(SOLAR_EVENT_LABELS).forEach((eventKey) => {
        const option = document.createElement('option');
        option.value = eventKey;
        option.textContent = SOLAR_EVENT_LABELS[eventKey];
        if (eventKey === rule.event) option.selected = true;
        eventSelect.appendChild(option);
      });
      eventWrap.appendChild(eventSelect);
    }

    const timeWrap = document.createElement('label');
    timeWrap.dataset.role = 'time-container';
    timeWrap.innerHTML = `<span class="schedule-label">Time</span>`;
    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.step = 60;
    timeInput.value = parseTime(rule.time) ? rule.time : '19:00';
    timeInput.dataset.action = 'time';
    timeWrap.appendChild(timeInput);
    controlsRow.appendChild(timeWrap);

    if (SOLAR_SCHEDULE_ENABLED && eventWrap) {
      controlsRow.appendChild(eventWrap);
    }

    li.appendChild(controlsRow);

    const actionsRow = document.createElement('div');
    actionsRow.className = 'schedule-rule-actions';

    const sliderGroup = document.createElement('div');
    sliderGroup.className = 'slider-group compact';

    const sliderMeta = document.createElement('div');
    sliderMeta.className = 'slider-meta';
    const sliderLabel = document.createElement('label');
    const sliderId = `${rule.id}-slider`;
    sliderLabel.setAttribute('for', sliderId);
    sliderLabel.textContent = 'Level';
    sliderMeta.appendChild(sliderLabel);
    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.dataset.role = 'pct';
    pill.textContent = `${Math.round(clamp01(rule.level) * 100)}%`;
    sliderMeta.appendChild(pill);
    sliderGroup.appendChild(sliderMeta);

    const sliderInput = document.createElement('input');
    sliderInput.type = 'range';
    sliderInput.min = '0';
    sliderInput.max = '1';
    sliderInput.step = '0.01';
    sliderInput.value = String(clamp01(rule.level));
    sliderInput.id = sliderId;
    sliderInput.dataset.action = 'level';
    sliderGroup.appendChild(sliderInput);

    actionsRow.appendChild(sliderGroup);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'link-button danger-link';
    removeBtn.dataset.action = 'remove';
    removeBtn.textContent = 'Remove';
    actionsRow.appendChild(removeBtn);

    li.appendChild(actionsRow);

    if (SOLAR_SCHEDULE_ENABLED && eventWrap) {
      const isSolar = rule.type === SCHEDULE_RULE_TYPES.SOLAR;
      timeWrap.hidden = isSolar;
      eventWrap.hidden = !isSolar;
    }

    return li;
  }

  function renderRules() {
    if (!rulesListEl) return;
    rulesListEl.innerHTML = '';
    const rules = Array.isArray(scheduleState.rules) ? scheduleState.rules.slice() : [];
    if (!rules.length) {
      const empty = document.createElement('li');
      empty.className = 'muted small-text';
      empty.textContent = 'No rules yet. Add one to start scheduling.';
      rulesListEl.appendChild(empty);
      return;
    }
    rules.forEach((rule, index) => {
      rulesListEl.appendChild(createRuleElement(rule, index));
    });
  }

  function render() {
    renderGeneral();
    renderRules();
  }

  function parseTime(value) {
    return /^([0-1]?\d|2[0-3]):([0-5]\d)$/.test(value || '');
  }

  function validateSchedule(data) {
    const errors = [];
    if (!data) return ['Schedule missing'];
    if (data.enabled) {
      const activeRules = (data.rules || []).filter((rule) => Boolean(rule));
      if (!activeRules.length) {
        errors.push('Add at least one rule.');
      }
      activeRules.forEach((rule, index) => {
        const allRules = Array.isArray(data.rules) ? data.rules : [];
        const ruleIndex = allRules.indexOf(rule);
        const name = getRuleName(rule, ruleIndex >= 0 ? ruleIndex : index);
        if (!SOLAR_SCHEDULE_ENABLED || rule.type !== SCHEDULE_RULE_TYPES.SOLAR) {
          if (!parseTime(rule.time)) {
            errors.push(`Set a valid time for ${name}.`);
          }
        } else if (!SOLAR_EVENT_LABELS || !Object.prototype.hasOwnProperty.call(SOLAR_EVENT_LABELS, rule.event)) {
          errors.push(`Choose sunrise or sunset for ${name}.`);
        }
      });
    }
    const seconds = Number(data.transitionMs) / 1000;
    if (Number.isFinite(seconds) && seconds > 60) {
      errors.push('Transition must be 60 seconds or less.');
    }
    return errors;
  }

  async function saveSchedule() {
    if (isSaving) return;
    isSaving = true;
    try {
      const normalized = await storage.setSchedule(cloneSchedule(scheduleState));
      scheduleState = cloneSchedule(normalized);
      render();
      setStatus('Schedule saved.');
    } catch (error) {
      console.error('Failed to save schedule', error);
      setStatus('Failed to save schedule. Try again.', true);
    } finally {
      isSaving = false;
    }
  }

  function requestSave() {
    const errors = validateSchedule(scheduleState);
    if (errors.length) {
      setStatus(errors[0], true);
      return;
    }
    setStatus('Saving…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSchedule, 300);
  }

  function updateRuleVisibility(ruleId) {
    if (!SOLAR_SCHEDULE_ENABLED) return;
    const item = rulesListEl && rulesListEl.querySelector(`[data-rule-id="${cssEscape(ruleId)}"]`);
    if (!item) return;
    const rule = scheduleState.rules.find((entry) => entry.id === ruleId);
    if (!rule) return;
    const isSolar = rule.type === SCHEDULE_RULE_TYPES.SOLAR;
    const timeBlock = item.querySelector('[data-role="time-container"]');
    const eventBlock = item.querySelector('[data-role="event-container"]');
    if (timeBlock) timeBlock.hidden = isSolar;
    if (eventBlock) eventBlock.hidden = !isSolar;
  }

  function refreshRuleName(ruleId) {
    if (!rulesListEl) return;
    const item = rulesListEl.querySelector(`[data-rule-id="${cssEscape(ruleId)}"]`);
    if (!item) return;
    const ruleIndex = Array.isArray(scheduleState.rules)
      ? scheduleState.rules.findIndex((entry) => entry.id === ruleId)
      : -1;
    if (ruleIndex < 0) return;
    const rule = scheduleState.rules[ruleIndex];
    if (!rule) return;
    const valueEl = item.querySelector('[data-role="rule-name-value"]');
    if (valueEl) {
      valueEl.textContent = getRuleName(rule, ruleIndex);
    }
  }

  function handleToggleChange(event) {
    scheduleState.enabled = Boolean(event.target.checked);
    updateEditorState();
    requestSave();
  }

  function handleFallbackInput(event) {
    const value = clamp01(event.target.value);
    scheduleState.fallbackLevel = value;
    updateFallbackDisplay(value);
    requestSave();
  }

  function handleTransitionChange(event) {
    const seconds = Number(event.target.value);
    if (!Number.isFinite(seconds) || seconds < 0) {
      scheduleState.transitionMs = 0;
    } else {
      scheduleState.transitionMs = Math.round(Math.min(seconds, 60) * 1000);
    }
    requestSave();
  }

  function handleAddRule() {
    const rule = {
      id: generateId(),
      time: '19:00',
      level: clamp01(scheduleState.fallbackLevel || DEFAULT_LEVEL)
    };
    if (SOLAR_SCHEDULE_ENABLED) {
      rule.type = SCHEDULE_RULE_TYPES.FIXED;
      rule.event = SCHEDULE_SOLAR_EVENTS.SUNSET;
    }
    if (!Array.isArray(scheduleState.rules)) {
      scheduleState.rules = [];
    }
    scheduleState.rules.push(rule);
    renderRules();
    requestSave();
  }

  function findRule(ruleId) {
    if (!Array.isArray(scheduleState.rules)) return null;
    return scheduleState.rules.find((rule) => rule.id === ruleId) || null;
  }

  function handleRuleInput(event) {
    const target = event.target;
    const item = target.closest('[data-rule-id]');
    if (!item) return;
    const ruleId = item.dataset.ruleId;
    const rule = findRule(ruleId);
    if (!rule) return;
    let shouldUpdateName = false;
    switch (target.dataset.action) {
      case 'level': {
        const value = clamp01(target.value);
        rule.level = value;
        const pill = item.querySelector('[data-role="pct"]');
        if (pill) pill.textContent = `${Math.round(value * 100)}%`;
        break;
      }
      case 'time':
        rule.time = target.value;
        shouldUpdateName = true;
        break;
      default:
        break;
    }
    if (shouldUpdateName) {
      refreshRuleName(ruleId);
    }
  }

  function handleRuleChange(event) {
    const target = event.target;
    const item = target.closest('[data-rule-id]');
    if (!item) return;
    const ruleId = item.dataset.ruleId;
    const rule = findRule(ruleId);
    if (!rule) return;
    let shouldUpdateName = false;
    switch (target.dataset.action) {
      case 'type':
        if (SOLAR_SCHEDULE_ENABLED) {
          rule.type = target.value === SCHEDULE_RULE_TYPES.SOLAR
            ? SCHEDULE_RULE_TYPES.SOLAR
            : SCHEDULE_RULE_TYPES.FIXED;
          if (rule.type === SCHEDULE_RULE_TYPES.FIXED && !parseTime(rule.time)) {
            rule.time = '19:00';
          }
          if (
            rule.type === SCHEDULE_RULE_TYPES.SOLAR &&
            (!SOLAR_EVENT_LABELS || !Object.prototype.hasOwnProperty.call(SOLAR_EVENT_LABELS, rule.event))
          ) {
            rule.event = SCHEDULE_SOLAR_EVENTS.SUNSET;
          }
          updateRuleVisibility(ruleId);
          shouldUpdateName = true;
        }
        break;
      case 'event':
        if (SOLAR_SCHEDULE_ENABLED && SOLAR_EVENT_LABELS) {
          rule.event = Object.prototype.hasOwnProperty.call(SOLAR_EVENT_LABELS, target.value)
            ? target.value
            : SCHEDULE_SOLAR_EVENTS.SUNSET;
          shouldUpdateName = true;
        }
        break;
      case 'time':
        rule.time = target.value;
        shouldUpdateName = true;
        break;
      case 'level':
        rule.level = clamp01(target.value);
        break;
      default:
        break;
    }
    if (shouldUpdateName) {
      refreshRuleName(ruleId);
    }
    requestSave();
  }

  function handleRuleClick(event) {
    const target = event.target;
    if (!target || target.dataset.action !== 'remove') return;
    const item = target.closest('[data-rule-id]');
    if (!item) return;
    const ruleId = item.dataset.ruleId;
    if (!Array.isArray(scheduleState.rules)) return;
    scheduleState.rules = scheduleState.rules.filter((rule) => rule.id !== ruleId);
    renderRules();
    requestSave();
  }

  function bindEvents() {
    if (eventsBound) return;
    if (toggleEl) {
      toggleEl.addEventListener('change', handleToggleChange);
    }
    if (fallbackEl) {
      fallbackEl.addEventListener('input', handleFallbackInput);
      fallbackEl.addEventListener('change', handleFallbackInput);
    }
    if (transitionEl) {
      transitionEl.addEventListener('change', handleTransitionChange);
    }
    if (addRuleBtn) {
      addRuleBtn.addEventListener('click', handleAddRule);
    }
    if (rulesListEl) {
      rulesListEl.addEventListener('input', handleRuleInput);
      rulesListEl.addEventListener('change', handleRuleChange);
      rulesListEl.addEventListener('click', handleRuleClick);
    }
    eventsBound = true;
  }

  function init(initialSchedule) {
    scheduleState = cloneSchedule(initialSchedule);
    render();
    bindEvents();
  }

  global.ScreenDimmerSchedule = { init };
})(typeof window !== 'undefined' ? window : this);
