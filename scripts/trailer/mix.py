"""Trailer soundtrack: NASA voices (cut from the highlight reel) over a synthesized
score and sound design, ducked and mixed to one stereo WAV.

    python mix.py timeline.json highlights.mp3 out.wav
"""
import json, subprocess, sys
import numpy as np
from scipy import signal
import imageio_ffmpeg

SR = 48000
FF = imageio_ffmpeg.get_ffmpeg_exe()
rng = np.random.default_rng(1969)
T = json.load(open(sys.argv[1]))
REEL, OUT = sys.argv[2], sys.argv[3]
N = int(T['total'] * SR)
shots = {s['id']: s for s in T['shots']}
at = lambda sid: shots[sid]['start']
end = lambda sid: shots[sid]['start'] + shots[sid]['dur']


def st(n=N):
    return np.zeros((2, n), np.float32)


def place(buf, x, t, gain=1.0, pan=0.0):
    """Add mono or stereo x into buf at time t (s)."""
    i = int(round(t * SR))
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * np.sqrt(2), x * r * np.sqrt(2)])
    j0, j1 = max(0, i), min(buf.shape[1], i + x.shape[1])
    if j1 > j0:
        buf[:, j0:j1] += gain * x[:, j0 - i:j1 - i]


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def env_adsr(n, a, r, hold_to=None):
    t = np.arange(n) / SR
    dur = n / SR
    e = np.minimum(1, t / max(a, 1e-4))
    e *= np.clip((dur - t) / max(r, 1e-4), 0, 1)
    return e ** 1.6


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


def lowpass(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR / 2 - 100) / (SR / 2), 'low')
    return signal.lfilter(b, a, x, axis=-1).astype(np.float32)


