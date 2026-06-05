import { getBars, getFalloff, getGain, getMode, getPaletteName, type UiElements } from "../dom";
import { palettes } from "../palettes";

interface Energy {
  bass: number;
  mid: number;
  high: number;
  average: number;
}

interface Particle {
  angle: number;
  radius: number;
  speed: number;
  band: number;
}

export class VisualizerRenderer {
  private peakData: number[] = [];
  private smoothedValues: number[] = [];
  private pulsePhase = 0;
  private modeSignature = "";
  private particles: Particle[] = [];
  private lastRenderTime = performance.now();
  private frameDeltaSeconds = 1 / 60;
  private readonly spectrogramCanvas = document.createElement("canvas");
  private readonly spectrogramCtx: CanvasRenderingContext2D;

  constructor(private readonly ui: UiElements) {
    const spectrogramCtx = this.spectrogramCanvas.getContext("2d");

    if (!spectrogramCtx) {
      throw new Error("Spectrogram canvas context is unavailable");
    }

    this.spectrogramCtx = spectrogramCtx;
  }

  resizeCanvas(): void {
    const rect = this.ui.canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * scale));
    const height = Math.max(1, Math.floor(rect.height * scale));

    if (this.ui.canvas.width !== width || this.ui.canvas.height !== height) {
      this.ui.canvas.width = width;
      this.ui.canvas.height = height;
    }
  }

  resetModeState(): void {
    this.peakData = [];
    this.smoothedValues = [];
    this.particles = [];
    this.spectrogramCanvas.width = 0;
    this.spectrogramCanvas.height = 0;
    this.modeSignature = "";
  }

  beginFrame(now: number): void {
    this.resizeCanvas();
    const deltaSeconds = Math.min(0.05, (now - this.lastRenderTime) / 1000);
    this.lastRenderTime = now;
    this.frameDeltaSeconds = deltaSeconds || 1 / 60;
    this.pulsePhase += deltaSeconds * 60 * 0.018;
    this.drawBackground(this.ui.canvas.width, this.ui.canvas.height);
  }

  drawIdle(): void {
    this.drawIdleBars(this.ui.canvas.width, this.ui.canvas.height);
  }

  drawActive(values: number[]): void {
    const { width, height } = this.ui.canvas;
    this.syncModeState(width, height, getMode(this.ui), values.length);
    const smoothedValues = this.smoothValues(values);

    if (!smoothedValues.length) {
      this.drawIdleBars(width, height);
      return;
    }

    switch (getMode(this.ui)) {
      case "mirror":
        this.drawMirror(width, height, smoothedValues);
        break;
      case "wave":
        this.drawWave(width, height, smoothedValues);
        break;
      case "circle":
        this.drawCircle(width, height, smoothedValues);
        break;
      case "orbit":
        this.drawOrbit(width, height, smoothedValues);
        break;
      case "bloom":
        this.drawBloom(width, height, smoothedValues);
        break;
      case "tunnel":
        this.drawTunnel(width, height, smoothedValues);
        break;
      case "constellation":
        this.drawConstellation(width, height, smoothedValues);
        break;
      case "spectrogram":
        this.drawSpectrogram(width, height, smoothedValues);
        break;
      default:
        this.drawSpectrumBars(width, height, smoothedValues);
    }
  }

  private get ctx(): CanvasRenderingContext2D {
    return this.ui.ctx;
  }

  private colors(): [string, string, string, string] {
    return palettes[getPaletteName(this.ui)] || palettes.classic;
  }

  private syncModeState(width: number, height: number, mode: string, valuesLength: number): void {
    const signature = `${mode}:${width}:${height}:${valuesLength}`;

    if (this.modeSignature !== signature) {
      this.modeSignature = signature;
      this.peakData = [];
      this.smoothedValues = [];
      this.particles = [];
      this.spectrogramCanvas.width = 0;
      this.spectrogramCanvas.height = 0;
    }
  }

  private smoothValues(values: number[]): number[] {
    if (!values.length) {
      this.smoothedValues = [];
      return [];
    }

    if (this.smoothedValues.length !== values.length) {
      this.smoothedValues = [...values];
      return this.smoothedValues;
    }

    const falloffProgress = (getFalloff(this.ui) - 0.72) / (0.96 - 0.72);
    const attackSeconds = 0.055;
    const releaseSeconds = 0.08 + Math.max(0, Math.min(1, falloffProgress)) * 0.22;

    this.smoothedValues = values.map((value, index) => {
      const previous = this.smoothedValues[index] || 0;
      const timeConstant = value > previous ? attackSeconds : releaseSeconds;
      const mix = 1 - Math.exp(-this.frameDeltaSeconds / timeConstant);
      return previous + (value - previous) * mix;
    });

    return this.smoothedValues;
  }

  private drawBackground(width: number, height: number): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#111315");
    gradient.addColorStop(1, "#0b0c0d");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
  }

  private drawIdleBars(width: number, height: number): void {
    const bars = getBars(this.ui);
    const colors = this.colors();
    const gap = Math.max(4, Math.floor(width / 210));
    const barWidth = Math.max(3, Math.floor((width - gap * (bars - 1)) / bars));
    const baseY = height - 20;
    const maxHeight = height * 0.72;
    const now = Date.now() * 0.001;

    for (let i = 0; i < bars; i += 1) {
      const x = i * (barWidth + gap);
      const wave = Math.sin(now * 1.4 + i * 0.31) * 0.5 + 0.5;
      const offset = Math.sin(i * 1.73) * 0.5 + 0.5;
      const h = 18 + (wave * 0.38 + offset * 0.62) * maxHeight;
      const y = baseY - h;
      const barGradient = this.ctx.createLinearGradient(0, y, 0, baseY);
      barGradient.addColorStop(0, this.colorWithAlpha(colors[3], 0.58));
      barGradient.addColorStop(0.42, this.colorWithAlpha(colors[1], 0.48));
      barGradient.addColorStop(1, this.colorWithAlpha(colors[0], 0.55));

      this.ctx.fillStyle = barGradient;
      this.ctx.fillRect(x, y, barWidth, h);
    }
  }

  private getPaletteColor(colors: string[], progress: number): string {
    if (progress > 0.78) return colors[3];
    if (progress > 0.52) return colors[2];
    if (progress > 0.25) return colors[1];
    return colors[0];
  }

  private colorWithAlpha(hex: string, alpha: number): string {
    const value = hex.replace("#", "");
    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  private getNormalizedValues(values: number[], power = 1.15): number[] {
    const gain = getGain(this.ui);
    return values.map((value) => Math.pow(Math.min(255, value * gain) / 255, power));
  }

  private getEnergy(values: number[]): Energy {
    if (!values.length) {
      return { bass: 0, mid: 0, high: 0, average: 0 };
    }

    const normalized = this.getNormalizedValues(values, 1);
    const third = Math.max(1, Math.floor(normalized.length / 3));
    const averageRange = (start: number, end: number): number => {
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

  private drawSpectrumBars(width: number, height: number, values: number[]): void {
    const colors = this.colors();
    const bars = values.length;
    const gain = getGain(this.ui);
    const falloff = getFalloff(this.ui);
    const gap = Math.max(2, Math.floor(width / 260));
    const barWidth = Math.max(3, (width - gap * (bars - 1)) / bars);
    const maxHeight = height - 44;

    if (this.peakData.length !== bars) {
      this.peakData = Array.from({ length: bars }, () => 0);
    }

    for (let i = 0; i < bars; i += 1) {
      const value = Math.min(255, values[i] * gain);
      const normalized = Math.pow(value / 255, 1.25);
      const barHeight = Math.max(3, normalized * maxHeight);
      const x = i * (barWidth + gap);
      const y = height - 24 - barHeight;

      this.peakData[i] = Math.max(barHeight, this.peakData[i] * falloff);

      const barGradient = this.ctx.createLinearGradient(0, y, 0, height - 24);
      barGradient.addColorStop(0, colors[3]);
      barGradient.addColorStop(0.26, colors[2]);
      barGradient.addColorStop(0.62, colors[1]);
      barGradient.addColorStop(1, colors[0]);

      this.ctx.save();
      this.ctx.globalCompositeOperation = "screen";
      this.ctx.shadowColor = colors[1];
      this.ctx.shadowBlur = 12;
      this.ctx.fillStyle = barGradient;
      this.ctx.fillRect(x, y, barWidth, barHeight);
      this.ctx.restore();

      this.ctx.fillStyle = colors[3];
      this.ctx.fillRect(x, height - 28 - this.peakData[i], barWidth, 3);
    }
  }

  private drawMirror(width: number, height: number, values: number[]): void {
    const colors = this.colors();
    const gain = getGain(this.ui);
    const falloff = getFalloff(this.ui);
    const bars = values.length;
    const gap = Math.max(2, Math.floor(width / 300));
    const barWidth = Math.max(3, (width - gap * (bars - 1)) / bars);
    const centerY = height * 0.52;
    const maxHeight = height * 0.43;

    if (this.peakData.length !== bars) {
      this.peakData = Array.from({ length: bars }, () => 0);
    }

    this.ctx.save();
    this.ctx.shadowColor = colors[0];
    this.ctx.shadowBlur = 14;

    for (let i = 0; i < bars; i += 1) {
      const value = Math.min(255, values[i] * gain);
      const normalized = Math.pow(value / 255, 1.18);
      const barHeight = Math.max(2, normalized * maxHeight);
      const x = i * (barWidth + gap);
      const color = this.getPaletteColor(colors, normalized);

      this.peakData[i] = Math.max(barHeight, this.peakData[i] * falloff);
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);
      this.ctx.fillRect(x, centerY + 2, barWidth, barHeight);

      this.ctx.fillStyle = colors[3];
      this.ctx.fillRect(x, centerY - this.peakData[i] - 5, barWidth, 3);
      this.ctx.fillRect(x, centerY + this.peakData[i] + 4, barWidth, 3);
    }

    this.ctx.restore();
  }

  private drawWave(width: number, height: number, values: number[]): void {
    const colors = this.colors();
    const gain = getGain(this.ui);
    const centerY = height * 0.55;
    const maxHeight = height * 0.36;
    const points = values.length;

    this.ctx.lineWidth = Math.max(2, width / 420);
    this.ctx.shadowColor = colors[1];
    this.ctx.shadowBlur = 18;

    for (let layer = 0; layer < 3; layer += 1) {
      this.ctx.beginPath();
      for (let i = 0; i < points; i += 1) {
        const x = (i / Math.max(1, points - 1)) * width;
        const value = Math.min(255, values[i] * gain);
        const normalized = Math.pow(value / 255, 1.12);
        const phaseOffset = normalized * 0.95 + layer * 0.4;
        const direction = Math.sin(i * 0.34 + phaseOffset);
        const y = centerY + direction * (8 + normalized * maxHeight * (1 - layer * 0.18));

        if (i === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }

      this.ctx.strokeStyle = layer === 0 ? colors[3] : `rgba(124, 255, 77, ${0.34 - layer * 0.08})`;
      this.ctx.stroke();
    }
    this.ctx.shadowBlur = 0;
  }

  private drawOrbit(width: number, height: number, values: number[]): void {
    const colors = this.colors();
    const gain = getGain(this.ui);
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.18;
    const maxRadius = Math.min(width, height) * 0.28;
    const points = values.length;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(this.pulsePhase * 0.018);
    this.ctx.lineWidth = Math.max(2, Math.min(width, height) / 240);
    this.ctx.shadowColor = colors[2];
    this.ctx.shadowBlur = 14;

    for (let i = 0; i < points; i += 1) {
      const value = Math.min(255, values[i] * gain);
      const normalized = Math.pow(value / 255, 1.08);
      const angle = (i / points) * Math.PI * 2;
      const inner = baseRadius + normalized * 4;
      const outer = inner + 8 + normalized * maxRadius;

      this.ctx.strokeStyle = this.getPaletteColor(colors, normalized);
      this.ctx.beginPath();
      this.ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      this.ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      this.ctx.stroke();
    }

    this.ctx.beginPath();
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    this.ctx.arc(0, 0, baseRadius * 0.82, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawCircle(width: number, height: number, values: number[]): void {
    const colors = this.colors();
    const falloff = getFalloff(this.ui);
    const normalizedValues = this.getNormalizedValues(values, 1.08);
    const energy = this.getEnergy(values);
    const bands = normalizedValues.length;
    const centerX = width / 2;
    const centerY = height / 2;
    const size = Math.min(width, height);
    const innerRadius = size * (0.16 + energy.bass * 0.04);
    const maxBarLength = size * 0.27;

    if (this.peakData.length !== bands) {
      this.peakData = Array.from({ length: bands }, () => 0);
    }

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(this.pulsePhase * 0.012);
    this.ctx.lineCap = "round";
    this.ctx.shadowColor = colors[1];
    this.ctx.shadowBlur = 16 + energy.average * 18;

    const coreGradient = this.ctx.createRadialGradient(0, 0, innerRadius * 0.12, 0, 0, innerRadius * 1.2);
    coreGradient.addColorStop(0, this.colorWithAlpha(colors[3], 0.42 + energy.average * 0.28));
    coreGradient.addColorStop(0.62, this.colorWithAlpha(colors[1], 0.18 + energy.bass * 0.2));
    coreGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    this.ctx.fillStyle = coreGradient;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, innerRadius * (1.35 + energy.bass * 0.4), 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = this.colorWithAlpha(colors[0], 0.34);
    this.ctx.lineWidth = Math.max(1, size / 360);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
    this.ctx.stroke();

    for (let i = 0; i < bands; i += 1) {
      const normalized = normalizedValues[i];
      const angle = (i / bands) * Math.PI * 2;
      const barLength = Math.max(4, normalized * maxBarLength);
      const peakLength = Math.max(barLength, this.peakData[i] * falloff);
      const inner = innerRadius + size * 0.025;
      const outer = inner + barLength;
      const peak = inner + peakLength + size * 0.016;
      const lineWidth = Math.max(2, size / 180);

      this.peakData[i] = peakLength;

      this.ctx.strokeStyle = this.getPaletteColor(colors, normalized);
      this.ctx.lineWidth = lineWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      this.ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      this.ctx.stroke();

      this.ctx.fillStyle = colors[3];
      this.ctx.beginPath();
      this.ctx.arc(Math.cos(angle) * peak, Math.sin(angle) * peak, Math.max(1.5, lineWidth * 0.42), 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  private drawBloom(width: number, height: number, values: number[]): void {
    const colors = this.colors();
    const normalizedValues = this.getNormalizedValues(values, 1.05);
    const energy = this.getEnergy(values);
    const centerX = width / 2;
    const centerY = height * 0.53;
    const radius = Math.min(width, height) * (0.12 + energy.bass * 0.08);
    const maxSpread = Math.min(width, height) * 0.34;
    const points = normalizedValues.length;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate((energy.mid - energy.high) * 0.05);
    this.ctx.shadowColor = colors[2];
    this.ctx.shadowBlur = 26;

    for (let layer = 2; layer >= 0; layer -= 1) {
      this.ctx.beginPath();
      for (let i = 0; i <= points; i += 1) {
        const index = i % points;
        const angle = (i / points) * Math.PI * 2;
        const ripple = Math.sin(index * 0.5 + layer) * energy.average * 8;
        const distance = radius + ripple + normalizedValues[index] * maxSpread * (1 - layer * 0.18);
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        if (i === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }

      this.ctx.closePath();
      this.ctx.fillStyle = this.colorWithAlpha(colors[layer + 1], 0.13 + layer * 0.04);
      this.ctx.strokeStyle = this.colorWithAlpha(colors[3 - layer], 0.74 - layer * 0.14);
      this.ctx.lineWidth = Math.max(2, Math.min(width, height) / (240 - layer * 36));
      this.ctx.fill();
      this.ctx.stroke();
    }

    this.ctx.beginPath();
    this.ctx.fillStyle = this.colorWithAlpha(colors[0], 0.22 + energy.average * 0.28);
    this.ctx.arc(0, 0, radius * (0.7 + energy.mid * 0.8), 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawTunnel(width: number, height: number, values: number[]): void {
    const colors = this.colors();
    const normalizedValues = this.getNormalizedValues(values, 1.02);
    const energy = this.getEnergy(values);
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.hypot(width, height) * 0.58;
    const rings = 18;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(this.pulsePhase * 0.012);
    this.ctx.lineWidth = Math.max(1.5, Math.min(width, height) / 320);
    this.ctx.shadowBlur = 12 + energy.high * 24;
    this.ctx.shadowColor = colors[1];

    for (let ring = 0; ring < rings; ring += 1) {
      const progress = ring / rings;
      const radius = ((progress + (this.pulsePhase * 0.006) % 1) % 1) * maxRadius;
      const alpha = Math.max(0, 1 - radius / maxRadius);
      const samples = 96;

      this.ctx.beginPath();
      for (let i = 0; i <= samples; i += 1) {
        const valueIndex = Math.floor((i / samples) * (normalizedValues.length - 1));
        const angle = (i / samples) * Math.PI * 2;
        const wobble = normalizedValues[valueIndex] * 42;
        const distance = radius + wobble * alpha;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance * (0.74 + energy.bass * 0.18);

        if (i === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }

      this.ctx.strokeStyle = this.colorWithAlpha(this.getPaletteColor(colors, alpha), 0.12 + alpha * 0.72);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  private seedParticles(width: number, height: number, count: number): void {
    this.particles = Array.from({ length: count }, (_, index) => ({
      angle: (index / count) * Math.PI * 2,
      radius: Math.min(width, height) * (0.12 + Math.random() * 0.36),
      speed: 0.001 + Math.random() * 0.002,
      band: index % Math.max(1, getBars(this.ui)),
    }));
  }

  private drawConstellation(width: number, height: number, values: number[]): void {
    const colors = this.colors();
    const normalizedValues = this.getNormalizedValues(values, 1);
    const energy = this.getEnergy(values);
    const count = Math.min(96, Math.max(36, values.length));
    const centerX = width / 2;
    const centerY = height / 2;

    if (this.particles.length !== count) {
      this.seedParticles(width, height, count);
    }

    this.ctx.save();
    this.ctx.shadowColor = colors[0];
    this.ctx.shadowBlur = 12;

    const points = this.particles.map((particle) => {
      const bandValue = normalizedValues[particle.band % normalizedValues.length] || 0;
      particle.angle += particle.speed * (0.4 + energy.high * 2.2);
      const radius = particle.radius * (0.72 + bandValue * 0.72);
      return {
        x: centerX + Math.cos(particle.angle) * radius,
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
          this.ctx.strokeStyle = this.colorWithAlpha(colors[1], (1 - distance / limit) * 0.34);
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(points[i].x, points[i].y);
          this.ctx.lineTo(points[j].x, points[j].y);
          this.ctx.stroke();
        }
      }
    }

    points.forEach((point) => {
      const radius = 2 + point.value * 7;
      this.ctx.fillStyle = this.getPaletteColor(colors, point.value);
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.restore();
  }

  private drawSpectrogram(width: number, height: number, values: number[]): void {
    const ctx = this.spectrogramCtx;
    const colors = this.colors();
    const normalizedValues = this.getNormalizedValues(values, 1);
    const stripWidth = Math.max(2, Math.floor(width / 360));

    if (this.spectrogramCanvas.width !== width || this.spectrogramCanvas.height !== height) {
      this.spectrogramCanvas.width = width;
      this.spectrogramCanvas.height = height;
      ctx.fillStyle = "#020302";
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(this.spectrogramCanvas, stripWidth, 0, width - stripWidth, height, 0, 0, width - stripWidth, height);
    ctx.fillStyle = "rgba(2, 3, 2, 0.36)";
    ctx.fillRect(width - stripWidth, 0, stripWidth, height);

    for (let i = 0; i < normalizedValues.length; i += 1) {
      const value = normalizedValues[i];
      const y = height - (i / normalizedValues.length) * height;
      const bandHeight = Math.ceil(height / normalizedValues.length) + 1;
      ctx.fillStyle = this.colorWithAlpha(this.getPaletteColor(colors, value), 0.16 + value * 0.84);
      ctx.fillRect(width - stripWidth, y - bandHeight, stripWidth, bandHeight);
    }

    this.ctx.save();
    this.ctx.globalAlpha = 0.95;
    this.ctx.drawImage(this.spectrogramCanvas, 0, 0);
    this.ctx.restore();
  }
}
