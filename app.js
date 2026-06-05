const canvas = document.getElementById("visualizer");
const ctx = canvas.getContext("2d");
const captureButton = document.getElementById("captureButton");
const stopButton = document.getElementById("stopButton");
const emptyState = document.getElementById("emptyState");
const statusText = document.getElementById("statusText");
const statusTextInline = document.getElementById("statusTextInline");
const levelReadout = document.getElementById("levelReadout");
const trackTitle = document.getElementById("trackTitle");
const gainControl = document.getElementById("gain");
const falloffControl = document.getElementById("falloff");
const barsControl = document.getElementById("bars");
const modeControl = document.getElementById("mode");
const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));
const paletteControl = document.getElementById("palette");

const palettes = {
  classic: ["#28ff5e", "#c7ff31", "#ffc934", "#ff5428"],
  fire: ["#ffee66", "#ff9f2e", "#ff4c24", "#b90f12"],
  ice: ["#67fff0", "#55b7ff", "#7a74ff", "#f0f8ff"],
  mono: ["#7cff4d", "#7cff4d", "#7cff4d", "#d8ffd0"],
};

let audioContext;
let analyser;
let source;
let captureStream;
let frequencyData;
let timeData;
let peakData = [];
let animationFrame;
let nativeSpectrum = null;
let nativeUnlisten = null;
let pulsePhase = 0;
let modeSignature = "";
let particles = [];
const spectrogramCanvas = document.createElement("canvas");
const spectrogramCtx = spectrogramCanvas.getContext("2d");

function setStatus(message) {
  statusText.textContent = message;
  statusTextInline.textContent = message;
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  return audioContext;
}

function disconnectSource() {
  if (source) {
    source.disconnect();
    source = null;
  }
}

function stopCaptureTracks() {
  if (captureStream) {
    captureStream.getTracks().forEach((track) => track.stop());
    captureStream = null;
  }
}

function resetToIdle(message = "Start Spotify, then capture the audio output.") {
  disconnectSource();
  stopCaptureTracks();
  analyser = null;
  frequencyData = null;
  timeData = null;
  nativeSpectrum = null;
  peakData = [];
  resetModeState();
  captureButton.disabled = false;
  stopButton.disabled = true;
  captureButton.textContent = "Capture Audio";
  trackTitle.textContent = "Spotify Audio";
  setStatus(message);
  levelReadout.textContent = "IDLE";
  emptyState.classList.remove("is-hidden");
}

function isTauriRuntime() {
  return Boolean(window.__TAURI__?.core?.invoke);
}

async function startNativeCapture() {
  const { invoke } = window.__TAURI__.core;
  const { listen } = window.__TAURI__.event;

  captureButton.disabled = true;
  setStatus("Starting Linux system audio capture.");

  if (!nativeUnlisten) {
    nativeUnlisten = await listen("spectrum", (event) => {
      nativeSpectrum = event.payload;
      levelReadout.textContent = `${String(nativeSpectrum.level).padStart(2, "0")}%`;
    });
  }

  try {
    await invoke("start_linux_audio");
    captureButton.textContent = "Capturing";
    trackTitle.textContent = "Live Linux Audio";
    stopButton.disabled = false;
    setStatus("Listening to the default output device.");
    emptyState.classList.add("is-hidden");
  } catch (error) {
    captureButton.disabled = false;
    setStatus(String(error));
  }
}

async function stopNativeCapture() {
  if (isTauriRuntime()) {
    await window.__TAURI__.core.invoke("stop_linux_audio");
  }

  resetToIdle("Audio capture stopped.");
}

function setCaptureReady(stream) {
  captureStream = stream;
  const context = ensureAudioContext();
  analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.68;
  frequencyData = new Uint8Array(analyser.frequencyBinCount);
  timeData = new Uint8Array(analyser.fftSize);

  disconnectSource();
  source = context.createMediaStreamSource(stream);
  source.connect(analyser);

  stream.getAudioTracks().forEach((track) => {
    track.addEventListener("ended", () => resetToIdle("Audio capture ended."));
  });

  captureButton.disabled = true;
  stopButton.disabled = false;
  captureButton.textContent = "Capturing";
  trackTitle.textContent = "Live Spotify Audio";
  setStatus("Listening to shared audio.");
  emptyState.classList.add("is-hidden");
}