def highpass(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high')
    return signal.lfilter(b, a, x, axis=-1).astype(np.float32)


def bandpass(x, f0, f1, order=2):
    b, a = signal.butter(order, [f0 / (SR / 2), f1 / (SR / 2)], 'band')
    return signal.lfilter(b, a, x, axis=-1).astype(np.float32)


# ---------------------------------------------------------------- voices
def reel(a, b):
    raw = subprocess.run([FF, '-v', 'error', '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-i', REEL, '-ac', '1', '-ar', str(SR),
                          '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).copy()
    f = int(0.012 * SR)
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    return x


def rms_speech(x):
    frames = x[: len(x) // 1024 * 1024].reshape(-1, 1024)
    r = np.sqrt((frames ** 2).mean(axis=1) + 1e-12)
    loud = r[r > np.percentile(r, 60)]
    return float(np.sqrt((loud ** 2).mean()))


voice = np.zeros(N, np.float32)
for v in T['voice']:
    parts = []
    for k, (a, b) in enumerate(v['segs']):
        parts.append(reel(a, b))
        if k < len(v['segs']) - 1:
            parts.append(np.zeros(int(v.get('gap', 0) * SR), np.float32))
    x = np.concatenate(parts)
    x = bandpass(x, 240, 3700)
    x *= (0.16 if not v.get('quiet') else 0.13) / max(rms_speech(x), 1e-6)
    x = np.tanh(x * 1.6) / 1.6  # gentle limiting of the radio peaks
    i = int(v['at'] * SR)
    voice[i:i + len(x)] += x[: N - i]

# ---------------------------------------------------------------- music
music = st()
wet = st()  # reverb send


def pad_note(m, dur, bright=4.0, a=1.8, r=2.6, detune=7, level=0.05):
    """Warm detuned additive saw, stereo."""
    t = tt(dur)
    out = np.zeros((2, len(t)), np.float32)
    f0 = midi(m)
    nh = max(1, min(14, int(6000 / f0)))
    for cents, pan in ((-detune, -0.7), (0, 0.0), (detune, 0.7)):
        f = f0 * 2 ** (cents / 1200)
        ph = rng.uniform(0, 2 * np.pi, nh)
        x = sum(np.sin(2 * np.pi * f * k * t + ph[k - 1]) * (1 / k) * np.exp(-(k - 1) / bright) for k in range(1, nh + 1))
        l, rr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        out[0] += x * l
        out[1] += x * rr
    trem = 1 + 0.06 * np.sin(2 * np.pi * rng.uniform(0.08, 0.2) * t + rng.uniform(0, 6))
    return out * env_adsr(len(t), a, r) * trem * level


def chord(notes, t0, t1, **kw):
    for m in notes:
        x = pad_note(m, t1 - t0, **kw)
        place(music, x, t0)
        place(wet, x, t0, 0.6)


def sub(m, t0, t1, level=0.12, a=2.0, r=2.5):
    t = tt(t1 - t0)
    x = np.sin(2 * np.pi * midi(m) * t) * env_adsr(len(t), a, r) * level
    place(music, x, t0)


def pluck(m, t0, level=0.05, tau=0.45, pan=0.0):
    t = tt(tau * 5)
    f = midi(m)
    x = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t))
    x *= np.exp(-t / tau) * np.minimum(1, t / 0.004) * level
    place(music, x, t0, pan=pan)
    place(wet, x, t0, 0.5, pan=pan)
    place(music, x * 0.35, t0 + 0.47, pan=-pan)  # ping-pong echo
    place(music, x * 0.12, t0 + 0.94, pan=pan)


def arp(t0, t1, notes, step, level=0.045, accel=None):
    t, k = t0, 0
    while t < t1:
        pan = 0.35 * np.sin(k * 1.7)
        pluck(notes[k % len(notes)], t, level * (1.0 if k % 4 == 0 else 0.7), pan=pan)
        k += 1
        t += step


def kick(t0, level=0.35):
    t = tt(0.6)
    f = 42 + 70 * np.exp(-t / 0.045)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.28) * level
    x[:int(0.004 * SR)] += rng.normal(0, 0.3, int(0.004 * SR)) * level
    place(music, x, t0)
    place(wet, x, t0, 0.15)


def tick(t0, level=0.03, pan=0.0):
    n = int(0.03 * SR)
    x = highpass(rng.normal(0, 1, n).astype(np.float32), 6000) * np.exp(-np.arange(n) / (0.006 * SR)) * level
    place(music, x, t0, pan=pan)


def impact(t0, level=0.9):
    t = tt(5.0)
    f = 28 + 40 * np.exp(-t / 0.25)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 1.6)
    noise = lowpass(rng.normal(0, 1, len(t)).astype(np.float32), 900) * np.exp(-t / 0.5) * 0.5
    x = (boom + noise) * level
    place(music, x, t0)
    place(wet, x, t0, 0.9)


def swell(t0, t1, level=0.3):
    """Reverse-cymbal swell that lands on t1."""
    t = tt(t1 - t0)
    x = highpass(rng.normal(0, 1, (2, len(t))).astype(np.float32), 2500) * (t / t[-1]) ** 3 * level
    x[:, -int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
    place(music, x, t0)
    place(wet, x, t0, 0.4)


def riser(t0, t1, level=0.15, f0=300, f1=5000):
    n = int((t1 - t0) * SR)
    x = rng.normal(0, 1, (2, n)).astype(np.float32)
    out = np.zeros_like(x)
    blk = 2048
    zi = None
    for i in range(0, n, blk):
        u = i / n
        fc = f0 * (f1 / f0) ** u
        b, a = signal.butter(2, fc / (SR / 2), 'low')
        if zi is None:
            zi = np.zeros((2, max(len(a), len(b)) - 1))
        seg, zi = signal.lfilter(b, a, x[:, i:i + blk], axis=-1, zi=zi)
        out[:, i:i + blk] = seg
    out *= (np.linspace(0, 1, n) ** 2) * level
    place(music, out, t0)
    place(wet, out, t0, 0.5)


def shimmer(t0, t1, notes, level=0.012):
    for m in notes:
        t = tt(t1 - t0)
        x = np.sin(2 * np.pi * midi(m) * t) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(0.1, 0.3) * t + rng.uniform(0, 6)))
        x *= env_adsr(len(t), 2.5, 3.0) * level
        place(wet, x, t0, 1.0, pan=rng.uniform(-0.8, 0.8))


