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
  const tintPresetSelect = document.querySelector('#tint-preset');
  const customTintGroup = document.querySelector('#custom-tint-group');
  const customTintInput = document.querySelector('#custom-tint');

  function tintToHex(tint) {
    if (!tint) return '#000000';
    const clamp = (value) => {
      const num = Number(value);
      if (!Number.isFinite(num)) return 0;
      return Math.min(255, Math.max(0, Math.round(num)));
    };
    const toHex = (value) => clamp(value).toString(16).padStart(2, '0');
    return `#${toHex(tint.r)}${toHex(tint.g)}${toHex(tint.b)}`;
  }

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

  function updateTint({ preset, customTint }) {
    if (tintPresetSelect && preset) {
      tintPresetSelect.value = preset;
    }
    if (customTintGroup) {
      customTintGroup.hidden = preset !== 'custom';
    }
    if (customTintInput && customTint) {
      customTintInput.value = tintToHex(customTint);
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

  function bindEvents({ onLevelInput, onLevelChange, onToggleClick, onSiteToggleClick, onTintPresetChange, onCustomTintInput }) {
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
    if (tintPresetSelect && onTintPresetChange) {
      tintPresetSelect.addEventListener('change', onTintPresetChange);
    }
    if (customTintInput && onCustomTintInput) {
      customTintInput.addEventListener('input', onCustomTintInput);
    }
  }

  global.ScreenDimmerPopupUI = {
    updateLevel,
    updateGlobal,
    updateTint,
    renderSite,
    setSiteToggleDisabled,
    bindEvents
  };
})(typeof window !== 'undefined' ? window : this);
