import { getMode, type UiElements } from "./dom";
import type { PaletteName, VisualizerMode } from "./types";

const SETTINGS_KEY = "harmonic.visualizerSettings";
const SETTINGS_VERSION = 1;

export interface ControlSettings {
  gain: number;
  release: number;
  peakFalloff: number;
  bars: number;
  palette: PaletteName;
}

export interface PersistedSettings {
  version: number;
  lastMode: VisualizerMode;
  palette?: PaletteName;
  modes: Partial<Record<VisualizerMode, ControlSettings>>;
}

export type ModeControlSettings = Partial<Record<VisualizerMode, ControlSettings>>;

export interface SettingsStore {
  load(): Promise<PersistedSettings | null>;
  save(settings: PersistedSettings): Promise<void>;
}

const DEFAULT_MODE_CONTROL_SETTINGS: ModeControlSettings = {
  bars: {
    gain: 1.45,
    release: 0.78,
    peakFalloff: 99.5,
    bars: 64,
    palette: "classic",
  },
  bloom: {
    gain: 1.45,
    release: 0.72,
    peakFalloff: 85,
    bars: 96,
    palette: "classic",
  },
  circle: {
    gain: 2.25,
    release: 0.72,
    peakFalloff: 85,
    bars: 32,
    palette: "classic",
  },
  mirror: {
    gain: 1.45,
    release: 0.72,
    peakFalloff: 85,
    bars: 72,
    palette: "classic",
  },
  nodes: {
    gain: 1.45,
    release: 0.72,
    peakFalloff: 85,
    bars: 72,
    palette: "classic",
  },
  orbit: {
    gain: 1.45,
    release: 0.72,
    peakFalloff: 85,
    bars: 76,
    palette: "classic",
  },
  wave: {
    gain: 1.45,
    release: 0.72,
    peakFalloff: 85,
    bars: 128,
    palette: "classic",
  },
};

export function createSettingsStore(): SettingsStore {
  const invoke = window.__TAURI__?.core?.invoke;

  if (invoke) {
    return {
      load: () => invoke<PersistedSettings | null>("load_visualizer_settings"),
      save: (settings) => invoke<void>("save_visualizer_settings", { settings }),
    };
  }

  return {
    load: async () => {
      const rawSettings = window.localStorage.getItem(SETTINGS_KEY);

      if (!rawSettings) {
        return null;
      }

      return JSON.parse(rawSettings) as PersistedSettings;
    },
    save: async (settings) => {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    },
  };
}

export function createDefaultControlSettings(ui: UiElements): ControlSettings {
  return {
    gain: numberFromDefault(ui.gainControl),
    release: numberFromDefault(ui.releaseControl),
    peakFalloff: numberFromDefault(ui.peakFalloffControl),
    bars: numberFromDefault(ui.barsControl),
    palette: paletteFromDefault(ui),
  };
}

export function createDefaultModeSettings(ui: UiElements): ModeControlSettings {
  const fallbackDefaults = createDefaultControlSettings(ui);
  const defaults: ModeControlSettings = {};

  for (const mode of getModeValues(ui)) {
    defaults[mode] = sanitizeControlSettings(
      DEFAULT_MODE_CONTROL_SETTINGS[mode] || fallbackDefaults,
      fallbackDefaults,
      ui,
    );
  }

  return defaults;
}

export function collectControlSettings(ui: UiElements, defaults: ControlSettings): ControlSettings {
  return sanitizeControlSettings(
    {
      gain: Number(ui.gainControl.value),
      release: Number(ui.releaseControl.value),
      peakFalloff: Number(ui.peakFalloffControl.value),
      bars: Number(ui.barsControl.value),
      palette: ui.paletteControl.value as PaletteName,
    },
    defaults,
    ui,
  );
}

export function applyControlSettings(ui: UiElements, settings: ControlSettings): void {
  ui.gainControl.value = String(settings.gain);
  ui.releaseControl.value = String(settings.release);
  ui.peakFalloffControl.value = String(settings.peakFalloff);
  ui.barsControl.value = String(settings.bars);
  ui.paletteControl.value = settings.palette;
}

export function createInitialSettings(ui: UiElements): PersistedSettings {
  const modes = createDefaultModeSettings(ui);
  const lastMode = getMode(ui);

  return {
    version: SETTINGS_VERSION,
    lastMode,
    palette: getDefaultSettingsForMode(modes, lastMode).palette,
    modes,
  };
}

