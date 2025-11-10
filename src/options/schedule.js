(function (global) {
  const storage = global.ScreenDimmerStorage;
  const { clamp01 } = global.ScreenDimmerMath;
  const i18n = global.ScreenDimmerI18n;

  const getMessage = (key, substitutions) => {
    if (i18n && typeof i18n.getMessage === 'function') {
      return i18n.getMessage(key, substitutions);
    }
    if (Array.isArray(substitutions) && substitutions.length) {
      return substitutions.join(' ');
    }
    return key || '';
  };

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
      const pct = String(Math.round(clamp01(value) * 100));
      fallbackPctEl.textContent = getMessage('commonPercentValue', [pct]);
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
    if (!rule) return getMessage('scheduleRuleLabel');
    const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(rule.time || '');
    if (!match) {
      return getMessage('scheduleRuleCustomTime');
    }
    const hours24 = Number(match[1]);
    const minutes = match[2];
    const period = hours24 >= 12
      ? getMessage('scheduleRulePeriodPM')
      : getMessage('scheduleRulePeriodAM');
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return getMessage('scheduleRuleTimeFormat', [String(hours12), minutes, period]);
  }

  function getRuleName(rule, index) {
    if (!rule || typeof rule !== 'object') {
      return getMessage('scheduleRuleDefaultName', [String((index || 0) + 1)]);
    }
    const name = formatFixedRuleName(rule);
    return name || getMessage('scheduleRuleDefaultName', [String((index || 0) + 1)]);
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
    nameLabel.textContent = getMessage('scheduleRuleLabel');
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

    const timeWrap = document.createElement('label');
    timeWrap.dataset.role = 'time-container';
    const timeLabel = document.createElement('span');
    timeLabel.className = 'schedule-label';
    timeLabel.textContent = getMessage('scheduleTimeLabel');
    timeWrap.appendChild(timeLabel);
    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.step = 60;
    timeInput.value = parseTime(rule.time) ? rule.time : '19:00';
    timeInput.dataset.action = 'time';
    timeWrap.appendChild(timeInput);
    controlsRow.appendChild(timeWrap);

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
    sliderLabel.textContent = getMessage('scheduleLevelLabel');
    sliderMeta.appendChild(sliderLabel);
    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.dataset.role = 'pct';
    const percent = String(Math.round(clamp01(rule.level) * 100));
    pill.textContent = getMessage('commonPercentValue', [percent]);
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
    removeBtn.textContent = getMessage('scheduleRemove');
    actionsRow.appendChild(removeBtn);

    li.appendChild(actionsRow);

    return li;
  }

  function renderRules() {
    if (!rulesListEl) return;
    rulesListEl.innerHTML = '';
    const rules = Array.isArray(scheduleState.rules) ? scheduleState.rules.slice() : [];
    if (!rules.length) {
      const empty = document.createElement('li');
      empty.className = 'muted small-text';
      empty.textContent = getMessage('scheduleRulesEmpty');
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
    if (!data) return [getMessage('scheduleMissingError')];
    if (data.enabled) {
      const activeRules = (data.rules || []).filter((rule) => Boolean(rule));
      if (!activeRules.length) {
        errors.push(getMessage('scheduleAddRuleError'));
      }
      activeRules.forEach((rule, index) => {
        const allRules = Array.isArray(data.rules) ? data.rules : [];
        const ruleIndex = allRules.indexOf(rule);
        const name = getRuleName(rule, ruleIndex >= 0 ? ruleIndex : index);
        if (!parseTime(rule.time)) {
          errors.push(getMessage('scheduleTimeInvalidError', [name]));
        }
      });
    }
    const seconds = Number(data.transitionMs) / 1000;
    if (Number.isFinite(seconds) && seconds > 60) {
      errors.push(getMessage('scheduleTransitionError'));
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
      setStatus(getMessage('scheduleSavedStatus'));
    } catch (error) {
      console.error('Failed to save schedule', error);
      setStatus(getMessage('scheduleSaveFailed'), true);
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
    setStatus(getMessage('scheduleSavingStatus'));
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSchedule, 300);
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
        if (pill) {
          const percent = String(Math.round(value * 100));
          pill.textContent = getMessage('commonPercentValue', [percent]);
        }
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
