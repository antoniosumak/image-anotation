"""Original 8-bar, 120 BPM loop, synthesized from scratch (royalty-free by construction).

Writes music.wav (24.000 s, seamless loop) and grid.json (measured beat grid).
"""
import json
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
BPM = 120
BEAT = 60 / BPM
BARS = 12
T = BARS * 4 * BEAT  # 24 s
TAIL = 3.0
N = int((T + TAIL) * SR)
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    j = min(N, i + len(sig))
    if j <= i:
        return
    lg = gain * np.cos((pan + 1) * np.pi / 4) * np.sqrt(2)
    rg = gain * np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
    L[i:j] += sig[: j - i] * lg
    R[i:j] += sig[: j - i] * rg


def filt(x, kind, f, order=2):
    sos = butter(order, f, btype=kind, fs=SR, output="sos")
    return sosfilt(sos, x)


def tt(d):
    return np.arange(int(d * SR)) / SR


def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)


# ---- drums -----------------------------------------------------------------
def kick():
    t = tt(0.45)
    f = 48 + 110 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7.5)
    click = filt(rng.standard_normal(len(t)), "highpass", 2500) * np.exp(-t * 400) * 0.25
    return np.tanh((body + click) * 1.6) * 0.9


def clap():
    t = tt(0.35)
    n = rng.standard_normal(len(t))
    env = np.zeros(len(t))
    for k, off in enumerate([0, 0.011, 0.022]):
        env += np.where(t >= off, np.exp(-(t - off) * (160 if k < 2 else 16)), 0)
    return filt(n * env, "bandpass", [900, 3200]) * 0.5


def hat(open_=False):
    t = tt(0.25 if open_ else 0.06)
    n = rng.standard_normal(len(t))
    return filt(n, "highpass", 7000) * np.exp(-t * (14 if open_ else 70)) * 0.22


def shaker():
    t = tt(0.08)
    n = rng.standard_normal(len(t))
    env = np.sin(np.pi * np.clip(t / 0.08, 0, 1)) ** 2
    return filt(n, "bandpass", [4500, 9000]) * env * 0.06


K, C = kick(), clap()
for b in range(BARS * 4):
    t0 = b * BEAT
    add(K, t0, 1.25 if b % 4 == 0 else 0.9)
    if b % 4 in (1, 3):
        add(C, t0, 0.8, 0.05)
    add(hat(open_=(b % 4 == 3)), t0 + BEAT / 2, 0.9 if b % 4 != 3 else 0.7, 0.25)
    for s in (1, 3):
        add(shaker(), t0 + s * BEAT / 4, 1.0, -0.3)

# a soft cymbal swell into the loop point, so the downbeat lands
t = tt(1.0)
sw = filt(rng.standard_normal(len(t)), "highpass", 5000) * (t / 1.0) ** 3 * 0.10
add(sw, T - 1.0, 1.0)
add(filt(rng.standard_normal(int(1.6 * SR)), "highpass", 4000) * np.exp(-tt(1.6) * 3) * 0.08, 0.0)
add(filt(rng.standard_normal(int(1.6 * SR)), "highpass", 4000) * np.exp(-tt(1.6) * 3) * 0.08, T)

# ---- harmony ---------------------------------------------------------------
# Fmaj9 | Am7 | Dm9 | Bbmaj9 | Dm9 | Bbmaj9 (two bars each): the last two
# repeat as a vamp under the send, and Bb back to F resolves the loop
CHORDS = [
    (41, [57, 60, 64, 67]),  # F  : A C E G
    (45, [55, 60, 64, 67]),  # Am : G C E (+G)
    (38, [57, 60, 64, 65]),  # Dm : A C E F
    (46, [57, 62, 65, 69]),  # Bb : A D F A
]


def sidechain(t0, dur):
    """Gain curve ducked under every kick."""
    t = tt(dur) + t0
    ph = (t % BEAT) / BEAT
    return 0.45 + 0.55 * (1 - np.exp(-ph * 9))


def pad(notes, t0, dur):
    t = tt(dur + 1.2)
    out = np.zeros(len(t))
    for m in notes:
        for det in (-0.07, 0.07):
            f = mtof(m + det)
            saw = 2 * ((t * f) % 1) - 1
            out += saw
    out = filt(out, "lowpass", 1400, 2)
    att = np.clip(t / 0.25, 0, 1)
    rel = np.clip((dur + 1.2 - t) / 1.2, 0, 1)
    return out * att * rel * 0.018 * sidechain(t0, dur + 1.2)


def ep(notes, t0, dur=0.45):
    t = tt(dur + 0.6)
    out = np.zeros(len(t))
    for m in notes:
        f = mtof(m)
        out += np.sin(2 * np.pi * f * t + 0.8 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 6))
    return out * np.exp(-t * 4.5) * 0.05


def bass(m, dur):
    t = tt(dur)
    f = mtof(m)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 10)
    env = np.clip(t / 0.005, 0, 1) * np.clip((dur - t) / 0.03, 0, 1) * np.exp(-t * 3)
    return np.tanh(x * env * 1.3) * 0.32


