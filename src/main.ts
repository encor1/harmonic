import { createBrowserCapture } from "./audio/browserCapture";
import { createNativeCapture, isTauriRuntime } from "./audio/tauriCapture";
import { getUiElements, setupUpwardSelects, syncControlReadouts, syncModeControls, syncPalettePreview } from "./dom";
import { getAnalyzerValues, getNativeValues } from "./spectrum";
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
let controlsFocused = false;

function syncControlsChrome(): void {
  const inertControls = ui.controlsPanel as HTMLElement & { inert: boolean };

  ui.shell.classList.toggle("controls-visible", controlsVisible);
  ui.controlsPanel.setAttribute("aria-hidden", String(!controlsVisible));
  inertControls.inert = !controlsVisible;
}

function scheduleControlsHide(): void {
  window.clearTimeout(controlsHideTimer);

  if (controlsHovered || controlsFocused) {
    return;
  }

  controlsHideTimer = window.setTimeout(() => {
    controlsVisible = false;
    syncControlsChrome();
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
  syncModeControls(ui);
  renderer.resetModeState();
});
ui.gainControl.addEventListener("input", () => syncControlReadouts(ui));
ui.releaseControl.addEventListener("input", () => syncControlReadouts(ui));
ui.peakFalloffControl.addEventListener("input", () => syncControlReadouts(ui));
ui.barsControl.addEventListener("input", () => {
  syncControlReadouts(ui);
  renderer.resetModeState();
});
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
  controlsFocused = true;
  controlsVisible = true;
  syncControlsChrome();
  window.clearTimeout(controlsHideTimer);
});
ui.controlsPanel.addEventListener("focusout", () => {
  controlsFocused = false;
  scheduleControlsHide();
});
window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  controlsVisible = false;
  controlsHovered = false;
  controlsFocused = false;
  window.clearTimeout(controlsHideTimer);
  syncControlsChrome();
});
window.addEventListener("resize", () => renderer.resizeCanvas());
window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(animationFrame);
  window.clearTimeout(controlsHideTimer);
  browserCapture.close();
  void nativeCapture.stop();
});

resetToIdle();
syncControlReadouts(ui);
syncModeControls(ui);
syncPalettePreview(ui);
syncControlsChrome();
scheduleControlsHide();
render();
void startCapture();
