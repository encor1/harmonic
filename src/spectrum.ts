import { getBars, type UiElements } from "./dom";
import type { NativeSpectrum } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function averageValues(values: number[], start: number, end: number): number {
  const safeStart = clamp(start, 0, values.length);
  const safeEnd = clamp(end, safeStart, values.length);
  let sum = 0;

  for (let index = safeStart; index < safeEnd; index += 1) {
    sum += values[index] || 0;
  }

  return sum / Math.max(1, safeEnd - safeStart);
}

function getInterpolatedGain(progress: number, gains: number[]): number {
  const scaled = progress * (gains.length - 1);
  const low = Math.floor(scaled);
  const high = Math.min(gains.length - 1, low + 1);
  const mix = scaled - low;
  return gains[low] * (1 - mix) + gains[high] * mix;
}

function softLimit(value: number): number {
  const knee = 132;

  if (value <= knee) {
    return value;
  }

  return knee + (205 - knee) * (1 - Math.exp((knee - value) / 120));
}

function balanceSpectrum(values: number[]): number[] {
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

function enhanceValues(values: number[]): number[] {
  if (!values.length) {
    return values;
  }

  const balancedValues = balanceSpectrum(values);

  return balancedValues.map((value, index) => {
    const left = balancedValues[Math.max(0, index - 1)] || 0;
    const right = balancedValues[Math.min(balancedValues.length - 1, index + 1)] || 0;
    const neighbor = Math.max(left, right) * 0.08;
    return softLimit(value + neighbor);
  });
}

type AudioByteArray = Uint8Array<ArrayBuffer>;

interface AnalyzerBinRangeCache {
  bars: number;
  frequencyDataLength: number;
  sampleRate: number;
  ranges: Array<{ low: number; high: number }>;
}

let analyzerBinRangeCache: AnalyzerBinRangeCache | null = null;

function averageBin(frequencyData: AudioByteArray, start: number, end: number): number {
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

function frequencyToBin(audioContext: AudioContext, frequencyData: AudioByteArray, frequency: number): number {
  const nyquist = audioContext.sampleRate / 2;
  const index = Math.round((frequency / nyquist) * frequencyData.length);
  return Math.max(0, Math.min(frequencyData.length - 1, index));
}

function getAnalyzerBinRanges(audioContext: AudioContext, frequencyData: AudioByteArray, bars: number): Array<{ low: number; high: number }> {
  const sampleRate = audioContext.sampleRate;

  if (
    analyzerBinRangeCache &&
    analyzerBinRangeCache.bars === bars &&
    analyzerBinRangeCache.frequencyDataLength === frequencyData.length &&
    analyzerBinRangeCache.sampleRate === sampleRate
  ) {
    return analyzerBinRangeCache.ranges;
  }

  const minFrequency = 35;
  const maxFrequency = Math.min(18_000, sampleRate / 2);
  const ranges: Array<{ low: number; high: number }> = [];

  for (let index = 0; index < bars; index += 1) {
    const lowProgress = index / bars;
    const highProgress = (index + 1) / bars;
    const lowFrequency = minFrequency * (maxFrequency / minFrequency) ** lowProgress;
    const highFrequency = minFrequency * (maxFrequency / minFrequency) ** highProgress;
    const low = frequencyToBin(audioContext, frequencyData, lowFrequency);
    const high = frequencyToBin(audioContext, frequencyData, highFrequency);
    ranges.push({ low, high: Math.max(low + 1, high + 1) });
  }

  analyzerBinRangeCache = {
    bars,
    frequencyDataLength: frequencyData.length,
    sampleRate,
    ranges,
  };

  return ranges;
}

export function getAnalyzerValues(
  ui: UiElements,
  audioContext: AudioContext,
  analyser: AnalyserNode,
  frequencyData: AudioByteArray,
): number[] {
  const bars = getBars(ui);
  const binRanges = getAnalyzerBinRanges(audioContext, frequencyData, bars);
  const values: number[] = [];

  analyser.getByteFrequencyData(frequencyData);

  for (let index = 0; index < bars; index += 1) {
    const range = binRanges[index];
    values.push(averageBin(frequencyData, range.low, range.high));
  }

  return enhanceValues(values);
}

export function getNativeValues(ui: UiElements, nativeSpectrum: NativeSpectrum | null): number[] {
  const bands = nativeSpectrum?.bands || [];
  const bars = getBars(ui);

  if (!bands.length) {
    return [];
  }

  const values: number[] = [];

  for (let index = 0; index < bars; index += 1) {
    const position = (index / Math.max(1, bars - 1)) * (bands.length - 1);
    const low = Math.floor(position);
    const high = Math.min(bands.length - 1, low + 1);
    const mix = position - low;
    values.push(bands[low] * (1 - mix) + bands[high] * mix);
  }

  return enhanceValues(values);
}
