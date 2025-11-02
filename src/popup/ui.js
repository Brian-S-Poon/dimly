(function (global) {
  const { clamp01 } = global.ScreenDimmerMath;

  const slider = document.querySelector('#level');
  const pct = document.querySelector('#pct');
  const toggleBtn = document.querySelector('#toggle');
  const globalStatus = document.querySelector('#global-status');
  const globalControls = document.querySelector('.global-controls');
  const siteControls = document.querySelector('#site-controls');
  const siteHostLabel = document.querySelector('#site-host');
  const siteStatus = document.querySelector('#site-status');
  const siteToggleBtn = document.querySelector('#site-toggle');
  const siteHint = document.querySelector('#site-hint');
  const manageBtn = document.querySelector('#site-manage');
  const managerSection = document.querySelector('#site-manager');
  const managerList = document.querySelector('#site-manager-list');
  const managerEmpty = document.querySelector('#site-manager-empty');
  const managerStatus = document.querySelector('#site-manager-status');
  const managerResetBtn = document.querySelector('#site-manager-reset');
  const managerCloseBtn = document.querySelector('#site-manager-close');

  const body = document.body || document.querySelector('body');

  function updateLevel(level) {
    const val = clamp01(level);
    if (slider) slider.value = String(val);
    if (pct) pct.textContent = Math.round(val * 100) + '%';
  }

  function updateGlobal(level) {
    const val = clamp01(level);
    const isOn = val > 0;
    if (toggleBtn) {
      toggleBtn.textContent = isOn ? 'On' : 'Off';
      toggleBtn.setAttribute('aria-pressed', String(isOn));
      toggleBtn.dataset.state = isOn ? 'on' : 'off';
    }
    if (globalStatus) {
      globalStatus.textContent = isOn
        ? `Dimmer is on at ${Math.round(val * 100)}%.`
        : 'Dimmer is off.';
    }
  }

  function renderSite({ host, lockedLevel, globalLevel, message, blockedHost }) {
    if (!siteControls || !siteHostLabel || !siteStatus) return;
    siteControls.hidden = false;

    if (!host) {
      if (blockedHost) {
        siteHostLabel.hidden = false;
        siteHostLabel.textContent = `Site · ${blockedHost}`;
      } else {
        siteHostLabel.textContent = '';
        siteHostLabel.hidden = true;
      }
      siteStatus.textContent = message || RESTRICTED_PAGE_MESSAGE;
      if (siteHint) {
        siteHint.hidden = true;
        siteHint.textContent = '';
      }
      if (siteToggleBtn) {
        siteToggleBtn.hidden = true;
        siteToggleBtn.disabled = true;
        siteToggleBtn.removeAttribute('data-state');
        siteToggleBtn.removeAttribute('aria-pressed');
      }
      return;
    }

    siteHostLabel.hidden = false;
    siteHostLabel.textContent = `Site · ${host}`;

    const isLocked = typeof lockedLevel === 'number';

    if (siteToggleBtn) {
      siteToggleBtn.hidden = false;
      siteToggleBtn.textContent = isLocked ? 'Unlock site' : 'Lock site';
      siteToggleBtn.dataset.state = isLocked ? 'locked' : 'unlocked';
      siteToggleBtn.setAttribute('aria-pressed', String(isLocked));
    }

    if (message) {
      siteStatus.textContent = message;
    } else if (isLocked) {
      siteStatus.textContent = `Locked at ${Math.round(clamp01(lockedLevel) * 100)}%.`;
    } else {
      siteStatus.textContent = `Using dim level (${Math.round(clamp01(globalLevel) * 100)}%).`;
    }

    if (siteHint) {
      siteHint.hidden = true;
      siteHint.textContent = '';
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

  function updateManageSummary(levels) {
    if (!manageBtn) return;
    const entries = levels && typeof levels === 'object'
      ? Object.keys(levels).filter((key) => typeof levels[key] === 'number')
      : [];
    const count = entries.length;
    manageBtn.textContent = count ? `Manage Site Settings (${count})` : 'Manage Site Settings';
  }

  function updateManagerSliderDisplay(sliderEl) {
    if (!sliderEl) return;
    const hostItem = sliderEl.closest('.site-manager-item');
    if (!hostItem) return;
    const pillEl = hostItem.querySelector('[data-role="pct"]');
    if (!pillEl) return;
    const raw = parseFloat(sliderEl.value);
    const percent = Math.round(clamp01(Number.isFinite(raw) ? raw : 0) * 100);
    pillEl.textContent = `${percent}%`;
  }

  function renderManager(levels) {
    if (!managerList || !managerEmpty) return;
    managerList.innerHTML = '';
    const entries = Object.entries(levels || {})
      .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
      .sort(([hostA], [hostB]) => hostA.localeCompare(hostB));

    if (!entries.length) {
      managerEmpty.hidden = false;
      managerList.hidden = true;
      return;
    }

    managerEmpty.hidden = true;
    managerList.hidden = false;

    entries.forEach(([host, value], index) => {
      const item = document.createElement('li');
      item.className = 'site-manager-item';
      item.dataset.host = host;

      const header = document.createElement('div');
      header.className = 'site-manager-row-header';

      const hostLabel = document.createElement('span');
      hostLabel.className = 'site-manager-host';
      hostLabel.textContent = host;
      header.appendChild(hostLabel);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'link-button site-manager-delete';
      removeBtn.dataset.action = 'delete';
      removeBtn.dataset.host = host;
      removeBtn.textContent = 'Remove';
      header.appendChild(removeBtn);

      const sliderGroupEl = document.createElement('div');
      sliderGroupEl.className = 'slider-group compact site-manager-slider';

      const meta = document.createElement('div');
      meta.className = 'slider-meta';

      const sliderId = `site-manager-${index}`;
      const label = document.createElement('label');
      label.setAttribute('for', sliderId);
      label.textContent = 'Dim level';
      meta.appendChild(label);

      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.dataset.role = 'pct';
      pill.textContent = `${Math.round(clamp01(value) * 100)}%`;
      meta.appendChild(pill);

      const sliderEl = document.createElement('input');
      sliderEl.type = 'range';
      sliderEl.min = '0';
      sliderEl.max = '1';
      sliderEl.step = '0.01';
      sliderEl.value = String(clamp01(value));
      sliderEl.id = sliderId;
      sliderEl.dataset.action = 'level';
      sliderEl.dataset.host = host;

      sliderGroupEl.appendChild(meta);
      sliderGroupEl.appendChild(sliderEl);

      item.appendChild(header);
      item.appendChild(sliderGroupEl);

      managerList.appendChild(item);
    });
  }

  function setManagerVisible(visible) {
    if (!body) return;
    if (visible) {
      body.classList.add('manager-open');
      if (globalControls) globalControls.hidden = true;
      if (siteControls) siteControls.hidden = true;
      if (managerSection) managerSection.hidden = false;
    } else {
      body.classList.remove('manager-open');
      if (globalControls) globalControls.hidden = false;
      if (siteControls) siteControls.hidden = false;
      if (managerSection) managerSection.hidden = true;
    }
  }

  function setManagerStatus(message) {
    if (!managerStatus) return;
    if (message) {
      managerStatus.hidden = false;
      managerStatus.textContent = message;
    } else {
      managerStatus.textContent = '';
      managerStatus.hidden = true;
    }
  }

  function focusManagerClose() {
    if (managerCloseBtn) {
      managerCloseBtn.focus();
    }
  }

  function focusManageButton() {
    if (manageBtn) {
      manageBtn.focus();
    }
  }

  function bindEvents({
    onLevelInput,
    onLevelChange,
    onToggleClick,
    onSiteToggleClick,
    onManageOpen,
    onManageClose,
    onManagerLevelChange,
    onManagerDelete,
    onManagerReset
  }) {
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
    if (manageBtn && onManageOpen) {
      manageBtn.addEventListener('click', onManageOpen);
    }
    if (managerCloseBtn && onManageClose) {
      managerCloseBtn.addEventListener('click', onManageClose);
    }
    if (managerResetBtn && onManagerReset) {
      managerResetBtn.addEventListener('click', onManagerReset);
    }
    if (managerList) {
      managerList.addEventListener('input', (event) => {
        const sliderTarget = event.target.closest('input[type="range"][data-action="level"]');
        if (!sliderTarget) return;
        updateManagerSliderDisplay(sliderTarget);
      });
      if (onManagerLevelChange) {
        managerList.addEventListener('change', (event) => {
          const sliderTarget = event.target.closest('input[type="range"][data-action="level"]');
          if (!sliderTarget) return;
          const host = sliderTarget.dataset.host;
          if (!host) return;
          const value = parseFloat(sliderTarget.value);
          onManagerLevelChange(host, clamp01(Number.isFinite(value) ? value : 0));
        });
      }
      if (onManagerDelete) {
        managerList.addEventListener('click', (event) => {
          const button = event.target.closest('button[data-action="delete"]');
          if (!button) return;
          const host = button.dataset.host;
          if (host) {
            onManagerDelete(host);
          }
        });
      }
    }
  }

  global.ScreenDimmerPopupUI = {
    updateLevel,
    updateGlobal,
    renderSite,
    setSiteToggleDisabled,
    updateManageSummary,
    renderManager,
    setManagerVisible,
    setManagerStatus,
    focusManagerClose,
    focusManageButton,
    bindEvents
  };
})(typeof window !== 'undefined' ? window : this);
