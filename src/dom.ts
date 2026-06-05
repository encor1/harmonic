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
  gainControl: HTMLInputElement;
  gainValue: HTMLOutputElement;
  falloffControl: HTMLInputElement;
  falloffValue: HTMLOutputElement;
  barsControl: HTMLInputElement;
  barsValue: HTMLOutputElement;
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
    gainControl: requireElement("gain", HTMLInputElement),
    gainValue: requireElement("gainValue", HTMLOutputElement),
    falloffControl: requireElement("falloff", HTMLInputElement),
    falloffValue: requireElement("falloffValue", HTMLOutputElement),
    barsControl: requireElement("bars", HTMLInputElement),
    barsValue: requireElement("barsValue", HTMLOutputElement),
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

export function syncControlReadouts(ui: UiElements): void {
  ui.gainValue.textContent = `${Number(ui.gainControl.value).toFixed(2)}x`;
  ui.falloffValue.textContent = Number(ui.falloffControl.value).toFixed(2);
  ui.barsValue.textContent = ui.barsControl.value;
  syncRangeFill(ui.gainControl);
  syncRangeFill(ui.falloffControl);
  syncRangeFill(ui.barsControl);
}

export function syncModeControls(ui: UiElements): void {
  ui.modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === ui.modeControl.value;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function syncRangeFill(input: HTMLInputElement): void {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  const progress = ((value - min) / (max - min)) * 100;
  input.style.setProperty("--fill", `${Math.min(100, Math.max(0, progress))}%`);
}
