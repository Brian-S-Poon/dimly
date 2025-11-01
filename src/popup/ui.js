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

  function bindEvents({ onLevelInput, onLevelChange, onToggleClick, onSiteToggleClick }) {
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
  }

  global.ScreenDimmerPopupUI = {
    updateLevel,
    updateGlobal,
    renderSite,
    setSiteToggleDisabled,
    bindEvents
  };
})(typeof window !== 'undefined' ? window : this);