# Chords (MIDI). D minor home, F major for the landing.
Dm = [38, 45, 53, 57, 60, 64]
Dm_low = [26, 38, 45, 50, 53]
Bb = [34, 46, 50, 53, 57, 62]
F = [29, 41, 48, 57, 60, 65, 67]
Fwide = [29, 41, 48, 53, 57, 60, 64, 67, 72]
C_E = [40, 48, 55, 60, 62, 67]
Csus = [36, 48, 55, 60, 62, 67]
Gm = [31, 43, 50, 55, 58, 62]
Dsus = [38, 45, 50, 55, 57, 62]

# --- cold open: drone and a slow climb to the launch
chord([26, 38, 45], 0.0, 14.8, bright=2.0, a=4.0, r=1.2, level=0.05)
sub(26, 0.0, 14.8, level=0.10, a=5, r=1.0)
shimmer(2.0, 14.6, [74, 81], level=0.008)
riser(8.5, 14.4, level=0.10, f0=200, f1=3000)
swell(14.9, 17.0, level=0.35)
impact(17.0, 1.0)
chord(Dm_low, 17.0, 24.5, bright=3.0, a=0.05, r=5.0, level=0.07)

# --- act 1: outbound, a gentle pulse (96 bpm eighths)
e8 = 60 / 96 / 2
for c, a, b in ((Dm, at('B'), at('C')), (Bb, at('C'), at('D')), (F, at('D'), at('E')), (Csus, at('E'), at('F')), (Dm, at('F'), at('G'))):
    chord(c, a - 0.3, b + 1.2, bright=3.5, a=1.2, r=2.0, level=0.034)
    sub(c[0] + 12 if c[0] < 30 else c[0], a, b + 0.8, level=0.06, a=0.8, r=1.2)
arp(at('B'), at('F'), [62, 69, 72, 74, 69, 65], e8, level=0.030)
arp(at('C'), at('F'), [81, 77], e8 * 4, level=0.012)

# --- descent: a heartbeat that quickens to contact, ticking, a rising cluster
t_desc, t_contact = at('G'), end('K')
sub(26, t_desc, t_contact + 0.05, level=0.12, a=1.5, r=0.05)
chord([38, 45, 50, 53], t_desc, t_contact + 0.05, bright=2.5, a=2.0, r=0.05, level=0.03)
chord([62, 63, 69], at('J'), t_contact + 0.05, bright=2.0, a=5.0, r=0.05, level=0.018)
riser(at('I'), t_contact, level=0.12, f0=250, f1=6000)
t, beat = t_desc + 0.4, 0
while t < t_contact - 0.15:
    u = (t - t_desc) / (t_contact - t_desc)
    period = 0.95 - 0.52 * u ** 1.3
    kick(t, 0.30 + 0.15 * u)
    kick(t + 0.19, 0.14 + 0.08 * u)
    for s in range(1, 4):
        if t + s * period / 4 < t_contact - 0.1:
            tick(t + s * period / 4, 0.014 + 0.02 * u, pan=0.5 * (-1) ** s)
    t += period
    beat += 1
arp(at('H'), t_contact - 0.2, [74, 77, 74, 81], 0.26, level=0.018)

# --- contact light: silence. Then the landing, warm and slow.
t_l = at('L') + 0.4
prog = [(F, 4.6), (C_E, 4.6), (Dm, 4.6), (Bb, 4.6), (Fwide, 5.0)]
t = t_l
for c, d in prog:
    chord(c, t - 0.2, t + d + 1.6, bright=3.0, a=1.6, r=2.4, level=0.036)
    t += d
sub(29, t_l, t_l + 4.8, level=0.07)
shimmer(t_l + 1.0, at('N') + 1.0, [77, 81, 84], level=0.01)

