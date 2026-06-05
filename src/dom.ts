import type { PaletteName, VisualizerMode } from "./types";

function requireElement<T extends HTMLElement>(id: string, constructor: new () => T): T {
  const element = document.getElementById(id);

  if (!(element instanceof constructor)) {
    throw new Error(`Missing #${id}`);
  }

  return element;
}

export interface UiElements {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  statusTextInline: HTMLElement;
  levelReadout: HTMLOutputElement;
  performanceReadout: HTMLOutputElement;
  trackTitle: HTMLHeadingElement;
  gainControl: HTMLInputElement;
  falloffControl: HTMLInputElement;
  barsControl: HTMLInputElement;
  modeControl: HTMLSelectElement;
  modeButtons: HTMLButtonElement[];
  paletteControl: HTMLSelectElement;
}

export function getUiElements(): UiElements {
  const canvas = requireElement("visualizer", HTMLCanvasElement);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas 2D context is unavailable");
  }

  return {
    canvas,
    ctx,
    statusTextInline: requireElement("statusTextInline", HTMLElement),
    levelReadout: requireElement("levelReadout", HTMLOutputElement),
    performanceReadout: requireElement("performanceReadout", HTMLOutputElement),
    trackTitle: requireElement("trackTitle", HTMLHeadingElement),
    gainControl: requireElement("gain", HTMLInputElement),
    falloffControl: requireElement("falloff", HTMLInputElement),
    barsControl: requireElement("bars", HTMLInputElement),
    modeControl: requireElement("mode", HTMLSelectElement),
    modeButtons: Array.from(document.querySelectorAll<HTMLButtonElement>("[data-mode]")),
    paletteControl: requireElement("palette", HTMLSelectElement),
  };
}

export function getGain(ui: UiElements): number {
  return Number(ui.gainControl.value);
}

export function getFalloff(ui: UiElements): number {
  return Number(ui.falloffControl.value);
}

export function getBars(ui: UiElements): number {
  return Number(ui.barsControl.value);
}

export function getMode(ui: UiElements): VisualizerMode {
  return ui.modeControl.value as VisualizerMode;
}

export function getPaletteName(ui: UiElements): PaletteName {
  return ui.paletteControl.value as PaletteName;
}

export function setStatus(ui: UiElements, message: string): void {
  ui.statusTextInline.textContent = message;
}

export function syncModeControls(ui: UiElements): void {
  ui.modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === ui.modeControl.value;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}
