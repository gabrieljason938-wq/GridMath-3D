export interface ThunderTriggerOptions {
  distanceNorm?: number;
  pan?: number;
}

/**
 * Pure Web Audio API thunderstorm synthesizer (zero external audio dependencies).
 * Generates continuous stereo rain ambience and distance-delayed rolling thunder claps.
 */
export class StormAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private pendingTimers = new Set<number>();
  private enabled = false;
  private rainActive = false;
  private disposed = false;

  private ensureContext(): AudioContext | null {
    if (this.disposed || typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createPinkNoiseBuffer(this.ctx, 4.0);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private createPinkNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * seconds));
    const buffer = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      }
    }

    return buffer;
  }

  private startRainBed(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer || this.rainSource) return;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 260;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3400;

    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.24;

    src.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(rainGain);
    rainGain.connect(this.masterGain);

    src.start();
    this.rainSource = src;
    this.rainGain = rainGain;
  }

  private syncGain(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const target = this.enabled && this.rainActive ? 0.55 : 0;

    if (target > 0) {
      this.startRainBed();
    }

    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(target, now, target > 0 ? 0.28 : 0.14);

    if (target === 0) {
      this.clearPendingThunder();
    }
  }

  private clearPendingThunder(): void {
    this.pendingTimers.forEach((id) => window.clearTimeout(id));
    this.pendingTimers.clear();
  }

  public setEnabled(nextEnabled: boolean): void {
    this.enabled = nextEnabled;
    if (nextEnabled) {
      this.ensureContext();
    }
    this.syncGain();
  }

  public setRainActive(active: boolean): void {
    this.rainActive = active;
    this.syncGain();
  }

  public triggerThunder(options: ThunderTriggerOptions = {}): void {
    if (this.disposed || !this.enabled || !this.rainActive) return;
    const distanceNorm = Math.max(0, Math.min(1, options.distanceNorm ?? 0.35));
    const pan = Math.max(-1, Math.min(1, options.pan ?? 0));
    const delayMs = Math.round(180 + distanceNorm * 720);

    const timerId = window.setTimeout(() => {
      this.pendingTimers.delete(timerId);
      this.playThunderEnvelope(distanceNorm, pan);
    }, delayMs);

    this.pendingTimers.add(timerId);
  }

  private playThunderEnvelope(distanceNorm: number, pan: number): void {
    if (this.disposed || !this.enabled || !this.rainActive) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const duration = 2.6 + distanceNorm * 1.4;
    const peak = 0.88 - distanceNorm * 0.34;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.playbackRate.value = 0.55 + (1 - distanceNorm) * 0.2;

    // Initial high-mid lightning crackle + swept deep sub-bass rumble
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const startFreq = 920 - distanceNorm * 480;
    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 0.38);
    filter.frequency.exponentialRampToValueAtTime(64, now + duration);
    filter.Q.value = 1.1;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(peak, now + 0.045);
    env.gain.exponentialRampToValueAtTime(peak * 0.36, now + 0.34);
    // Secondary rolling echo peak
    env.gain.linearRampToValueAtTime(peak * 0.58, now + 0.62);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(env);

    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan * 0.75, now);
      env.connect(panner);
      panner.connect(this.masterGain);
    } else {
      env.connect(this.masterGain);
    }

    src.start(now, Math.random() * 1.5);
    src.stop(now + duration + 0.05);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      env.disconnect();
    };
  }

  public dispose(): void {
    this.disposed = true;
    this.enabled = false;
    this.rainActive = false;
    this.clearPendingThunder();

    if (this.rainSource) {
      try {
        this.rainSource.stop();
      } catch {
        // Ignore already-stopped source
      }
      this.rainSource.disconnect();
      this.rainSource = null;
    }
    if (this.rainGain) {
      this.rainGain.disconnect();
      this.rainGain = null;
    }
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.noiseBuffer = null;
  }
}