# --- act 3: liftoff and home
t_lift = 99.5
chord(Gm, at('N'), t_lift + 0.4, bright=2.5, a=1.5, r=0.6, level=0.03)
swell(t_lift - 1.8, t_lift, level=0.22)
impact(t_lift, 0.55)
q = 60 / 112 / 2
seq = [(Bb, 4.6), (F, 4.6), (C_E, 4.6), (Dm, 4.6), (Bb, 4.6), (Csus, 3.6)]
t = t_lift
for c, d in seq:
    if t >= end('Q'):
        break
    chord(c, t - 0.1, min(t + d, end('Q')) + 0.8, bright=4.0, a=0.6, r=1.0, level=0.034)
    t += d
arp(t_lift, end('Q'), [62, 65, 69, 74, 69, 65, 70, 74], q, level=0.03)
t = at('O')
while t < end('Q') - 0.2:
    kick(t, 0.26)
    tick(t + q, 0.02, 0.4)
    tick(t + 2 * q, 0.012, -0.4)
    tick(t + 3 * q, 0.02, 0.4)
    t += 4 * q
riser(at('Q'), end('Q'), level=0.16, f0=300, f1=7000)
swell(end('Q') - 1.2, end('Q'), 0.25)
impact(end('Q'), 0.6)

# --- chutes, then the finale: resolve to F on "accomplished"
chord(Fwide, at('R'), at('S') + 1.0, bright=3.0, a=0.3, r=2.0, level=0.03)
t = at('S')
for c, d in ((Bb, 4.2), (C_E, 3.5), (Dm, 2.8)):
    chord(c, t - 0.2, t + d + 1.2, bright=3.2, a=1.5, r=1.6, level=0.036)
    t += d
riser(at('S') + 6.0, 137.0, level=0.10, f0=200, f1=4000)
t_acc = 137.0
swell(t_acc - 1.6, t_acc, 0.28)
impact(t_acc, 0.8)
chord(Fwide, t_acc, T['total'] - 0.3, bright=3.8, a=0.05, r=6.0, level=0.045)
sub(29, t_acc, T['total'] - 0.3, level=0.10, a=0.1, r=6.0)
shimmer(t_acc, T['total'], [81, 84, 89], level=0.012)

# ---------------------------------------------------------------- sound design
sfx = st()


def brown(n, leak=0.995):
    x = rng.normal(0, 1, n).astype(np.float32)
    return signal.lfilter([1], [1, -leak], x).astype(np.float32) * (1 - leak) * 8


def engine(t0, t1, level, fc=260, a=0.5, r=0.4, flutter=0.12):
    n = int((t1 - t0) * SR)
    x = np.stack([lowpass(brown(n), fc, 4), lowpass(brown(n), fc, 4)])
    t = np.arange(n) / SR
    x *= (1 + flutter * np.sin(2 * np.pi * 7.3 * t) * np.sin(2 * np.pi * 3.1 * t))
    x *= env_adsr(n, a, r) * level
    place(sfx, x, t0)


def rcs(t0, level=0.08):
    n = int(0.09 * SR)
    x = bandpass(rng.normal(0, 1, n).astype(np.float32), 900, 3200) * np.exp(-np.arange(n) / (0.02 * SR)) * level
    place(sfx, x, t0, pan=rng.uniform(-0.6, 0.6))


