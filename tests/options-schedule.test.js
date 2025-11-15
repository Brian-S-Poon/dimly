import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';

let originalGlobals;
let scheduleApi;
let windowStub;
let elements;
let activeTimeouts = new Map();
let nextTimerId = 1;

function createClassList() {
  const classes = new Set();
  return {
    add(...names) {
      names.forEach((name) => {
        if (name) classes.add(name);
      });
    },
    remove(...names) {
      names.forEach((name) => classes.delete(name));
    },
    toggle(name, force) {
      if (force === undefined) {
        if (classes.has(name)) {
          classes.delete(name);
          return false;
        }
        classes.add(name);
        return true;
      }
      if (force) {
        classes.add(name);
      } else {
        classes.delete(name);
      }
      return classes.has(name);
    },
    contains(name) {
      return classes.has(name);
    },
    clear() {
      classes.clear();
    }
  };
}

function matchesSelector(node, selector) {
  if (!node || !selector) return false;
  if (selector.startsWith('[data-role="') && selector.endsWith('"]')) {
    const value = selector.slice(12, -2);
    return node.dataset && node.dataset.role === value;
  }
  if (selector.startsWith('[data-rule-id="') && selector.endsWith('"]')) {
    const value = selector.slice(14, -2);
    return node.dataset && node.dataset.ruleId === value;
  }
  if (selector.startsWith('#')) {
    return node.id === selector.slice(1);
  }
  return false;
}

function createElement(tag) {
  const element = {
    tagName: String(tag || 'div').toUpperCase(),
    id: '',
    value: '',
    textContent: '',
    hidden: false,
    disabled: false,
    dataset: {},
    style: {},
    className: '',
    parentElement: null,
    children: [],
    listeners: new Map(),
    classList: createClassList(),
    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      const current = this.listeners.get(type);
      if (!handler || current === handler) {
        this.listeners.delete(type);
      }
    },
    dispatchEvent(event) {
      const evt = event || {};
      evt.type = evt.type || '';
      if (!evt.target) {
        evt.target = this;
      }
      const handler = this.listeners.get(evt.type);
      if (typeof handler === 'function') {
        handler(evt);
      }
      return true;
    },
    appendChild(child) {
      if (!child) return child;
      this.children.push(child);
      child.parentElement = this;
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) {
        this.children.splice(index, 1);
        child.parentElement = null;
      }
      return child;
    },
    querySelector(selector) {
      for (const child of this.children) {
        if (matchesSelector(child, selector)) {
          return child;
        }
        const found = child.querySelector(selector);
        if (found) {
          return found;
        }
      }
      return null;
    },
    closest(selector) {
      let node = this;
      while (node) {
        if (matchesSelector(node, selector)) {
          return node;
        }
        node = node.parentElement || null;
      }
      return null;
    },
    setAttribute(name, value) {
      if (name === 'id') {
        this.id = value;
      } else if (name && name.startsWith('data-')) {
        const dataName = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.dataset[dataName] = value;
      } else {
        this[name] = value;
      }
    }
  };
  Object.defineProperty(element, 'innerHTML', {
    get() {
      return this._innerHTML || '';
    },
    set(value) {
      this._innerHTML = String(value);
      this.children = [];
    }
  });
  return element;
}

function createScheduleDocument() {
  const elementsMap = new Map();
  const section = createElement('section');
  section.id = 'schedule-controls';
  section.querySelector = (selector) => {
    if (selector && selector.startsWith('#')) {
      const id = selector.slice(1);
      return elementsMap.get(id) || null;
    }
    return null;
  };

  const register = (tag, id) => {
    const el = createElement(tag);
    el.id = id;
    elementsMap.set(id, el);
    section.appendChild(el);
    return el;
  };

  register('input', 'schedule-enabled');
  const statusEl = register('div', 'schedule-status');
  statusEl.hidden = true;
  register('div', 'schedule-editor');
  register('input', 'schedule-fallback');
  register('span', 'schedule-fallback-pct');
  register('input', 'schedule-transition');
  register('button', 'schedule-add-rule');
  register('ul', 'schedule-rules');

  const documentStub = {
    querySelector(selector) {
      if (selector === '#schedule-controls') {
        return section;
      }
      if (selector && selector.startsWith('#')) {
        const id = selector.slice(1);
        return elementsMap.get(id) || null;
      }
      return null;
    },
    createElement(tag) {
      return createElement(tag);
    }
  };

  return { document: documentStub, elements: elementsMap };
}

function trackSetTimeout(fn, delay) {
  const id = nextTimerId++;
  activeTimeouts.set(id, { fn, delay });
  return id;
}

function trackClearTimeout(id) {
  if (id == null) return;
  activeTimeouts.delete(id);
}

