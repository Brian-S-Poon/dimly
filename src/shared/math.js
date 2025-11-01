(function (global) {
  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value || 0)));
  }

  global.ScreenDimmerMath = Object.freeze({
    clamp01
  });
})(typeof window !== 'undefined' ? window : this);