def alarm(t0, t1, level=0.045):
    """The game's master alarm: a square wave flipping 750/2000 Hz every 0.4 s."""
    t = tt(t1 - t0)
    f = np.where((t // 0.4) % 2 == 0, 750.0, 2000.0)
    x = signal.square(2 * np.pi * np.cumsum(f) / SR).astype(np.float32)
    x = lowpass(x, 5000) * env_adsr(len(t), 0.01, 0.05) * level
    place(sfx, x, t0)


def blip(t0, f=1320, level=0.05):
    t = tt(0.09)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.03) * level
    place(sfx, x, t0)


# Launch: the rumble builds under the countdown and fills the black
engine(10.0, 17.3, 0.55, fc=160, a=4.5, r=0.3, flutter=0.2)
engine(14.4, 17.2, 0.35, fc=700, a=2.0, r=0.2, flutter=0.3)
engine(17.0, 21.0, 0.30, fc=120, a=0.02, r=3.8)
engine(at('B'), end('B'), 0.20, fc=220)                     # S-IVB
engine(at('E'), end('E'), 0.16, fc=260)                     # SPS
for k in range(7):
    rcs(at('F') + 0.3 + k * 0.42 + rng.uniform(0, 0.12))
engine(at('G'), end('K') - 0.02, 0.15, fc=300, a=0.8, r=0.03)  # DPS, dead stop at contact
alarm(at('H'), at('H') + 1.5)
blip(at('J') + 2.5, 1320)
blip(at('J') + 2.58, 1760)
alarm(at('I'), at('I') + 0.8, 0.035)
engine(t_lift, end('N'), 0.22, fc=320, a=0.05)            # APS
for k in range(9):
    rcs(at('O') + 0.2 + k * 0.5 + rng.uniform(0, 0.2), 0.06)
engine(at('Q'), end('Q'), 0.40, fc=900, a=1.5, r=0.15, flutter=0.35)  # entry plasma
engine(at('R'), end('R'), 0.10, fc=1200, a=0.3, r=1.5, flutter=0.1)  # wind under the chutes

# ---------------------------------------------------------------- reverb, duck, mix
def reverb_ir(dur=3.4, decay=0.95):
    t = tt(dur)
    ir = rng.normal(0, 1, (2, len(t))).astype(np.float32) * np.exp(-t / decay)
    ir = lowpass(ir, 5000)
    ir[:, :int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))


ir = reverb_ir()
rev = np.stack([signal.oaconvolve(wet[c], ir[c])[:N] for c in range(2)]).astype(np.float32)
music_bus = (music + rev * 0.55) * 0.6

# Duck the score under the voices.
env = np.abs(voice)
env = signal.lfilter([1 - np.exp(-1 / (0.03 * SR))], [1, -np.exp(-1 / (0.03 * SR))], env)
gain = 1 - 0.6 * np.clip(env / 0.03, 0, 1)
gain = signal.lfilter([1 - np.exp(-1 / (0.35 * SR))], [1, -np.exp(-1 / (0.35 * SR))], gain).astype(np.float32)

import os
if os.environ.get('STEMS'):
    for name, x in (('voice', np.stack([voice, voice])), ('music', music_bus), ('sfx', sfx)):
        y = (np.clip(x.T / max(1e-6, np.abs(x).max()) * 0.9, -1, 1) * 32767).astype(np.int16)
        subprocess.run([FF, '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', f'stem-{name}.wav'], input=y.tobytes(), check=True)
mixbuf = music_bus * gain + sfx * 0.7 * (0.45 + 0.55 * gain) + np.stack([voice, voice]) * 1.0

def db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
speech = np.abs(voice) > 0
win = np.convolve(speech.astype(np.float32), np.ones(4800) / 4800, 'same') > 0.3
bed = highpass((music_bus * gain + sfx * 0.7 * (0.45 + 0.55 * gain)).mean(axis=0), 120)  # rough perceptual weighting
print(f'during speech (weighted): voice {db(voice[win]):.1f} dB, bed {db(bed[win]):.1f} dB -> margin {db(voice[win]) - db(bed[win]):.1f} dB')
for name, (a0, b0) in {'open': (0, 14.4), 'act1': (21.6, 45.9), 'descent': (45.9, 69.4), 'landed': (72, 95), 'act3': (95.4, 126), 'finale': (126.4, 147)}.items():
    sl = slice(int(a0 * SR), int(b0 * SR))
    print(f'  {name:8s} music {db(music_bus[:, sl] * gain[sl]):6.1f}  sfx {db(sfx[:, sl]):6.1f}  voice {db(voice[sl]):6.1f}')
peak = np.abs(mixbuf).max()
mixbuf *= 0.89 / peak
print(f'peak before norm {peak:.2f}; voice rms {np.sqrt((voice ** 2).mean()):.4f}')
pcm = (np.clip(mixbuf.T, -1, 1) * 32767).astype(np.int16)
subprocess.run([FF, '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', OUT], input=pcm.tobytes(), check=True)
print('wrote', OUT)
