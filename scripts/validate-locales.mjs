#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import { parse as babelParse } from '@babel/parser';
import { parse as parseIcu } from '@formatjs/icu-messageformat-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT_DIR, '_locales');
const SOURCE_DIRS = [path.join(ROOT_DIR, 'src'), path.join(ROOT_DIR, 'tests')];
const JS_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const HTML_EXTENSIONS = new Set(['.html', '.htm']);
const DEFAULT_LOCALE = 'en';

const errors = [];

function reportError(message) {
  errors.push(message);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse JSON at ${path.relative(ROOT_DIR, filePath)}: ${error.message}`);
  }
}

async function listDirectories(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

function collectIcuPlaceholders(message, locale, key, relativePath) {
  if (typeof message !== 'string' || message.length === 0) {
    return new Set();
  }

  let ast;
  try {
    ast = parseIcu(message, { captureLocation: false, ignoreTag: true });
  } catch (error) {
    reportError(
      `Invalid ICU message for key "${key}" in ${relativePath} (${locale}): ${error.message}`,
    );
    return new Set();
  }

  const placeholders = new Set();

  const visit = (element) => {
    if (!element) {
      return;
    }

    switch (element.type) {
      case 'argumentElement': {
        if (typeof element.value === 'string') {
          placeholders.add(element.value);
        }
        if (element.format && element.format.options) {
          for (const option of Object.values(element.format.options)) {
            if (option && Array.isArray(option.value)) {
              option.value.forEach(visit);
            }
          }
        }
        break;
      }
      case 'pluralElement':
      case 'selectElement': {
        if (typeof element.value === 'string') {
          placeholders.add(element.value);
        }
        if (element.options) {
          for (const option of Object.values(element.options)) {
            if (option && Array.isArray(option.value)) {
              option.value.forEach(visit);
            }
          }
        }
        break;
      }
      case 'tagElement': {
        if (Array.isArray(element.children)) {
          element.children.forEach(visit);
        }
        break;
      }
      default: {
        // Literal, poundElement, etc. No placeholders to collect.
        break;
      }
    }
  };

  if (Array.isArray(ast)) {
    ast.forEach(visit);
  }

  return placeholders;
}

function collectChromePlaceholders(entry, locale, key, relativePath) {
  const placeholders = new Map();
  if (!entry || typeof entry !== 'object') {
    return placeholders;
  }

  if (!entry.placeholders) {
    return placeholders;
  }

  const message = typeof entry.message === 'string' ? entry.message : '';
  const definedNames = Object.keys(entry.placeholders);
  const tokenMatches = Array.from(message.matchAll(/\$([A-Z0-9_]+)\$/g));
  const tokens = new Set(tokenMatches.map((match) => match[1].toLowerCase()));

  for (const name of definedNames) {
    const details = entry.placeholders[name];
    if (!details || typeof details.content !== 'string' || details.content.length === 0) {
      reportError(
        `Placeholder "${name}" for key "${key}" in ${relativePath} (${locale}) is missing valid content mapping.`,
      );
      continue;
    }

    const normalized = name.toLowerCase();
    placeholders.set(normalized, {
      content: details.content,
    });

    const expectedToken = `$${name.toUpperCase()}$`;
    if (!message.includes(expectedToken)) {
      reportError(
        `Message for key "${key}" in ${relativePath} (${locale}) does not include token ${expectedToken} for placeholder "${name}".`,
      );
    }
  }

  for (const tokenName of tokens) {
    if (!placeholders.has(tokenName)) {
      reportError(
        `Message for key "${key}" in ${relativePath} (${locale}) references token "${tokenName}" but no matching placeholder metadata was provided.`,
      );
    }
  }

  return placeholders;
}

async function loadLocaleData() {
  const locales = await listDirectories(LOCALES_DIR);
  if (!locales.includes(DEFAULT_LOCALE)) {
    reportError(`Default locale "${DEFAULT_LOCALE}" is missing from ${path.relative(ROOT_DIR, LOCALES_DIR)}.`);
  }

  const localeData = new Map();

  for (const locale of locales) {
    const messagesPath = path.join(LOCALES_DIR, locale, 'messages.json');
    const relativePath = path.relative(ROOT_DIR, messagesPath);
    let messages;
    try {
      messages = await readJson(messagesPath);
    } catch (error) {
      reportError(error.message);
      continue;
    }

    const placeholdersByKey = new Map();

    for (const [key, entry] of Object.entries(messages || {})) {
      if (!entry || typeof entry.message !== 'string') {
        reportError(`Message entry "${key}" in ${relativePath} (${locale}) is missing a string "message" field.`);
        continue;
      }

      const icuPlaceholders = collectIcuPlaceholders(entry.message, locale, key, relativePath);
      const chromePlaceholders = collectChromePlaceholders(entry, locale, key, relativePath);

      const placeholderSet = new Set();
      icuPlaceholders.forEach((name) => placeholderSet.add(name));
      for (const name of chromePlaceholders.keys()) {
        placeholderSet.add(name);
      }

      placeholdersByKey.set(key, {
        icuPlaceholders,
        chromePlaceholders,
        allPlaceholders: placeholderSet,
      });
    }

    localeData.set(locale, {
      messagesPath,
      placeholdersByKey,
    });
  }

  return localeData;
}

async function walkFiles(dirPath, visitor) {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      await walkFiles(path.join(dirPath, entry.name), visitor);
    } else if (entry.isFile()) {
      await visitor(path.join(dirPath, entry.name));
    }
  }
}

function computeLineAndColumn(content, index) {
  const substring = content.slice(0, index);
  const lines = substring.split('\n');
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column };
}

function addUsage(usageByKey, key, usage) {
  if (!usageByKey.has(key)) {
    usageByKey.set(key, []);
  }
  usageByKey.get(key).push(usage);
}

function collectHtmlUsage(filePath, content, usageByKey) {
  const relativePath = path.relative(ROOT_DIR, filePath);
  const dataI18nRegex = /data-i18n=(?:"([^"]+)"|'([^']+)')/g;
  const dataAttrRegex = /data-i18n-attr=(?:"([^"]+)"|'([^']+)')/g;

  let match;
  while ((match = dataI18nRegex.exec(content))) {
    const key = match[1] || match[2];
    if (!key) {
      continue;
    }
    const location = computeLineAndColumn(content, match.index);
    addUsage(usageByKey, key, {
      type: 'none',
      source: relativePath,
      location,
      description: 'data-i18n attribute',
    });
  }

  while ((match = dataAttrRegex.exec(content))) {
    const raw = match[1] || match[2];
    if (!raw) {
      continue;
    }
    const location = computeLineAndColumn(content, match.index);
    raw.split(',').forEach((segment) => {
      const trimmed = segment.trim();
      if (!trimmed) {
        return;
      }
      const parts = trimmed.split(':');
      const key = parts[1] && parts[1].trim();
      if (!key) {
        return;
      }
      addUsage(usageByKey, key, {
        type: 'none',
        source: relativePath,
        location,
        description: 'data-i18n-attr reference',
      });
    });
  }
}

function parseSource(content, filePath) {
  try {
    return babelParse(content, {
      sourceType: 'module',
      sourceFilename: filePath,
      plugins: [
        'jsx',
        'classProperties',
        'dynamicImport',
        'optionalChaining',
        'nullishCoalescingOperator',
        'objectRestSpread',
        'topLevelAwait',
      ],
      errorRecovery: true,
      ranges: false,
      tokens: false,
    });
  } catch (error) {
    reportError(`Failed to parse ${path.relative(ROOT_DIR, filePath)}: ${error.message}`);
    return null;
  }
}

function isStringLiteral(node) {
  return (
    node &&
    ((node.type === 'StringLiteral' && typeof node.value === 'string') ||
      (node.type === 'Literal' && typeof node.value === 'string'))
  );
}

function extractString(node) {
  if (!node) {
    return null;
  }
  if (isStringLiteral(node)) {
    return node.value;
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  return null;
}

function collectCallExpressionUsage(node, relativePath, usageByKey) {
  if (node.type !== 'CallExpression') {
    return;
  }

  let calleeName = null;
  if (node.callee.type === 'Identifier') {
    calleeName = node.callee.name;
  } else if (
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.type === 'Identifier'
  ) {
    calleeName = node.callee.property.name;
  }

  if (calleeName !== 'getMessage') {
    return;
  }

  const [keyNode, substitutionsNode] = node.arguments;
  const key = extractString(keyNode);
  if (!key) {
    return;
  }

  const location = node.loc
    ? { line: node.loc.start.line, column: node.loc.start.column + 1 }
    : { line: null, column: null };

  if (!substitutionsNode) {
    addUsage(usageByKey, key, {
      type: 'none',
      source: relativePath,
      location,
      description: 'getMessage call without substitutions',
    });
    return;
  }

  if (substitutionsNode.type === 'ArrayExpression') {
    const hasSpread = substitutionsNode.elements.some((element) => element && element.type === 'SpreadElement');
    if (hasSpread) {
      addUsage(usageByKey, key, {
        type: 'unknown',
        source: relativePath,
        location,
        description: 'getMessage call with spread substitutions',
      });
      return;
    }
    const count = substitutionsNode.elements.filter(Boolean).length;
    addUsage(usageByKey, key, {
      type: 'array',
      placeholderCount: count,
      source: relativePath,
      location,
      description: 'getMessage call with positional substitutions',
    });
    return;
  }

  if (substitutionsNode.type === 'ObjectExpression') {
    const placeholderNames = new Set();
    let unsupported = false;
    for (const prop of substitutionsNode.properties) {
      if (prop.type !== 'ObjectProperty') {
        unsupported = true;
        break;
      }
      if (prop.computed) {
        unsupported = true;
        break;
      }
      if (prop.key.type === 'Identifier') {
        placeholderNames.add(prop.key.name);
      } else if (prop.key.type === 'StringLiteral' || prop.key.type === 'Literal') {
        placeholderNames.add(String(prop.key.value));
      } else {
        unsupported = true;
        break;
      }
    }

    addUsage(usageByKey, key, {
      type: unsupported ? 'unknown' : 'object',
      placeholderNames,
      source: relativePath,
      location,
      description: unsupported
        ? 'getMessage call with unsupported placeholder keys'
        : 'getMessage call with named substitutions',
    });
    return;
  }

  addUsage(usageByKey, key, {
    type: 'unknown',
    source: relativePath,
    location,
    description: `getMessage call with unsupported substitutions node type "${substitutionsNode.type}"`,
  });
}

function traverseAst(node, visitor) {
  if (!node || typeof node.type !== 'string') {
    return;
  }
  visitor(node);
  for (const value of Object.values(node)) {
    if (!value) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        traverseAst(child, visitor);
      }
    } else if (value && typeof value.type === 'string') {
      traverseAst(value, visitor);
    }
  }
}

async function collectSourceUsage() {
  const usageByKey = new Map();

  for (const dir of SOURCE_DIRS) {
    await walkFiles(dir, async (filePath) => {
      const ext = path.extname(filePath);
      if (JS_EXTENSIONS.has(ext)) {
        const content = await fs.readFile(filePath, 'utf8');
        const ast = parseSource(content, filePath);
        if (!ast) {
          return;
        }
        const relativePath = path.relative(ROOT_DIR, filePath);
        traverseAst(ast.program || ast, (node) => {
          collectCallExpressionUsage(node, relativePath, usageByKey);
        });
      } else if (HTML_EXTENSIONS.has(ext)) {
        const content = await fs.readFile(filePath, 'utf8');
        collectHtmlUsage(filePath, content, usageByKey);
      }
    });
  }

  return usageByKey;
}

function mergeUsageEntries(key, entries) {
  let mergedType = null;
  let placeholderCount = null;
  let placeholderNames = null;
  let hasUnknown = false;

  for (const entry of entries) {
    if (entry.type === 'unknown') {
      hasUnknown = true;
      continue;
    }

    if (!mergedType) {
      mergedType = entry.type;
      if (entry.type === 'array') {
        placeholderCount = entry.placeholderCount;
      } else if (entry.type === 'object') {
        placeholderNames = new Set(entry.placeholderNames);
      }
      continue;
    }

    if (mergedType !== entry.type) {
      reportError(
        `Inconsistent placeholder usage for key "${key}" between sources: expected "${mergedType}" but found "${entry.type}".`,
      );
      return {
        type: 'unknown',
        entries,
      };
    }

    if (mergedType === 'array' && placeholderCount !== entry.placeholderCount) {
      reportError(
        `Inconsistent positional placeholder count for key "${key}" between sources (${placeholderCount} vs ${entry.placeholderCount}).`,
      );
    }

    if (mergedType === 'object') {
      const expected = placeholderNames || new Set();
      const candidate = new Set(entry.placeholderNames || []);
      const missing = [...expected].filter((name) => !candidate.has(name));
      const extra = [...candidate].filter((name) => !expected.has(name));
      if (missing.length || extra.length) {
        reportError(
          `Inconsistent named placeholders for key "${key}" between sources (missing: ${missing.join(', ') || 'none'}, extra: ${extra.join(', ') || 'none'}).`,
        );
      }
    }
  }

  if (!mergedType) {
    return {
      type: hasUnknown ? 'unknown' : 'none',
      entries,
    };
  }

  return {
    type: mergedType,
    placeholderCount,
    placeholderNames,
    entries,
  };
}

function ensureLocalePlaceholdersMatchDefault(localeData) {
  if (!localeData.has(DEFAULT_LOCALE)) {
    return;
  }
  const defaultData = localeData.get(DEFAULT_LOCALE);
  const defaultPlaceholders = defaultData.placeholdersByKey;

  for (const [locale, data] of localeData.entries()) {
    if (locale === DEFAULT_LOCALE) {
      continue;
    }
    for (const [key, defaultEntry] of defaultPlaceholders.entries()) {
      const localeEntry = data.placeholdersByKey.get(key);
      if (!localeEntry) {
        reportError(
          `Key "${key}" is missing from locale ${locale} (${path.relative(ROOT_DIR, data.messagesPath)}).`,
        );
        continue;
      }
      const defaultSet = defaultEntry.allPlaceholders;
      const localeSet = localeEntry.allPlaceholders;
      const missing = [...defaultSet].filter((name) => !localeSet.has(name));
      const extra = [...localeSet].filter((name) => !defaultSet.has(name));
      if (missing.length || extra.length) {
        reportError(
          `Placeholder mismatch for key "${key}" between ${DEFAULT_LOCALE} and ${locale}: missing [${missing.join(', ') || 'none'}], extra [${extra.join(', ') || 'none'}].`,
        );
      }
    }
  }
}

function validateUsageAgainstLocales(usageByKey, localeData) {
  for (const [key, entries] of usageByKey.entries()) {
    const usage = mergeUsageEntries(key, entries);
    if (usage.type === 'unknown') {
      continue;
    }

    for (const [locale, data] of localeData.entries()) {
      const placeholdersEntry = data.placeholdersByKey.get(key);
      if (!placeholdersEntry) {
        reportError(
          `Locale ${locale} (${path.relative(ROOT_DIR, data.messagesPath)}) is missing key "${key}" required by source usage.`,
        );
        continue;
      }

      const placeholderCount = placeholdersEntry.allPlaceholders.size;

      if (usage.type === 'none' && placeholderCount > 0) {
        reportError(
          `Key "${key}" in locale ${locale} unexpectedly defines placeholders (${[...placeholdersEntry.allPlaceholders].join(', ')}), but source usage does not provide substitutions.`,
        );
      } else if (usage.type === 'array') {
        if (placeholdersEntry.chromePlaceholders.size !== placeholderCount) {
          // Already counted, but ensure we compare using count from chrome placeholders when available.
        }
        if (placeholderCount !== usage.placeholderCount) {
          reportError(
            `Key "${key}" in locale ${locale} expects ${placeholderCount} placeholders but source provides ${usage.placeholderCount}.`,
          );
        }
      } else if (usage.type === 'object') {
        const placeholders = placeholdersEntry.allPlaceholders;
        const missing = [...usage.placeholderNames].filter((name) => !placeholders.has(name));
        const extra = [...placeholders].filter((name) => !usage.placeholderNames.has(name));
        if (missing.length || extra.length) {
          reportError(
            `Key "${key}" in locale ${locale} has placeholder mismatch with source usage (missing: ${missing.join(', ') || 'none'}, extra: ${extra.join(', ') || 'none'}).`,
          );
        }
      }
    }
  }
}

async function main() {
  const localeData = await loadLocaleData();
  const usageByKey = await collectSourceUsage();

  ensureLocalePlaceholdersMatchDefault(localeData);
  validateUsageAgainstLocales(usageByKey, localeData);

  if (errors.length > 0) {
    console.error('Locale placeholder validation failed:');
    for (const message of errors) {
      console.error(` - ${message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Locale placeholder validation passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
