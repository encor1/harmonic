import type { PaletteName, VisualizerMode } from "./types";
import { palettes } from "./palettes";

const customSelectSync = new WeakMap<HTMLSelectElement, () => void>();

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
  shell: HTMLElement;
  controlsPanel: HTMLElement;
  gainControl: HTMLInputElement;
  gainValue: HTMLOutputElement;
  releaseControl: HTMLInputElement;
  releaseValue: HTMLOutputElement;
  peakFalloffControl: HTMLInputElement;
  peakFalloffValue: HTMLOutputElement;
  barsControl: HTMLInputElement;
  barsValue: HTMLOutputElement;
  modeControl: HTMLSelectElement;
  modeButtons: HTMLButtonElement[];
  paletteControl: HTMLSelectElement;
  palettePreview: HTMLElement | null;
  resetModeButton: HTMLButtonElement;
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
    shell: requireElement("shell", HTMLElement),
    controlsPanel: requireElement("controls", HTMLElement),
    gainControl: requireElement("gain", HTMLInputElement),
    gainValue: requireElement("gainValue", HTMLOutputElement),
    releaseControl: requireElement("release", HTMLInputElement),
    releaseValue: requireElement("releaseValue", HTMLOutputElement),
    peakFalloffControl: requireElement("peakFalloff", HTMLInputElement),
    peakFalloffValue: requireElement("peakFalloffValue", HTMLOutputElement),
    barsControl: requireElement("bars", HTMLInputElement),
    barsValue: requireElement("barsValue", HTMLOutputElement),
    modeControl: requireElement("mode", HTMLSelectElement),
    modeButtons: Array.from(document.querySelectorAll<HTMLButtonElement>("[data-mode]")),
    paletteControl: requireElement("palette", HTMLSelectElement),
    palettePreview: document.querySelector<HTMLElement>(".palette-preview"),
    resetModeButton: requireElement("resetMode", HTMLButtonElement),
  };
}

export function getGain(ui: UiElements): number {
  return Number(ui.gainControl.value);
}

export function getRelease(ui: UiElements): number {
  return Number(ui.releaseControl.value);
}

export function getPeakFalloff(ui: UiElements): number {
  return Number(ui.peakFalloffControl.value) / 100;
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
  ui.releaseValue.textContent = Number(ui.releaseControl.value).toFixed(2);
  ui.peakFalloffValue.textContent = Number(ui.peakFalloffControl.value).toFixed(1);
  ui.barsValue.textContent = ui.barsControl.value;
  syncRangeFill(ui.gainControl);
  syncRangeFill(ui.releaseControl);
  syncRangeFill(ui.peakFalloffControl);
  syncRangeFill(ui.barsControl);
}

export function syncModeControls(ui: UiElements): void {
  ui.modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === ui.modeControl.value;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

export function syncPalettePreview(ui: UiElements): void {
  const colors = palettes[getPaletteName(ui)] || palettes.classic;
  ui.palettePreview?.style.setProperty("--palette-preview", colors.join(", "));
}

export function setupUpwardSelects(selects: HTMLSelectElement[]): void {
  selects.forEach((select) => {
    const card = select.closest<HTMLElement>(".select-label");

    if (!card) {
      return;
    }

    const selectCard = card;
    const trigger = document.createElement("button");
    const menu = document.createElement("div");
    const triggerId = `${select.id || "select"}Trigger`;
    const menuId = `${select.id || "select"}Menu`;
    const options = Array.from(select.options);
    const label = select.getAttribute("aria-label") || select.id || "Select";

    trigger.type = "button";
    trigger.id = triggerId;
    trigger.className = "select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", menuId);

    menu.id = menuId;
    menu.className = "select-menu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-labelledby", triggerId);

    function syncCustomSelect(): void {
      const selected = select.selectedOptions[0] || options[0];
      trigger.textContent = selected?.textContent || "";
      trigger.setAttribute("aria-label", `${label}: ${trigger.textContent}`);

      menu.querySelectorAll<HTMLElement>(".select-option").forEach((option) => {
        const isSelected = option.dataset.value === select.value;
        option.classList.toggle("is-selected", isSelected);
        option.setAttribute("aria-selected", String(isSelected));
      });
    }

    customSelectSync.set(select, syncCustomSelect);

    function closeSelect(): void {
      selectCard.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }

    function openSelect(): void {
      document.querySelectorAll<HTMLElement>(".select-label.is-open").forEach((openCard) => {
        if (openCard !== selectCard) {
          openCard.classList.remove("is-open");
          openCard.querySelector<HTMLElement>(".select-trigger")?.setAttribute("aria-expanded", "false");
        }
      });

      selectCard.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
    }

    options.forEach((option) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "select-option";
      item.dataset.value = option.value;
      item.textContent = option.textContent;
      item.setAttribute("role", "option");

      item.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        closeSelect();
        trigger.focus();
      });

      menu.append(item);
    });

    trigger.addEventListener("click", () => {
      if (selectCard.classList.contains("is-open")) {
        closeSelect();
      } else {
        openSelect();
      }
    });

    trigger.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSelect();
      }
    });

    select.addEventListener("change", syncCustomSelect);
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;
    selectCard.classList.add("is-customized");
    select.after(trigger, menu);
    syncCustomSelect();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Node)) {
      return;
    }

    document.querySelectorAll<HTMLElement>(".select-label.is-open").forEach((card) => {
      if (!card.contains(target)) {
        card.classList.remove("is-open");
        card.querySelector<HTMLElement>(".select-trigger")?.setAttribute("aria-expanded", "false");
      }
    });
  });
}

export function syncUpwardSelects(selects: HTMLSelectElement[]): void {
  selects.forEach((select) => customSelectSync.get(select)?.());
}

function syncRangeFill(input: HTMLInputElement): void {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  const progress = ((value - min) / (max - min)) * 100;
  input.style.setProperty("--fill", `${Math.min(100, Math.max(0, progress))}%`);
}
