/**
 * Synthesized cabin audio (ported from the Apollo build): SPS rumble
 * (dual low sines + filtered noise), RCS pops, low-fuel master alarm,
 * constant cabin hum. Web Audio only — no sample files.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private spsGain!: GainNode;
  private alarmGain!: GainNode;
  private alarmTimer: number | null = null;
  private lastRcs = 0;

  /** Must be called from a user gesture (autoplay policy). */
  init(): void {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);

    // Cabin hum.
    const hum = ctx.createOscillator();
    hum.frequency.value = 120;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.012;
    hum.connect(humGain).connect(this.master);
    hum.start();

    // SPS: two low sines + lowpassed noise behind one gate.
    this.spsGain = ctx.createGain();
    this.spsGain.gain.value = 0;
    this.spsGain.connect(this.master);
    for (const [freq, level] of [[65, 0.5], [25, 0.6]] as const) {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(this.spsGain);
      osc.start();
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx);
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 400;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.5;
    noise.connect(noiseFilter).connect(noiseGain).connect(this.spsGain);
    noise.start();

    this.alarmGain = ctx.createGain();
    this.alarmGain.gain.value = 0;
    this.alarmGain.connect(this.master);
  }

  /** Per-frame: engine gate follows throttle; alarm follows fuel fraction. */
  update(firing: boolean, throttle: number, fuelFraction: number): void {
    if (!this.ctx) return;
    const target = firing ? 0.1 + 0.25 * throttle : 0;
    this.spsGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);

    const lowFuel = fuelFraction > 0 && fuelFraction < 0.1;
    if (lowFuel && this.alarmTimer === null) {
      this.startAlarm();
    } else if (!lowFuel && fuelFraction > 0.15 && this.alarmTimer !== null) {
      this.stopAlarm();
    }
  }

  fireRcs(): void {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastRcs < 60) return;
    this.lastRcs = now;

    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 0.02);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    src.connect(bp).connect(g).connect(this.master);
    src.start();
  }

  private startAlarm(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 400;
    osc.connect(this.alarmGain);
    osc.start();
    this.alarmGain.gain.value = 0.05;
    let high = false;
    this.alarmTimer = window.setInterval(() => {
      high = !high;
      osc.frequency.value = high ? 600 : 400;
    }, 350);
    // Keep a handle so stopAlarm can kill the oscillator.
    (this.alarmGain as GainNode & { osc?: OscillatorNode }).osc = osc;
  }

  private stopAlarm(): void {
    if (this.alarmTimer !== null) {
      clearInterval(this.alarmTimer);
      this.alarmTimer = null;
    }
    this.alarmGain.gain.value = 0;
    const osc = (this.alarmGain as GainNode & { osc?: OscillatorNode }).osc;
    osc?.stop();
  }
}

function noiseBuffer(ctx: AudioContext, seconds = 1): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
