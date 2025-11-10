(function (global) {
  const FALLBACK_MESSAGES = Object.freeze({
    popupTitle: 'Dimly',
    popupOptionsAriaLabel: 'Open scheduling settings',
    popupGlobalHeading: 'All Sites',
    popupGlobalDescription: 'Choose your preferred dim level.',
    popupDimLevelLabel: 'Dim level',
    popupToggleOn: 'On',
    popupToggleOff: 'Off',
    popupSiteToggleLock: 'Lock site',
    popupSiteToggleUnlock: 'Unlock site',
    popupSiteHeading: 'This Site Only',
    popupSiteStatusDefault: 'Site controls are available on supported websites.',
    popupManageSites: 'Manage Site Settings',
    popupManagerHeading: 'Site settings',
    popupManagerBack: 'Back',
    popupManagerEmpty: 'No site settings saved yet.',
    popupManagerRemove: 'Remove',
    popupManagerReset: 'Reset all sites',
    popupGlobalStatusOn: 'Dimmer is on at $1%.',
    popupGlobalStatusOff: 'Dimmer is off.',
    popupSiteLockedStatus: 'Locked at $1%.',
    popupSiteUsingGlobalStatus: 'Using dim level ($1%).',
    popupErrorUpdateFailed: 'Update failed. Try again.',
    popupStatusUpdatedHost: 'Updated $1.',
    popupStatusRemovedHost: 'Removed $1.',
    popupStatusAllCleared: 'All site settings cleared.',
    popupStatusResetFailed: 'Reset failed. Try again.',
    popupErrorReadSettings: 'Unable to read saved settings.',
    commonPercentValue: '$1%',
    restrictedPageMessage: 'Chrome prevents extensions from running on this page.',
    restrictedSiteChromeWebStore: 'Chrome Web Store',
    optionsDocumentTitle: 'Dimly · Scheduling settings',
    optionsHeading: 'Scheduling',
    optionsIntro: 'Configure automation rules that flip between dimming levels at specific times.',
    optionsScheduleHeading: 'Schedule',
    optionsEnableScheduling: 'Enable scheduling',
    optionsAutoDescription: 'Automatically flip dimming levels based on the times you choose.',
    optionsLegendScheduling: 'Scheduling options',
    optionsFallbackLabel: 'Fallback level',
    optionsTransitionLabel: 'Transition (seconds)',
    optionsRulesTitle: 'Rules',
    optionsAddRule: 'Add rule',
    optionsErrorLoadSchedule: 'Unable to load saved schedule. Showing defaults.',
    scheduleRuleLabel: 'Rule',
    scheduleRuleCustomTime: 'Custom time',
    scheduleRulePeriodAM: 'AM',
    scheduleRulePeriodPM: 'PM',
    scheduleRuleTimeFormat: '$1:$2 $3',
    scheduleRuleDefaultName: 'Rule $1',
    scheduleTimeLabel: 'Time',
    scheduleLevelLabel: 'Level',
    scheduleRemove: 'Remove',
    scheduleRulesEmpty: 'No rules yet. Add one to start scheduling.',
    scheduleMissingError: 'Schedule missing.',
    scheduleAddRuleError: 'Add at least one rule.',
    scheduleTimeInvalidError: 'Set a valid time for $1.',
    scheduleTransitionError: 'Transition must be 60 seconds or less.',
    scheduleSavedStatus: 'Schedule saved.',
    scheduleSaveFailed: 'Failed to save schedule. Try again.',
    scheduleSavingStatus: 'Saving…'
  });

  function formatMessage(template, substitutions) {
    if (!template) {
      return '';
    }
    if (!Array.isArray(substitutions) || substitutions.length === 0) {
      return template;
    }
    return substitutions.reduce((result, value, index) => {
      const placeholder = new RegExp(`\\$${index + 1}`, 'g');
      return result.replace(placeholder, String(value));
    }, template);
  }

  function getMessage(key, substitutions) {
    if (!key) {
      return '';
    }

    if (global.chrome && global.chrome.i18n && typeof global.chrome.i18n.getMessage === 'function') {
      try {
        const message = global.chrome.i18n.getMessage(key, substitutions);
        if (message) {
          return message;
        }
      } catch (error) {
        // Ignore errors and fall back to local strings.
      }
    }

    if (Object.prototype.hasOwnProperty.call(FALLBACK_MESSAGES, key)) {
      return formatMessage(FALLBACK_MESSAGES[key], substitutions);
    }

    if (Array.isArray(substitutions) && substitutions.length) {
      return formatMessage(String(key), substitutions);
    }

    return key;
  }

  function applyElementTranslations(root) {
    const doc = typeof document !== 'undefined' ? document : null;
    const context = root || doc;

    if (!context || typeof context.querySelectorAll !== 'function') {
      return;
    }

    const setText = (element) => {
      const key = element.getAttribute('data-i18n');
      if (!key) {
        return;
      }
      const message = getMessage(key);
      if (typeof message === 'string') {
        element.textContent = message;
      }
    };

    const setAttributes = (element) => {
      const attrConfig = element.getAttribute('data-i18n-attr');
      if (!attrConfig) {
        return;
      }

      attrConfig.split(',').forEach((pair) => {
        const [attr, key] = pair.split(':').map((part) => part && part.trim()).filter(Boolean);
        if (!attr || !key) {
          return;
        }
        const message = getMessage(key);
        if (typeof message === 'string') {
          element.setAttribute(attr, message);
        }
      });
    };

    context.querySelectorAll('[data-i18n]').forEach(setText);
    context.querySelectorAll('[data-i18n-attr]').forEach(setAttributes);
  }

  function bootstrapTranslations() {
    const doc = typeof document !== 'undefined' ? document : null;
    if (!doc) {
      return;
    }

    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', () => applyElementTranslations(doc), { once: true });
      return;
    }

    applyElementTranslations(doc);
  }

  bootstrapTranslations();

  global.ScreenDimmerI18n = {
    getMessage,
    applyElementTranslations
  };
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