export function normalizePersistedSettings(
  ui: UiElements,
  settings: PersistedSettings | null,
  defaults: ModeControlSettings,
): PersistedSettings {
  const fallback = createInitialSettings(ui);

  if (!settings || settings.version !== SETTINGS_VERSION) {
    return fallback;
  }

  const lastMode = isValidMode(ui, settings.lastMode) ? settings.lastMode : fallback.lastMode;
  const palette = resolveGlobalPalette(ui, settings, lastMode, fallback.palette || paletteFromDefault(ui));
  const modes: Partial<Record<VisualizerMode, ControlSettings>> = {};

  for (const mode of getModeValues(ui)) {
    const modeSettings = settings.modes?.[mode];
    const modeDefaults = {
      ...getDefaultSettingsForMode(defaults, mode),
      palette,
    };

    if (modeSettings) {
      modes[mode] = {
        ...sanitizeControlSettings(modeSettings, modeDefaults, ui),
        palette,
      };
    } else {
      modes[mode] = modeDefaults;
    }
  }

  return {
    version: SETTINGS_VERSION,
    lastMode,
    palette,
    modes,
  };
}

export function getSettingsForMode(
  settings: PersistedSettings,
  mode: VisualizerMode,
  defaults: ModeControlSettings,
): ControlSettings {
  return {
    ...(settings.modes[mode] || getDefaultSettingsForMode(defaults, mode)),
    palette: getGlobalPalette(settings, defaults, mode),
  };
}

export function resetModeToDefaults(
  settings: PersistedSettings,
  mode: VisualizerMode,
  defaults: ModeControlSettings,
): PersistedSettings {
  return {
    ...settings,
    lastMode: mode,
    modes: {
      ...settings.modes,
      [mode]: {
        ...getDefaultSettingsForMode(defaults, mode),
        palette: getGlobalPalette(settings, defaults, mode),
      },
    },
  };
}

export function setGlobalPalette(
  settings: PersistedSettings,
  palette: PaletteName,
): PersistedSettings {
  const modes: Partial<Record<VisualizerMode, ControlSettings>> = {};

  for (const [mode, modeSettings] of Object.entries(settings.modes) as Array<[VisualizerMode, ControlSettings]>) {
    modes[mode] = {
      ...modeSettings,
      palette,
    };
  }

  return {
    ...settings,
    palette,
    modes,
  };
}

function resolveGlobalPalette(
  ui: UiElements,
  settings: PersistedSettings,
  lastMode: VisualizerMode,
  fallback: PaletteName,
): PaletteName {
  if (settings.palette && isValidPalette(ui, settings.palette)) {
    return settings.palette;
  }

  const activeModePalette = settings.modes?.[lastMode]?.palette;

  if (activeModePalette && isValidPalette(ui, activeModePalette)) {
    return activeModePalette;
  }

  return fallback;
}

function getGlobalPalette(
  settings: PersistedSettings,
  defaults: ModeControlSettings,
  mode: VisualizerMode,
): PaletteName {
  return settings.palette || settings.modes[mode]?.palette || getDefaultSettingsForMode(defaults, mode).palette;
}

function getDefaultSettingsForMode(
  defaults: ModeControlSettings,
  mode: VisualizerMode,
): ControlSettings {
  return defaults[mode] || {
    gain: 1,
    release: 0.86,
    peakFalloff: 86,
    bars: 72,
    palette: "classic",
  };
}

function sanitizeControlSettings(
  settings: ControlSettings,
  defaults: ControlSettings,
  ui: UiElements,
): ControlSettings {
  return {
    gain: numberInRange(settings.gain, ui.gainControl, defaults.gain),
    release: numberInRange(settings.release, ui.releaseControl, defaults.release),
    peakFalloff: numberInRange(settings.peakFalloff, ui.peakFalloffControl, defaults.peakFalloff),
    bars: numberInRange(settings.bars, ui.barsControl, defaults.bars),
    palette: isValidPalette(ui, settings.palette) ? settings.palette : defaults.palette,
  };
}

function numberFromDefault(input: HTMLInputElement): number {
  return Number(input.defaultValue || input.value);
}

function numberInRange(value: number, input: HTMLInputElement, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const min = Number(input.min);
  const max = Number(input.max);

  return Math.min(max, Math.max(min, value));
}

function paletteFromDefault(ui: UiElements): PaletteName {
  const defaultOption = Array.from(ui.paletteControl.options).find((option) => option.defaultSelected);
  return (defaultOption?.value || ui.paletteControl.value) as PaletteName;
}

function isValidPalette(ui: UiElements, palette: string): palette is PaletteName {
  return Array.from(ui.paletteControl.options).some((option) => option.value === palette);
}

function isValidMode(ui: UiElements, mode: string): mode is VisualizerMode {
  return getModeValues(ui).includes(mode as VisualizerMode);
}

function getModeValues(ui: UiElements): VisualizerMode[] {
  return Array.from(ui.modeControl.options).map((option) => option.value as VisualizerMode);
}
