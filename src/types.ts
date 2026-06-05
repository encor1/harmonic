export type PaletteName = "classic" | "fire" | "ice" | "mono";

export type VisualizerMode =
  | "bars"
  | "circle"
  | "mirror"
  | "wave"
  | "orbit"
  | "bloom"
  | "tunnel"
  | "constellation"
  | "spectrogram";

export interface NativeSpectrum {
  bands: number[];
  level: number;
}

export interface TauriRuntime {
  core?: {
    invoke<T = unknown>(command: string): Promise<T>;
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
