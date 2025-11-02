const DEFAULT_LEVEL = 0.25;
const GLOBAL_KEY = 'screendimmer_global_level';
const SITE_KEY = 'screendimmer_site_levels';

const TINT_PRESET_KEY = 'screendimmer_tint_preset';
const CUSTOM_TINT_KEY = 'screendimmer_custom_tint';

const DEFAULT_TINT_PRESET = 'neutral';
const DEFAULT_CUSTOM_TINT = Object.freeze({ r: 0, g: 0, b: 0, a: 1 });

const TINT_PRESETS = Object.freeze({
  neutral: Object.freeze({ r: 0, g: 0, b: 0 }),
  warm: Object.freeze({ r: 255, g: 160, b: 92 }),
  amber: Object.freeze({ r: 255, g: 196, b: 0 }),
  dusk: Object.freeze({ r: 96, g: 120, b: 255 })
});