def pluck(m, dur=0.3):
    t = tt(dur)
    f = mtof(m)
    x = (2 * ((t * f) % 1) - 1)
    x = filt(x * np.exp(-t * 14), "lowpass", 3200)
    return x * 0.05


PROG = [0, 1, 2, 3, 2, 3]
assert len(PROG) * 2 == BARS
for ci, chord in enumerate(PROG):
    root, notes = CHORDS[chord]
    bar0 = ci * 2
    t0 = bar0 * 4 * BEAT
    add(pad(notes, t0, 8 * BEAT), t0, 1.0)
    for b in range(8):
        tb = t0 + b * BEAT
        # off-beat bass, house style
        add(bass(root, BEAT * 0.42), tb + BEAT / 2, 1.0)
        if b % 2 == 1:
            add(bass(root + 12, BEAT * 0.2), tb + BEAT * 0.75, 0.55)
        # electric-piano stabs on the & of 2 and on 4
        if b % 4 in (1, 3):
            add(ep(notes, tb + BEAT * (0.5 if b % 4 == 1 else 0.0)), tb + BEAT * (0.5 if b % 4 == 1 else 0.0), 0.9, -0.15)
    # arpeggio in the second half
    if ci >= 2 or True:
        arp = notes + [notes[1] + 12]
        for s in range(32):
            if ci < 2 and s % 2 == 1:
                continue
            m = arp[(s * 3) % len(arp)] + 12
            add(pluck(m), t0 + s * BEAT / 4, 0.8 if ci >= 2 else 0.5, 0.35 if s % 2 else -0.35)

# ---- fold the tail into the head so the loop is seamless ---------------------
n = int(T * SR)
L[:N - n] += L[n:]
R[:N - n] += R[n:]
L, R = L[:n], R[:n]

mix = np.stack([L, R], 1)
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= 0.72 / np.max(np.abs(mix))
wavfile.write("music.wav", SR, (mix * 32767).astype(np.int16))

# ---- analyse the beat grid ---------------------------------------------------
mono = mix.mean(1)
hop, win = 256, 1024
frames = 1 + (len(mono) - win) // hop
w = np.hanning(win)
spec = np.abs(np.fft.rfft(np.stack([mono[i * hop:i * hop + win] * w for i in range(frames)]), axis=1))
logspec = np.log1p(spec * 10)
flux = np.maximum(0, np.diff(logspec, axis=0)).sum(1)
flux = np.concatenate([[0], flux])
flux -= flux.mean()
fps = SR / hop
ac = np.correlate(flux, flux, "full")[len(flux) - 1:]
lags = np.arange(len(ac)) / fps
bpms = 60 / np.maximum(lags, 1e-9)
sel = (bpms > 90) & (bpms < 150)
bpm = float(bpms[sel][np.argmax(ac[sel])])
period = 60 / bpm
# low band (kick) onsets carry the beat; hats and bass sit on the off-beats
low = np.maximum(0, np.diff(logspec[:, :12], axis=0)).sum(1)
low = np.concatenate([[0], low])
def comb(env, per, off):
    ts = off + np.arange(0, T - per, per)
    return np.interp(ts * fps, np.arange(len(env)), env).sum()
# refine tempo and phase jointly on a fine grid around the autocorrelation estimate
best = (-1, None, None)
for b in np.arange(bpm - 2, bpm + 2, 0.01):
    per = 60 / b
    for off in np.arange(0, per, 0.002):
        sc = comb(low, per, off)
        if sc > best[0]:
            best = (sc, b, off)
_, bpm, phase = best
period = 60 / bpm
beats = phase + np.arange(int(round(T / period))) * period
# downbeat: the beat position (mod 4) with the most full-band onset energy (chord changes, swell)
sub = filt(mono, "lowpass", 100, 4)
def hit(b):
    i = int(b * SR)
    return float(np.max(np.abs(sub[max(0, i - 400):i + 2000])))
pos_energy = [sum(hit(b) for b in beats[p::4]) for p in range(4)]
down = int(np.argmax(pos_energy))
# each beat's measured kick peak
peaks = []
for b in beats:
    i = int(b * SR)
    lo = max(0, i - 600)
    seg = np.abs(mono[lo:i + 1500])
    peaks.append((lo + int(np.argmax(seg))) / SR)
peak_off = float(np.median(np.array(peaks) - beats))
grid = {
    "bpm": round(float(bpm), 3),
    "period": float(period),
    "phase": float(phase),
    "downbeat_index": down,
    "first_downbeat": float(beats[down]),
    "kick_peak_offset": peak_off,
    "beats": [round(float(b), 4) for b in beats],
}
# roll the (seamless) loop so the downbeat's measured kick peak sits at t = 0
down_peak = peaks[down] % period
shift = int(round(down_peak * SR))
mix = np.roll(mix, -shift, axis=0)
wavfile.write("music.wav", SR, (mix * 32767).astype(np.int16))
grid["applied_shift_s"] = shift / SR
json.dump(grid, open("grid.json", "w"), indent=1)
print({k: v for k, v in grid.items() if k != "beats"})
