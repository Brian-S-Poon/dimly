import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');
const localesDir = path.join(projectRoot, '_locales');
const SUPPORTED_EXTENSIONS = new Set(['.html', '.js']);

async function walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractI18nKeys(content) {
  const keys = new Set();

  const dataI18nRegex = /data-i18n=(?:"([^"]+)"|'([^']+)')/g;
  let match;
  while ((match = dataI18nRegex.exec(content)) !== null) {
    const raw = match[1] ?? match[2];
    if (!raw) continue;
    raw
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => keys.add(value));
  }

  const dataAttrRegex = /data-i18n-attr=(?:"([^"]+)"|'([^']+)')/g;
  while ((match = dataAttrRegex.exec(content)) !== null) {
    const raw = match[1] ?? match[2];
    if (!raw) continue;
    raw
      .split(',')
      .map((part) => part.split(':').map((value) => value && value.trim()))
      .forEach(([, key]) => {
        if (key) {
          keys.add(key);
        }
      });
  }

  const getMessageRegex = /getMessage\(\s*['"]([^'"\s]+)['"]/g;
  while ((match = getMessageRegex.exec(content)) !== null) {
    const key = match[1];
    if (key) {
      keys.add(key);
    }
  }

  return keys;
}

test('all referenced i18n keys exist for each locale', async () => {
  const files = await walkFiles(srcDir);
  const referencedKeys = new Set();

  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const fileKeys = extractI18nKeys(content);
    fileKeys.forEach((key) => referencedKeys.add(key));
  }

  assert.ok(referencedKeys.size > 0, 'expected to discover localized message keys');

  const localeEntries = await readdir(localesDir, { withFileTypes: true });
  const localeDirs = localeEntries.filter((entry) => entry.isDirectory());
  assert.ok(localeDirs.length > 0, 'expected at least one locale directory');

  for (const locale of localeDirs) {
    const messagesPath = path.join(localesDir, locale.name, 'messages.json');
    const raw = await readFile(messagesPath, 'utf8');
    const messages = JSON.parse(raw);

    referencedKeys.forEach((key) => {
      assert.ok(Object.prototype.hasOwnProperty.call(messages, key), `${locale.name} locale is missing message: ${key}`);
      const value = messages[key];
      assert.ok(value && typeof value.message === 'string' && value.message.length > 0, `${locale.name} locale has invalid message for key: ${key}`);
    });
  }
});
