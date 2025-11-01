import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';

function createNode(tag) {
  const node = {
    tagName: tag.toUpperCase(),
    id: '',
    style: {},
    children: [],
    parentElement: null,
    isConnected: false,
    appendChild(child) {
      if (child.parentElement) {
        child.parentElement.removeChild(child);
      }
      child.parentElement = this;
      this.children.push(child);
      child.isConnected = this.isConnected;
      return child;
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) {
        this.children.splice(idx, 1);
        child.parentElement = null;
        child.isConnected = false;
      }
      return child;
    },
    remove() {
      if (this.parentElement) {
        this.parentElement.removeChild(this);
      }
    }
  };
  return node;
}

function findById(node, targetId) {
  if (!node) return null;
  if (node.id === targetId) return node;
  for (const child of node.children || []) {
    const found = findById(child, targetId);
    if (found) return found;
  }
  return null;
}

function createDocument() {
  const documentElement = createNode('html');
  documentElement.isConnected = true;
  const body = createNode('body');
  const head = createNode('head');
  documentElement.appendChild(body);
  documentElement.appendChild(head);

  const doc = {
    documentElement,
    body,
    head,
    createElement: (tag) => {
      const el = createNode(tag);
      el.setAttribute = (name, value) => {
        if (name === 'id') {
          el.id = value;
        } else {
          el[name] = value;
        }
      };
      return el;
    },
    getElementById: (id) => {
      return (
        findById(documentElement, id) ||
        findById(body, id) ||
        findById(head, id)
      );
    },
    addEventListener: () => {}
  };
  return doc;
}

let storageState;
let originalGlobals;
let windowStub;

before(async () => {
  storageState = { globalLevel: 0.6, siteLevels: {} };
  originalGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    location: globalThis.location,
    DEFAULT_LEVEL: globalThis.DEFAULT_LEVEL,
    GLOBAL_KEY: globalThis.GLOBAL_KEY,
    SITE_KEY: globalThis.SITE_KEY,
    MutationObserver: globalThis.MutationObserver,
    chrome: globalThis.chrome
  };

  windowStub = {
    ScreenDimmerMath: {
      clamp01(value) {
        const num = Number(value ?? 0);
        if (Number.isNaN(num)) return 0;
        return Math.max(0, Math.min(1, num));
      }
    },
    ScreenDimmerStorage: {
      getLevelState: () => Promise.resolve(structuredClone(storageState))
    }
  };
  windowStub.window = windowStub;

  globalThis.window = windowStub;
  globalThis.document = createDocument();
  globalThis.location = { hostname: 'example.com' };
  globalThis.DEFAULT_LEVEL = 0.25;
  globalThis.GLOBAL_KEY = 'screendimmer_global_level';
  globalThis.SITE_KEY = 'screendimmer_site_levels';
  globalThis.MutationObserver = class {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    disconnect() {}
  };
  globalThis.chrome = {
    storage: {
      onChanged: {
        addListener: () => {}
      }
    }
  };
  windowStub.document = globalThis.document;

  await import('../src/content/overlay.js');
  windowStub.ScreenDimmerOverlay._resetForTest();
});

beforeEach(() => {
  storageState = { globalLevel: 0.6, siteLevels: {} };
  const doc = createDocument();
  windowStub.document = doc;
  globalThis.document = doc;
  globalThis.location = { hostname: 'example.com' };
  windowStub.ScreenDimmerOverlay._resetForTest();
});

after(() => {
  globalThis.window = originalGlobals.window;
  globalThis.document = originalGlobals.document;
  globalThis.location = originalGlobals.location;
  globalThis.DEFAULT_LEVEL = originalGlobals.DEFAULT_LEVEL;
  globalThis.GLOBAL_KEY = originalGlobals.GLOBAL_KEY;
  globalThis.SITE_KEY = originalGlobals.SITE_KEY;
  globalThis.MutationObserver = originalGlobals.MutationObserver;
  globalThis.chrome = originalGlobals.chrome;
});

function getOverlay() {
  return findById(globalThis.document.documentElement, 'screendimmer-overlay');
}

test('applies site override level for current host', async () => {
  storageState = {
    globalLevel: 0.4,
    siteLevels: { 'example.com': 0.7 }
  };

  await windowStub.ScreenDimmerOverlay.loadLevel();
  const overlay = getOverlay();
  assert.ok(overlay, 'expected overlay to be created');
  assert.equal(overlay.style.background, 'rgba(0,0,0,0.7)');
});

test('falls back to global level when no site override exists', async () => {
  storageState = {
    globalLevel: 0.33,
    siteLevels: { 'other.com': 0.9 }
  };

  await windowStub.ScreenDimmerOverlay.loadLevel();
  const overlay = getOverlay();
  assert.ok(overlay, 'expected overlay to be created');
  assert.equal(overlay.style.background, 'rgba(0,0,0,0.33)');
});
