export type PaletteName =
  | "classic"
  | "fire"
  | "ice"
  | "terminal"
  | "aurora"
  | "ultraviolet"
  | "signal";

export type VisualizerMode =
  | "bars"
  | "circle"
  | "mirror"
  | "wave"
  | "orbit"
  | "bloom"
  | "nodes";

export interface NativeSpectrum {
  bands: number[];
  level: number;
}

export interface TauriRuntime {
  core?: {
    invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
  event?: {
    listen<T = unknown>(
      event: string,
      handler: (event: { payload: T }) => void,
    ): Promise<() => void>;
  };
}

declare global {
  interface Window {
    __TAURI__?: TauriRuntime;
  }
}
