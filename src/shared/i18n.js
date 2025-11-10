(function (global) {
  const FALLBACK_MESSAGES = Object.freeze({
    popupToggleOn: 'On',
    popupToggleOff: 'Off',
    popupSiteToggleLock: 'Lock site',
    popupSiteToggleUnlock: 'Unlock site',
    popupSiteStatusDefault: 'Site controls are available on supported websites.',
    popupManageSites: 'Manage Site Settings',
    popupManagerRemove: 'Remove',
    popupDimLevelLabel: 'Dim level',
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
    restrictedPageMessage: 'Chrome prevents extensions from running on this page.',
    restrictedSiteChromeWebStore: 'Chrome Web Store',
    optionsErrorLoadSchedule: 'Unable to load saved schedule. Showing defaults.',
    scheduleRuleLabel: 'Rule',
    scheduleRuleCustomTime: 'Custom time',
    scheduleRulePeriodAM: 'AM',
    scheduleRulePeriodPM: 'PM',
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

  global.ScreenDimmerI18n = {
    getMessage
  };
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
