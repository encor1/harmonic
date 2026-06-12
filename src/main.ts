import { createBrowserCapture } from "./audio/browserCapture";
import { createNativeCapture, isTauriRuntime } from "./audio/tauriCapture";
import { getUiElements, setupUpwardSelects, syncControlReadouts, syncModeControls, syncPalettePreview, syncUpwardSelects } from "./dom";
import { applyControlSettings, collectControlSettings, createDefaultControlSettings, createInitialSettings, createSettingsStore, getSettingsForMode, normalizePersistedSettings, resetModeToDefaults, type PersistedSettings } from "./settings";
import { getAnalyzerValues, getNativeValues } from "./spectrum";
import type { VisualizerMode } from "./types";
import { VisualizerRenderer } from "./visualizer/renderer";

const ui = getUiElements();
const renderer = new VisualizerRenderer(ui);
setupUpwardSelects([ui.modeControl, ui.paletteControl]);

const browserCapture = createBrowserCapture(() => resetToIdle());
const nativeCapture = createNativeCapture(() => undefined);

let animationFrame = 0;
let controlsHideTimer = 0;
let controlsVisible = true;
let controlsHovered = false;
const settingsStore = createSettingsStore();
const defaultControlSettings = createDefaultControlSettings(ui);
let persistedSettings: PersistedSettings = createInitialSettings(ui);
let activeMode: VisualizerMode = ui.modeControl.value as VisualizerMode;
let settingsSaveTimer = 0;

function syncControlsChrome(): void {
  const inertControls = ui.controlsPanel as HTMLElement & { inert: boolean };

  ui.shell.classList.toggle("controls-visible", controlsVisible);
  ui.controlsPanel.setAttribute("aria-hidden", String(!controlsVisible));
  inertControls.inert = !controlsVisible;
}

function hideControls(): void {
  const activeElement = document.activeElement;

  if (activeElement instanceof HTMLElement && ui.controlsPanel.contains(activeElement)) {
    activeElement.blur();
  }

  controlsVisible = false;
  syncControlsChrome();
}

function scheduleControlsHide(): void {
  window.clearTimeout(controlsHideTimer);

  if (controlsHovered) {
    return;
  }

  controlsHideTimer = window.setTimeout(() => {
    hideControls();
  }, 700);
}

function revealControlsTemporarily(): void {
  controlsVisible = true;
  syncControlsChrome();
  scheduleControlsHide();
}

function resetToIdle(): void {
  browserCapture.stop();
  nativeCapture.clear();
  renderer.resetModeState();
}

async function loadSettings(): Promise<void> {
  try {
    persistedSettings = normalizePersistedSettings(ui, await settingsStore.load(), defaultControlSettings);
  } catch (error) {
    console.error(error);
    persistedSettings = createInitialSettings(ui);
  }

  ui.modeControl.value = persistedSettings.lastMode;
  activeMode = persistedSettings.lastMode;
  applyControlSettings(ui, getSettingsForMode(persistedSettings, activeMode, defaultControlSettings));
}

function syncSettingsBackedUi(): void {
  syncControlReadouts(ui);
  syncModeControls(ui);
  syncPalettePreview(ui);
  syncUpwardSelects([ui.modeControl, ui.paletteControl]);
}

function updatePersistedMode(mode: VisualizerMode): void {
  persistedSettings = {
    ...persistedSettings,
    lastMode: mode,
    modes: {
      ...persistedSettings.modes,
      [mode]: collectControlSettings(ui, defaultControlSettings),
    },
  };
}

async function saveSettings(): Promise<void> {
  try {
    await settingsStore.save(persistedSettings);
  } catch (error) {
    console.error(error);
  }
}

function queueSettingsSave(): void {
  window.clearTimeout(settingsSaveTimer);
  settingsSaveTimer = window.setTimeout(() => {
    void saveSettings();
  }, 180);
}

function saveCurrentModeSoon(): void {
  updatePersistedMode(activeMode);
  queueSettingsSave();
}

function saveCurrentModeNow(): void {
  window.clearTimeout(settingsSaveTimer);
  updatePersistedMode(activeMode);
  void saveSettings();
}

async function startNativeCapture(): Promise<void> {
  try {
    await nativeCapture.start();
  } catch (error) {
    console.error(error);
  }
}