async function startCapture() {
  if (isTauriRuntime()) {
    await startNativeCapture();
    return;
  }

  if (!navigator.mediaDevices?.getDisplayMedia) {
    setStatus("This browser does not support audio capture.");
    return;
  }

  captureButton.disabled = true;
  setStatus("Choose a screen, window, or tab and enable audio sharing.");

  try {
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
      resetToIdle("No shared audio track was found. Start capture again with audio sharing enabled.");
      return;
    }

    const context = ensureAudioContext();
    if (context.state === "suspended") {
      await context.resume();
    }

    setCaptureReady(stream);
  } catch (error) {
    resetToIdle(error.name === "NotAllowedError" ? "Audio capture was cancelled." : "Audio capture failed.");
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * scale));
  const height = Math.max(1, Math.floor(rect.height * scale));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function resetModeState() {
  peakData = [];
  particles = [];
  spectrogramCanvas.width = 0;
  spectrogramCanvas.height = 0;
}

function syncModeControls() {
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === modeControl.value;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function syncModeState(width, height, mode, valuesLength) {
  const signature = `${mode}:${width}:${height}:${valuesLength}`;

  if (modeSignature !== signature) {
    modeSignature = signature;
    resetModeState();
  }
}

function drawBackground(width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#050805");
  gradient.addColorStop(0.52, "#000");
  gradient.addColorStop(1, "#060906");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(120, 255, 90, 0.08)";
  ctx.lineWidth = 1;
  const rows = 10;
  for (let i = 1; i < rows; i += 1) {
    const y = (height / rows) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawIdleBars(width, height) {
  const bars = Number(barsControl.value);
  const gap = Math.max(2, Math.floor(width / 260));
  const barWidth = Math.max(3, Math.floor((width - gap * (bars - 1)) / bars));
  const baseY = height - 26;

  for (let i = 0; i < bars; i += 1) {
    const x = i * (barWidth + gap);
    const wave = Math.sin(Date.now() * 0.0015 + i * 0.4) * 0.5 + 0.5;
    const h = 8 + wave * 22;
    ctx.fillStyle = "rgba(124, 255, 77, 0.18)";
    ctx.fillRect(x, baseY - h, barWidth, h);
  }
}

function averageBin(start, end) {
  let sum = 0;
  let count = 0;
  const safeStart = Math.max(0, start);
  const safeEnd = Math.min(frequencyData.length, end);

  for (let i = safeStart; i < safeEnd; i += 1) {
    sum += frequencyData[i] || 0;
    count += 1;
  }
  return count ? sum / count : 0;
}

function frequencyToBin(frequency) {
  const nyquist = audioContext.sampleRate / 2;
  const index = Math.round((frequency / nyquist) * frequencyData.length);
  return Math.max(0, Math.min(frequencyData.length - 1, index));
}

function updateLevelReadout() {
  analyser.getByteTimeDomainData(timeData);
  let sumSquares = 0;

  for (let i = 0; i < timeData.length; i += 1) {
    const centered = (timeData[i] - 128) / 128;
    sumSquares += centered * centered;
  }

  const rms = Math.sqrt(sumSquares / timeData.length);
  const percent = Math.min(99, Math.round(rms * 180));
  levelReadout.textContent = `${String(percent).padStart(2, "0")}%`;
}

function getPaletteColor(colors, progress) {
  if (progress > 0.78) {
    return colors[3];
  }

  if (progress > 0.52) {
    return colors[2];
  }

  if (progress > 0.25) {
    return colors[1];
  }

  return colors[0];
}

function colorWithAlpha(hex, alpha) {
  const value = hex.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getNormalizedValues(values, power = 1.15) {
  const gain = Number(gainControl.value);
  return values.map((value) => Math.pow(Math.min(255, value * gain) / 255, power));
}

function getEnergy(values) {
  if (!values.length) {
    return { bass: 0, mid: 0, high: 0, average: 0 };
  }

  const normalized = getNormalizedValues(values, 1);
  const third = Math.max(1, Math.floor(normalized.length / 3));
  const averageRange = (start, end) => {
    const slice = normalized.slice(start, end);
    return slice.reduce((sum, value) => sum + value, 0) / Math.max(1, slice.length);
  };

  return {
    bass: averageRange(0, third),
    mid: averageRange(third, third * 2),
    high: averageRange(third * 2, normalized.length),
    average: normalized.reduce((sum, value) => sum + value, 0) / normalized.length,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function averageValues(values, start, end) {
  const safeStart = clamp(start, 0, values.length);
  const safeEnd = clamp(end, safeStart, values.length);
  let sum = 0;

  for (let index = safeStart; index < safeEnd; index += 1) {
    sum += values[index] || 0;
  }

  return sum / Math.max(1, safeEnd - safeStart);
}

function getInterpolatedGain(progress, gains) {
  const scaled = progress * (gains.length - 1);
  const low = Math.floor(scaled);
  const high = Math.min(gains.length - 1, low + 1);
  const mix = scaled - low;
  return gains[low] * (1 - mix) + gains[high] * mix;
}

function softLimit(value) {
  const knee = 132;

  if (value <= knee) {
    return value;
  }

  return knee + (205 - knee) * (1 - Math.exp((knee - value) / 120));
}

function balanceSpectrum(values) {
  const length = values.length;

  if (!length) {
    return values;
  }

  const average = averageValues(values, 0, length);
  const bandSize = Math.max(1, Math.floor(length / 4));
  const rangeAverages = [
    averageValues(values, 0, bandSize),
    averageValues(values, bandSize, bandSize * 2),
    averageValues(values, bandSize * 2, bandSize * 3),
    averageValues(values, bandSize * 3, length),
  ];
  const target = Math.max(10, average * 0.58);
  const gains = rangeAverages.map((rangeAverage, index) => {
    const shelf = 0.72 + index * 0.12;
    return clamp((target / Math.max(12, rangeAverage)) * shelf, 0.42, 1.65);
  });

  return values.map((value, index) => {
    const progress = index / Math.max(1, length - 1);
    const tilt = 0.74 + progress * 0.46;
    const balanced = value * getInterpolatedGain(progress, gains) * tilt;
    const localAverage = averageValues(values, Math.max(0, index - 2), Math.min(length, index + 3));
    const transient = Math.max(0, value - localAverage) * 0.16;
    return softLimit(balanced + transient);
  });
}

function enhanceValues(values) {
  if (!values.length) {
    return values;
  }

  const balancedValues = balanceSpectrum(values);
  const average = balancedValues.reduce((sum, value) => sum + value, 0) / balancedValues.length;
  const peak = balancedValues.reduce((max, value) => Math.max(max, value), 0);
  const floor = Math.min(24, average * 0.12 + peak * 0.035);

  return balancedValues.map((value, index) => {
    const left = balancedValues[Math.max(0, index - 1)] || 0;
    const right = balancedValues[Math.min(balancedValues.length - 1, index + 1)] || 0;
    const wideLeft = balancedValues[Math.max(0, index - 3)] || 0;
    const wideRight = balancedValues[Math.min(balancedValues.length - 1, index + 3)] || 0;
    const neighbor = Math.max(left, right) * 0.16;
    const wide = Math.max(wideLeft, wideRight) * 0.05;
    const movement = floor * (0.45 + Math.sin(pulsePhase + index * 0.37) * 0.18);
    return softLimit(value + neighbor + wide + movement);
  });
}

function getAnalyzerValues() {
  const bars = Number(barsControl.value);
  const minFrequency = 35;
  const maxFrequency = Math.min(18_000, audioContext.sampleRate / 2);
  const values = [];

  analyser.getByteFrequencyData(frequencyData);
  updateLevelReadout();

  for (let index = 0; index < bars; index += 1) {
    const lowProgress = index / bars;
    const highProgress = (index + 1) / bars;
    const lowFrequency = minFrequency * (maxFrequency / minFrequency) ** lowProgress;
    const highFrequency = minFrequency * (maxFrequency / minFrequency) ** highProgress;
    const low = frequencyToBin(lowFrequency);
    const high = frequencyToBin(highFrequency);
    values.push(averageBin(low, Math.max(low + 1, high + 1)));
  }

  return enhanceValues(values);
}

function getNativeValues() {
  const bands = nativeSpectrum?.bands || [];
  const bars = Number(barsControl.value);

  if (!bands.length) {
    return [];
  }

  const values = [];

  for (let index = 0; index < bars; index += 1) {
    const position = (index / Math.max(1, bars - 1)) * (bands.length - 1);
    const low = Math.floor(position);
    const high = Math.min(bands.length - 1, low + 1);
    const mix = position - low;
    values.push(bands[low] * (1 - mix) + bands[high] * mix);
  }

  return enhanceValues(values);
}

function drawSpectrumBars(width, height, values) {
  const colors = palettes[paletteControl.value] || palettes.classic;
  const bars = values.length;
  const gain = Number(gainControl.value);
  const falloff = Number(falloffControl.value);
  const gap = Math.max(2, Math.floor(width / 260));
  const barWidth = Math.max(3, (width - gap * (bars - 1)) / bars);
  const maxHeight = height - 44;

  if (peakData.length !== bars) {
    peakData = Array.from({ length: bars }, () => 0);
  }

  for (let i = 0; i < bars; i += 1) {
    const value = Math.min(255, values[i] * gain);
    const normalized = Math.pow(value / 255, 1.25);
    const barHeight = Math.max(3, normalized * maxHeight);
    const x = i * (barWidth + gap);
    const y = height - 24 - barHeight;

    peakData[i] = Math.max(barHeight, peakData[i] * falloff);

    const barGradient = ctx.createLinearGradient(0, y, 0, height - 24);
    barGradient.addColorStop(0, colors[3]);
    barGradient.addColorStop(0.26, colors[2]);
    barGradient.addColorStop(0.62, colors[1]);
    barGradient.addColorStop(1, colors[0]);

    ctx.fillStyle = barGradient;
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = colors[3];
    ctx.fillRect(x, height - 28 - peakData[i], barWidth, 3);
  }
}

function drawMirror(width, height, values) {
  const colors = palettes[paletteControl.value] || palettes.classic;
  const gain = Number(gainControl.value);
  const falloff = Number(falloffControl.value);
  const bars = values.length;
  const gap = Math.max(2, Math.floor(width / 300));
  const barWidth = Math.max(3, (width - gap * (bars - 1)) / bars);
  const centerY = height * 0.52;
  const maxHeight = height * 0.43;

  if (peakData.length !== bars) {
    peakData = Array.from({ length: bars }, () => 0);
  }

  ctx.save();
  ctx.shadowColor = colors[0];
  ctx.shadowBlur = 14;

  for (let i = 0; i < bars; i += 1) {
    const value = Math.min(255, values[i] * gain);
    const normalized = Math.pow(value / 255, 1.18);
    const barHeight = Math.max(2, normalized * maxHeight);
    const x = i * (barWidth + gap);
    const color = getPaletteColor(colors, normalized);

    peakData[i] = Math.max(barHeight, peakData[i] * falloff);
    ctx.fillStyle = color;
    ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);
    ctx.fillRect(x, centerY + 2, barWidth, barHeight);

    ctx.fillStyle = colors[3];
    ctx.fillRect(x, centerY - peakData[i] - 5, barWidth, 3);
    ctx.fillRect(x, centerY + peakData[i] + 4, barWidth, 3);
  }

  ctx.restore();
}

function drawWave(width, height, values) {
  const colors = palettes[paletteControl.value] || palettes.classic;
  const gain = Number(gainControl.value);
  const centerY = height * 0.55;
  const maxHeight = height * 0.36;
  const points = values.length;

  ctx.lineWidth = Math.max(2, width / 420);
  ctx.shadowColor = colors[1];
  ctx.shadowBlur = 18;

  for (let layer = 0; layer < 3; layer += 1) {
    ctx.beginPath();
    for (let i = 0; i < points; i += 1) {
      const x = (i / Math.max(1, points - 1)) * width;
      const value = Math.min(255, values[i] * gain);
      const normalized = Math.pow(value / 255, 1.12);
      const direction = Math.sin(pulsePhase * (1.2 + layer * 0.16) + i * 0.34 + layer);
      const y = centerY + direction * (20 + normalized * maxHeight * (1 - layer * 0.18));

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = layer === 0 ? colors[3] : `rgba(124, 255, 77, ${0.34 - layer * 0.08})`;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function drawOrbit(width, height, values) {
  const colors = palettes[paletteControl.value] || palettes.classic;
  const gain = Number(gainControl.value);
  const centerX = width / 2;
  const centerY = height / 2;
  const baseRadius = Math.min(width, height) * 0.18;
  const maxRadius = Math.min(width, height) * 0.28;
  const points = values.length;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(pulsePhase * 0.08);
  ctx.lineWidth = Math.max(2, Math.min(width, height) / 240);
  ctx.shadowColor = colors[2];
  ctx.shadowBlur = 14;

  for (let i = 0; i < points; i += 1) {
    const value = Math.min(255, values[i] * gain);
    const normalized = Math.pow(value / 255, 1.08);
    const angle = (i / points) * Math.PI * 2;
    const inner = baseRadius + Math.sin(pulsePhase + i * 0.15) * 5;
    const outer = inner + 8 + normalized * maxRadius;

    ctx.strokeStyle = getPaletteColor(colors, normalized);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.arc(0, 0, baseRadius * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCircle(width, height, values) {
  const colors = palettes[paletteControl.value] || palettes.classic;
  const falloff = Number(falloffControl.value);
  const normalizedValues = getNormalizedValues(values, 1.08);
  const energy = getEnergy(values);
  const bands = normalizedValues.length;
  const centerX = width / 2;
  const centerY = height / 2;
  const size = Math.min(width, height);
  const innerRadius = size * (0.16 + energy.bass * 0.04);
  const maxBarLength = size * 0.27;

  if (peakData.length !== bands) {
    peakData = Array.from({ length: bands }, () => 0);
  }

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(pulsePhase * 0.045);
  ctx.lineCap = "round";
  ctx.shadowColor = colors[1];
  ctx.shadowBlur = 16 + energy.average * 18;

  const coreGradient = ctx.createRadialGradient(0, 0, innerRadius * 0.12, 0, 0, innerRadius * 1.2);
  coreGradient.addColorStop(0, colorWithAlpha(colors[3], 0.42 + energy.average * 0.28));
  coreGradient.addColorStop(0.62, colorWithAlpha(colors[1], 0.18 + energy.bass * 0.2));
  coreGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = coreGradient;
  ctx.beginPath();
  ctx.arc(0, 0, innerRadius * (1.35 + energy.bass * 0.4), 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = colorWithAlpha(colors[0], 0.34);
  ctx.lineWidth = Math.max(1, size / 360);
  ctx.beginPath();
  ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < bands; i += 1) {
    const normalized = normalizedValues[i];
    const angle = (i / bands) * Math.PI * 2;
    const barLength = Math.max(4, normalized * maxBarLength);
    const peakLength = Math.max(barLength, peakData[i] * falloff);
    const inner = innerRadius + size * 0.025;
    const outer = inner + barLength;
    const peak = inner + peakLength + size * 0.016;
    const lineWidth = Math.max(2, size / 180);

    peakData[i] = peakLength;

    ctx.strokeStyle = getPaletteColor(colors, normalized);
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();

    ctx.fillStyle = colors[3];
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * peak, Math.sin(angle) * peak, Math.max(1.5, lineWidth * 0.42), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBloom(width, height, values) {
  const colors = palettes[paletteControl.value] || palettes.classic;
  const normalizedValues = getNormalizedValues(values, 1.05);
  const energy = getEnergy(values);
  const centerX = width / 2;
  const centerY = height * 0.53;
  const radius = Math.min(width, height) * (0.12 + energy.bass * 0.08);
  const maxSpread = Math.min(width, height) * 0.34;
  const points = normalizedValues.length;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(Math.sin(pulsePhase * 0.4) * 0.08);
  ctx.shadowColor = colors[2];
  ctx.shadowBlur = 26;

  for (let layer = 2; layer >= 0; layer -= 1) {
    ctx.beginPath();
    for (let i = 0; i <= points; i += 1) {
      const index = i % points;
      const angle = (i / points) * Math.PI * 2;
      const ripple = Math.sin(pulsePhase * (1.3 + layer * 0.12) + index * 0.5) * 10;
      const distance = radius + ripple + normalizedValues[index] * maxSpread * (1 - layer * 0.18);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    ctx.fillStyle = colorWithAlpha(colors[layer + 1], 0.13 + layer * 0.04);
    ctx.strokeStyle = colorWithAlpha(colors[3 - layer], 0.74 - layer * 0.14);
    ctx.lineWidth = Math.max(2, Math.min(width, height) / (240 - layer * 36));
    ctx.fill();
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.fillStyle = colorWithAlpha(colors[0], 0.22 + energy.average * 0.28);
  ctx.arc(0, 0, radius * (0.7 + energy.mid * 0.8), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTunnel(width, height, values) {
  const colors = palettes[paletteControl.value] || palettes.classic;
  const normalizedValues = getNormalizedValues(values, 1.02);
  const energy = getEnergy(values);
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.hypot(width, height) * 0.58;
  const rings = 18;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(pulsePhase * 0.05);
  ctx.lineWidth = Math.max(1.5, Math.min(width, height) / 320);
  ctx.shadowBlur = 12 + energy.high * 24;
  ctx.shadowColor = colors[1];

  for (let ring = 0; ring < rings; ring += 1) {
    const progress = ring / rings;
    const radius = ((progress + (pulsePhase * 0.018) % 1) % 1) * maxRadius;
    const alpha = Math.max(0, 1 - radius / maxRadius);
    const samples = 96;

    ctx.beginPath();
    for (let i = 0; i <= samples; i += 1) {
      const valueIndex = Math.floor((i / samples) * (normalizedValues.length - 1));
      const angle = (i / samples) * Math.PI * 2;
      const wobble = normalizedValues[valueIndex] * 42 + Math.sin(pulsePhase + i * 0.24 + ring) * 8;
      const distance = radius + wobble * alpha;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance * (0.74 + energy.bass * 0.18);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = colorWithAlpha(getPaletteColor(colors, alpha), 0.12 + alpha * 0.72);
    ctx.stroke();
  }

  ctx.restore();
}

function seedParticles(width, height, count) {
  particles = Array.from({ length: count }, (_, index) => ({
    angle: (index / count) * Math.PI * 2,
    radius: Math.min(width, height) * (0.12 + Math.random() * 0.36),
    speed: 0.002 + Math.random() * 0.007,
    band: index % Math.max(1, Number(barsControl.value)),
  }));
}

function drawConstellation(width, height, values) {
  const colors = palettes[paletteControl.value] || palettes.classic;
  const normalizedValues = getNormalizedValues(values, 1);
  const energy = getEnergy(values);
  const count = Math.min(96, Math.max(36, values.length));
  const centerX = width / 2;
  const centerY = height / 2;

  if (particles.length !== count) {
    seedParticles(width, height, count);
  }

  ctx.save();
  ctx.shadowColor = colors[0];
  ctx.shadowBlur = 12;

  const points = particles.map((particle) => {
    const bandValue = normalizedValues[particle.band % normalizedValues.length] || 0;
    particle.angle += particle.speed * (1 + energy.high * 2.2);
    const radius = particle.radius * (0.72 + bandValue * 0.72);
    return {
      x: centerX + Math.cos(particle.angle + pulsePhase * 0.04) * radius,
      y: centerY + Math.sin(particle.angle * 1.24) * radius * 0.72,
      value: bandValue,
    };
  });

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < Math.min(points.length, i + 7); j += 1) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const distance = Math.hypot(dx, dy);
      const limit = Math.min(width, height) * (0.16 + energy.mid * 0.08);

      if (distance < limit) {
        ctx.strokeStyle = colorWithAlpha(colors[1], (1 - distance / limit) * 0.34);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
        ctx.stroke();
      }
    }
  }

  points.forEach((point) => {
    const radius = 2 + point.value * 7;
    ctx.fillStyle = getPaletteColor(colors, point.value);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

function drawSpectrogram(width, height, values) {
  const colors = palettes[paletteControl.value] || palettes.classic;
  const normalizedValues = getNormalizedValues(values, 1);
  const stripWidth = Math.max(2, Math.floor(width / 360));

  if (spectrogramCanvas.width !== width || spectrogramCanvas.height !== height) {
    spectrogramCanvas.width = width;
    spectrogramCanvas.height = height;
    spectrogramCtx.fillStyle = "#020302";
    spectrogramCtx.fillRect(0, 0, width, height);
  }

  spectrogramCtx.drawImage(spectrogramCanvas, stripWidth, 0, width - stripWidth, height, 0, 0, width - stripWidth, height);
  spectrogramCtx.fillStyle = "rgba(2, 3, 2, 0.36)";
  spectrogramCtx.fillRect(width - stripWidth, 0, stripWidth, height);

  for (let i = 0; i < normalizedValues.length; i += 1) {
    const value = normalizedValues[i];
    const y = height - (i / normalizedValues.length) * height;
    const bandHeight = Math.ceil(height / normalizedValues.length) + 1;
    spectrogramCtx.fillStyle = colorWithAlpha(getPaletteColor(colors, value), 0.16 + value * 0.84);
    spectrogramCtx.fillRect(width - stripWidth, y - bandHeight, stripWidth, bandHeight);
  }

  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.drawImage(spectrogramCanvas, 0, 0);
  ctx.restore();
}

function drawActiveVisualizer(width, height, values) {
  syncModeState(width, height, modeControl.value, values.length);

  if (!values.length) {
    drawIdleBars(width, height);
    return;
  }

  if (modeControl.value === "mirror") {
    drawMirror(width, height, values);
  } else if (modeControl.value === "wave") {
    drawWave(width, height, values);
  } else if (modeControl.value === "circle") {
    drawCircle(width, height, values);
  } else if (modeControl.value === "orbit") {
    drawOrbit(width, height, values);
  } else if (modeControl.value === "bloom") {
    drawBloom(width, height, values);
  } else if (modeControl.value === "tunnel") {
    drawTunnel(width, height, values);
  } else if (modeControl.value === "constellation") {
    drawConstellation(width, height, values);
  } else if (modeControl.value === "spectrogram") {
    drawSpectrogram(width, height, values);
  } else {
    drawSpectrumBars(width, height, values);
  }
}

function render() {
  resizeCanvas();
  const { width, height } = canvas;
  drawBackground(width, height);
  pulsePhase += 0.035;

  if (nativeSpectrum) {
    drawActiveVisualizer(width, height, getNativeValues());
  } else if (analyser) {
    drawActiveVisualizer(width, height, getAnalyzerValues());
  } else {
    drawIdleBars(width, height);
  }

  animationFrame = requestAnimationFrame(render);
}

captureButton.addEventListener("click", startCapture);
stopButton.addEventListener("click", stopNativeCapture);
modeControl.addEventListener("change", () => {
  syncModeControls();
  resetModeState();
});
modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    modeControl.value = button.dataset.mode;
    modeControl.dispatchEvent(new Event("change"));
  });
});
paletteControl.addEventListener("change", resetModeState);
window.addEventListener("resize", resizeCanvas);
window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(animationFrame);
  stopCaptureTracks();
  disconnectSource();
  if (audioContext) {
    audioContext.close();
  }
});

resetToIdle();
syncModeControls();
render();