before(async () => {
  originalGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    DEFAULT_LEVEL: globalThis.DEFAULT_LEVEL,
    DEFAULT_SCHEDULE: globalThis.DEFAULT_SCHEDULE,
    DEFAULT_SCHEDULE_TRANSITION_MS: globalThis.DEFAULT_SCHEDULE_TRANSITION_MS
  };

  globalThis.setTimeout = trackSetTimeout;
  globalThis.clearTimeout = trackClearTimeout;

  const { document, elements: elementsMap } = createScheduleDocument();
  elements = elementsMap;

  windowStub = {
    document,
    ScreenDimmerMath: {
      clamp01(value) {
        const num = Number(value ?? 0);
        if (!Number.isFinite(num)) return 0;
        return Math.max(0, Math.min(1, num));
      }
    },
    ScreenDimmerI18n: {
      getMessage(key, substitutions) {
        if (Array.isArray(substitutions) && substitutions.length) {
          return `${key}:${substitutions.join(',')}`;
        }
        return key;
      }
    },
    ScreenDimmerStorage: {
      async setSchedule(data) {
        return JSON.parse(JSON.stringify(data));
      }
    }
  };

  windowStub.setTimeout = trackSetTimeout;
  windowStub.clearTimeout = trackClearTimeout;
  windowStub.window = windowStub;
  globalThis.window = windowStub;
  globalThis.document = document;

  const defaultSchedule = {
    enabled: false,
    transitionMs: 600,
    fallbackLevel: 0.25,
    rules: []
  };

  globalThis.DEFAULT_LEVEL = 0.25;
  globalThis.DEFAULT_SCHEDULE_TRANSITION_MS = 600;
  globalThis.DEFAULT_SCHEDULE = defaultSchedule;
  windowStub.DEFAULT_LEVEL = globalThis.DEFAULT_LEVEL;
  windowStub.DEFAULT_SCHEDULE_TRANSITION_MS = globalThis.DEFAULT_SCHEDULE_TRANSITION_MS;
  windowStub.DEFAULT_SCHEDULE = defaultSchedule;

  await import('../src/options/schedule.js');
  scheduleApi = windowStub.ScreenDimmerSchedule;
});

beforeEach(() => {
  if (scheduleApi && typeof scheduleApi.destroy === 'function') {
    scheduleApi.destroy();
  }
  activeTimeouts = new Map();
  nextTimerId = 1;

  const statusEl = elements.get('schedule-status');
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.hidden = true;
    if (statusEl.classList && typeof statusEl.classList.clear === 'function') {
      statusEl.classList.clear();
    }
  }
  const fallbackEl = elements.get('schedule-fallback');
  if (fallbackEl) {
    fallbackEl.value = '0.25';
  }
});

after(() => {
  if (scheduleApi && typeof scheduleApi.destroy === 'function') {
    scheduleApi.destroy();
  }
  globalThis.window = originalGlobals.window;
  globalThis.document = originalGlobals.document;
  if (originalGlobals.setTimeout) {
    globalThis.setTimeout = originalGlobals.setTimeout;
  } else {
    delete globalThis.setTimeout;
  }
  if (originalGlobals.clearTimeout) {
    globalThis.clearTimeout = originalGlobals.clearTimeout;
  } else {
    delete globalThis.clearTimeout;
  }
  if (originalGlobals.DEFAULT_LEVEL === undefined) {
    delete globalThis.DEFAULT_LEVEL;
  } else {
    globalThis.DEFAULT_LEVEL = originalGlobals.DEFAULT_LEVEL;
  }
  if (originalGlobals.DEFAULT_SCHEDULE === undefined) {
    delete globalThis.DEFAULT_SCHEDULE;
  } else {
    globalThis.DEFAULT_SCHEDULE = originalGlobals.DEFAULT_SCHEDULE;
  }
  if (originalGlobals.DEFAULT_SCHEDULE_TRANSITION_MS === undefined) {
    delete globalThis.DEFAULT_SCHEDULE_TRANSITION_MS;
  } else {
    globalThis.DEFAULT_SCHEDULE_TRANSITION_MS = originalGlobals.DEFAULT_SCHEDULE_TRANSITION_MS;
  }
});

test('destroy clears pending timers', () => {
  assert.ok(scheduleApi, 'expected schedule API to be defined');
  assert.equal(typeof scheduleApi.destroy, 'function', 'destroy should be exported');

  scheduleApi.init({
    enabled: false,
    fallbackLevel: 0.4,
    transitionMs: 700,
    rules: []
  });

  const fallbackEl = elements.get('schedule-fallback');
  fallbackEl.value = '0.5';
  fallbackEl.dispatchEvent({ type: 'input' });

  assert.equal(activeTimeouts.size, 2, 'expected timers to be scheduled after change');

  scheduleApi.destroy();
  assert.equal(activeTimeouts.size, 0, 'expected destroy to clear timers');
});

test('init clears previous timers before reinitializing', () => {
  scheduleApi.init({
    enabled: true,
    fallbackLevel: 0.6,
    transitionMs: 800,
    rules: [
      { id: 'initial', time: '07:00', level: 0.3 }
    ]
  });

  const fallbackEl = elements.get('schedule-fallback');
  fallbackEl.value = '0.7';
  fallbackEl.dispatchEvent({ type: 'input' });

  assert.equal(activeTimeouts.size, 2, 'expected timers to be scheduled');

  scheduleApi.init({
    enabled: false,
    fallbackLevel: 0.3,
    transitionMs: 500,
    rules: [
      { id: 'next', time: '19:30', level: 0.45 }
    ]
  });

  assert.equal(activeTimeouts.size, 0, 'expected previous timers to be cleared before init');
});
