import { createBrowserCapture } from "./audio/browserCapture";
import { createNativeCapture, isTauriRuntime } from "./audio/tauriCapture";
import { getUiElements, setStatus, syncControlReadouts, syncModeControls } from "./dom";
import { PerformanceMeter } from "./metrics";
import { getAnalyzerValues, getNativeValues, updateLevelReadout } from "./spectrum";
import { VisualizerRenderer } from "./visualizer/renderer";

const ui = getUiElements();
const metrics = new PerformanceMeter(ui.performanceReadout);
const renderer = new VisualizerRenderer(ui);

const browserCapture = createBrowserCapture(() => resetToIdle("Audio capture ended."));
const nativeCapture = createNativeCapture((spectrum) => {
  metrics.registerAudioFrame();
  ui.levelReadout.textContent = `${String(spectrum.level).padStart(2, "0")}%`;
});

let animationFrame = 0;

function resetToIdle(message = "Ready to capture audio."): void {
  browserCapture.stop();
  nativeCapture.clear();
  renderer.resetModeState();
  ui.trackTitle.textContent = "Audio Input";
  setStatus(ui, message);
  ui.levelReadout.textContent = "IDLE";
  ui.performanceReadout.textContent = "VIS -- / AUD --";
}

async function startNativeCapture(): Promise<void> {
  setStatus(ui, "Starting Linux system audio capture.");

  try {
    await nativeCapture.start();
    ui.trackTitle.textContent = "System Audio";
    setStatus(ui, "Listening to the default output device.");
  } catch (error) {
    setStatus(ui, String(error));
  }
}

async function startBrowserCapture(): Promise<void> {
  setStatus(ui, "Choose a screen, window, or tab and enable audio sharing.");

  try {
    await browserCapture.start();
    ui.trackTitle.textContent = "Shared Audio";
    setStatus(ui, "Listening to shared audio.");
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "NotAllowedError"
        ? "Audio capture was cancelled."
        : error instanceof Error
          ? error.message
          : "Audio capture failed.";
    resetToIdle(message);
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
  metrics.update(now);

  if (nativeCapture.spectrum) {
    renderer.drawActive(getNativeValues(ui, nativeCapture.spectrum));
  } else if (browserCapture.audioContext && browserCapture.analyser && browserCapture.frequencyData && browserCapture.timeData) {
    metrics.registerAudioFrame();
    updateLevelReadout(browserCapture.analyser, browserCapture.timeData, ui.levelReadout);
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
