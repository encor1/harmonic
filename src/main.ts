import { createBrowserCapture } from "./audio/browserCapture";
import { createNativeCapture, isTauriRuntime } from "./audio/tauriCapture";
import { getUiElements, syncControlReadouts, syncModeControls } from "./dom";
import { getAnalyzerValues, getNativeValues } from "./spectrum";
import { VisualizerRenderer } from "./visualizer/renderer";

const ui = getUiElements();
const renderer = new VisualizerRenderer(ui);

const browserCapture = createBrowserCapture(() => resetToIdle());
const nativeCapture = createNativeCapture(() => undefined);

let animationFrame = 0;

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
ui.falloffControl.addEventListener("input", () => syncControlReadouts(ui));
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
ui.paletteControl.addEventListener("change", () => renderer.resetModeState());
window.addEventListener("resize", () => renderer.resizeCanvas());
window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(animationFrame);
  browserCapture.close();
  void nativeCapture.stop();
});

resetToIdle();
syncControlReadouts(ui);
syncModeControls(ui);
render();
void startCapture();
