export class PerformanceMeter {
  private renderFrameCount = 0;
  private audioFrameCount = 0;
  private lastRenderMetricTime = performance.now();
  private lastAudioMetricTime = performance.now();
  private renderFps = 0;
  private audioFps = 0;

  constructor(private readonly readout: HTMLOutputElement) {}

  registerAudioFrame(): void {
    this.audioFrameCount += 1;
  }

  update(now: number): void {
    this.renderFrameCount += 1;

    if (now - this.lastRenderMetricTime >= 1000) {
      this.renderFps = Math.round((this.renderFrameCount * 1000) / (now - this.lastRenderMetricTime));
      this.renderFrameCount = 0;
      this.lastRenderMetricTime = now;
    }

    if (now - this.lastAudioMetricTime >= 1000) {
      this.audioFps = Math.round((this.audioFrameCount * 1000) / (now - this.lastAudioMetricTime));
      this.audioFrameCount = 0;
      this.lastAudioMetricTime = now;
    }

    this.readout.textContent = `VIS ${String(this.renderFps).padStart(2, "0")} / AUD ${String(this.audioFps).padStart(2, "0")}`;
  }
}
