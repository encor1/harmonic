import type { NativeSpectrum } from "../types";

export function isTauriRuntime(): boolean {
  return Boolean(window.__TAURI__?.core?.invoke);
}

export interface NativeCapture {
  spectrum: NativeSpectrum | null;
  start(): Promise<void>;
  stop(): Promise<void>;
  clear(): void;
}

export function createNativeCapture(onSpectrum: (spectrum: NativeSpectrum) => void): NativeCapture {
  let spectrum: NativeSpectrum | null = null;
  let unlisten: (() => void) | null = null;

  async function start(): Promise<void> {
    const invoke = window.__TAURI__?.core?.invoke;
    const listen = window.__TAURI__?.event?.listen;

    if (!invoke || !listen) {
      throw new Error("Tauri runtime is unavailable.");
    }

    if (!unlisten) {
      unlisten = await listen<NativeSpectrum>("spectrum", (event) => {
        spectrum = event.payload;
        onSpectrum(spectrum);
      });
    }

    await invoke("start_linux_audio");
  }

  async function stop(): Promise<void> {
    if (isTauriRuntime()) {
      await window.__TAURI__?.core?.invoke("stop_linux_audio");
    }
  }

  function clear(): void {
    spectrum = null;
  }

  return {
    get spectrum() {
      return spectrum;
    },
    start,
    stop,
    clear,
  };
}
