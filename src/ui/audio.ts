/** A voice line asked for this long ago (ms, real time) is no longer news: skip it. */
const VOICE_STALE_MS = 8_000;

/**
 * Synthesized cabin audio (harvested from the Apollo build): engine rumble,
 * RCS pops, the master alarm — plus quindar tones bracketing each CAPCOM
 * call, and the real Apollo 11 air-to-ground at the big moments. Web Audio
 * only; silence is part of the design.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private engine!: GainNode;
  private engineFilter!: BiquadFilterNode;
  private alarm: { osc: OscillatorNode; timer: number } | null = null;
  private lastRcs = 0;
  private voiceGain!: GainNode;
  private readonly clips = new Map<string, Promise<AudioBuffer | null>>();
  private voiceQueue: Promise<void> = Promise.resolve();

  /** Must be called from a user gesture (autoplay policy). */
  init(): void {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.45;
    this.master.connect(ctx.destination);
    this.voiceGain = ctx.createGain();
    this.voiceGain.gain.value = 1.6;
    this.voiceGain.connect(this.master);

    const hum = ctx.createOscillator();
    hum.frequency.value = 118;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.008;
    hum.connect(humGain).connect(this.master);
    hum.start();

    // Engine: low sines plus low-passed noise behind one gate.
    this.engine = ctx.createGain();
    this.engine.gain.value = 0;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 380;
    this.engineFilter.connect(this.engine).connect(this.master);
    for (const [f, level] of [[31, 0.7], [62, 0.35]] as const) {
      const osc = ctx.createOscillator();
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(this.engine);
      osc.start();
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx, 2);
    noise.loop = true;
    const ng = ctx.createGain();
    ng.gain.value = 0.9;
    noise.connect(ng).connect(this.engineFilter);
    noise.start();
  }

  /** Per frame: engine follows thrust; `size` 0..1 opens the filter (J-2 ≫ APS). */
  update(firing: boolean, throttle: number, size: number, alarm: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engine.gain.setTargetAtTime(firing ? 0.12 + 0.28 * throttle : 0, t, firing ? 0.06 : 0.03);
    this.engineFilter.frequency.setTargetAtTime(220 + 520 * size, t, 0.2);
    if (alarm && !this.alarm) this.startAlarm();
    if (!alarm && this.alarm) this.stopAlarm();
  }

  rcs(): void {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastRcs < 70) return;
    this.lastRcs = now;
    this.blip(1800, 0.05, 0.12, 'bandpass');
  }

  /**
   * Play a mission-audio clip (public/audio/apollo11/<id>.mp3). Lines queue
   * behind the one playing, and one that waited too long (time warp) is
   * dropped rather than played late.
   */
  voice(id: string): void {
    if (!this.ctx) return;
    const asked = performance.now();
    const clip = this.clip(id);
    this.voiceQueue = this.voiceQueue.then(async () => {
      const buffer = await clip;
      if (!buffer || !this.ctx || performance.now() - asked > VOICE_STALE_MS) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.voiceGain);
      await new Promise<void>((done) => {
        src.onended = () => done();
        src.start();
      });
    });
  }

  private clip(id: string): Promise<AudioBuffer | null> {
    let clip = this.clips.get(id);
    if (!clip) {
      clip = fetch(`${import.meta.env.BASE_URL}audio/apollo11/${id}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
        .then((data) => this.ctx!.decodeAudioData(data))
        .catch(() => null); // missing audio never stops the flight
      this.clips.set(id, clip);
    }
    return clip;
  }

  /** Quindar: the 2525 Hz intro tone of a CAPCOM transmission. */
  quindar(): void {
    this.tone(2525, 0.25, 0.05);
  }

  /** Soft confirmation blip for good events. */
  chime(): void {
    this.tone(1320, 0.08, 0.04);
    setTimeout(() => this.tone(1760, 0.1, 0.035), 90);
  }

  private tone(freq: number, seconds: number, level: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(level, ctx.currentTime + 0.01);
    g.gain.setValueAtTime(level, ctx.currentTime + seconds - 0.02);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + seconds);
    osc.connect(g).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + seconds + 0.05);
  }

  private blip(freq: number, seconds: number, level: number, type: BiquadFilterType): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, seconds);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  private startAlarm(): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 750;
    const g = ctx.createGain();
    g.gain.value = 0.025;
    osc.connect(g).connect(this.master);
    osc.start();
    let hi = false;
    const timer = window.setInterval(() => {
      hi = !hi;
      osc.frequency.value = hi ? 2000 : 750;
    }, 400);
    this.alarm = { osc, timer };
  }

  private stopAlarm(): void {
    if (!this.alarm) return;
    clearInterval(this.alarm.timer);
    this.alarm.osc.stop();
    this.alarm = null;
  }
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
