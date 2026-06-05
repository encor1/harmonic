import type { PaletteName } from "./types";

export const palettes: Record<PaletteName, [string, string, string, string]> = {
  classic: ["#bfef00", "#63f7ff", "#e9feff", "#ffab9f"],
  fire: ["#ff6b2b", "#ff9f1c", "#ffd166", "#ff3d7f"],
  ice: ["#6fffe9", "#42a5ff", "#8b7cff", "#e9feff"],
  terminal: ["#33ff99", "#7cff4d", "#c4ff6a", "#f0ffd8"],
  aurora: ["#2ef2d0", "#8aff80", "#f4ff66", "#ff7ad9"],
  ultraviolet: ["#7c4dff", "#00dce5", "#ff62d8", "#f7e8ff"],
  signal: ["#ffe45e", "#00f5ff", "#ffabf3", "#ffffff"],
};
