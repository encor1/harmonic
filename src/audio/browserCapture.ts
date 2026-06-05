export interface BrowserCapture {
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  frequencyData: Uint8Array<ArrayBuffer> | null;
  start(): Promise<MediaStream>;
  stop(): void;
  close(): void;
}

export function createBrowserCapture(onEnded: () => void): BrowserCapture {
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let captureStream: MediaStream | null = null;
  let frequencyData: Uint8Array<ArrayBuffer> | null = null;

  function ensureAudioContext(): AudioContext {
    audioContext ??= new AudioContext();
    return audioContext;
  }

  function disconnectSource(): void {
    if (source) {
      source.disconnect();
      source = null;
    }
  }

  function stopCaptureTracks(): void {
    if (captureStream) {
      captureStream.getTracks().forEach((track) => track.stop());
      captureStream = null;
    }
  }

  async function start(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("This browser does not support audio capture.");
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: true,
    });
    const audioTracks = stream.getAudioTracks();

    if (!audioTracks.length) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("No shared audio track was found. Start capture again with audio sharing enabled.");
    }

    const context = ensureAudioContext();
    if (context.state === "suspended") {
      await context.resume();
    }

    analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.68;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);

    disconnectSource();
    captureStream = stream;
    source = context.createMediaStreamSource(stream);
    source.connect(analyser);

    stream.getAudioTracks().forEach((track) => {
      track.addEventListener("ended", onEnded);
    });

    return stream;
  }

  function stop(): void {
    disconnectSource();
    stopCaptureTracks();
    analyser = null;
    frequencyData = null;
  }

  function close(): void {
    stop();
    void audioContext?.close();
    audioContext = null;
  }

  return {
    get audioContext() {
      return audioContext;
    },
    get analyser() {
      return analyser;
    },
    get frequencyData() {
      return frequencyData;
    },
    start,
    stop,
    close,
  };
}
