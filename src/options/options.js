(function (global) {
  const storage = global.ScreenDimmerStorage;
  const scheduleUI = global.ScreenDimmerSchedule;
  const i18n = global.ScreenDimmerI18n;

  const getMessage = (key) => {
    if (i18n && typeof i18n.getMessage === 'function') {
      return i18n.getMessage(key);
    }
    return key || '';
  };

  async function init() {
    if (!storage || !scheduleUI || typeof scheduleUI.init !== 'function') {
      return;
    }

    const statusEl = document.querySelector('#schedule-status');
    try {
      const schedule = await storage.getSchedule();
      scheduleUI.init(schedule || DEFAULT_SCHEDULE);
    } catch (error) {
      console.error('Failed to load scheduling settings', error);
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = getMessage('optionsErrorLoadSchedule');
        statusEl.classList.add('schedule-status-error');
      }
      scheduleUI.init(DEFAULT_SCHEDULE);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