async function startBrowserCapture(): Promise<void> {
  try {
    await browserCapture.start();
  } catch (error) {
    console.error(error);
    resetToIdle();
  }
}

async function startCapture(): Promise<void> {
  if (isTauriRuntime()) {
    await startNativeCapture();
    return;
  }

  await startBrowserCapture();
}

function render(now = performance.now()): void {
  renderer.beginFrame(now);

  if (nativeCapture.spectrum) {
    renderer.drawActive(getNativeValues(ui, nativeCapture.spectrum));
  } else if (browserCapture.audioContext && browserCapture.analyser && browserCapture.frequencyData) {
    renderer.drawActive(getAnalyzerValues(ui, browserCapture.audioContext, browserCapture.analyser, browserCapture.frequencyData));
  } else {
    renderer.drawIdle();
  }

  animationFrame = requestAnimationFrame(render);
}

ui.modeControl.addEventListener("change", () => {
  const nextMode = ui.modeControl.value as VisualizerMode;

  updatePersistedMode(activeMode);
  activeMode = nextMode;
  persistedSettings = {
    ...persistedSettings,
    lastMode: nextMode,
  };
  applyControlSettings(ui, getSettingsForMode(persistedSettings, nextMode, defaultControlSettings));
  syncSettingsBackedUi();
  void saveSettings();
  renderer.resetModeState();
});
ui.gainControl.addEventListener("input", () => {
  syncControlReadouts(ui);
  saveCurrentModeSoon();
});
ui.gainControl.addEventListener("change", saveCurrentModeNow);
ui.releaseControl.addEventListener("input", () => {
  syncControlReadouts(ui);
  saveCurrentModeSoon();
});
ui.releaseControl.addEventListener("change", saveCurrentModeNow);
ui.peakFalloffControl.addEventListener("input", () => {
  syncControlReadouts(ui);
  saveCurrentModeSoon();
});
ui.peakFalloffControl.addEventListener("change", saveCurrentModeNow);
ui.barsControl.addEventListener("input", () => {
  syncControlReadouts(ui);
  saveCurrentModeSoon();
  renderer.resetModeState();
});
ui.barsControl.addEventListener("change", saveCurrentModeNow);
ui.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.mode) {
      ui.modeControl.value = button.dataset.mode;
      ui.modeControl.dispatchEvent(new Event("change"));
    }
  });
});
ui.paletteControl.addEventListener("change", () => {
  syncPalettePreview(ui);
  saveCurrentModeNow();
  renderer.resetModeState();
});
ui.resetModeButton.addEventListener("click", () => {
  persistedSettings = resetModeToDefaults(persistedSettings, activeMode, defaultControlSettings);
  applyControlSettings(ui, defaultControlSettings);
  syncSettingsBackedUi();
  void saveSettings();
  renderer.resetModeState();
});
window.addEventListener("pointermove", revealControlsTemporarily);
window.addEventListener("mousemove", revealControlsTemporarily);
window.addEventListener("pointerdown", revealControlsTemporarily);
ui.controlsPanel.addEventListener("pointerenter", () => {
  controlsHovered = true;
  controlsVisible = true;
  syncControlsChrome();
  window.clearTimeout(controlsHideTimer);
});
ui.controlsPanel.addEventListener("pointerleave", () => {
  controlsHovered = false;
  scheduleControlsHide();
});
ui.controlsPanel.addEventListener("focusin", () => {
  controlsVisible = true;
  syncControlsChrome();
  scheduleControlsHide();
});
ui.controlsPanel.addEventListener("focusout", () => {
  scheduleControlsHide();
});
window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  controlsVisible = false;
  controlsHovered = false;
  window.clearTimeout(controlsHideTimer);
  syncControlsChrome();
});
window.addEventListener("resize", () => renderer.resizeCanvas());
window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(animationFrame);
  window.clearTimeout(controlsHideTimer);
  window.clearTimeout(settingsSaveTimer);
  updatePersistedMode(activeMode);
  void saveSettings();
  browserCapture.close();
  void nativeCapture.stop();
});

async function initialize(): Promise<void> {
  await loadSettings();
  resetToIdle();
  syncSettingsBackedUi();
  syncControlsChrome();
  scheduleControlsHide();
  render();
  void startCapture();
}

void initialize();
