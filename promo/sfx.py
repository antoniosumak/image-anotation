"""UI sounds, synthesized, each placed so its measured peak lands on its event."""
import json
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
T = 24.0  # promo.src.html's loop: 12 bars at 120 BPM
N = int(T * SR)


def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output="sos"), x)


def tt(d):
    return np.arange(int(d * SR)) / SR


def noise(d, seed=0):
    return np.random.default_rng(seed).standard_normal(int(d * SR))


def key(seed=0, body=150, gain=1.0):
    t = tt(0.09)
    click = filt(noise(0.09, seed), "bandpass", [1500, 5000]) * np.exp(-t * 180)
    thock = np.sin(2 * np.pi * body * t * (1 - 0.3 * t)) * np.exp(-t * 55)
    return (0.5 * click + 0.6 * thock) * gain


def paste():
    t = tt(0.12)
    f = 260 + 300 * np.exp(-t * 40)
    pop = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 32)
    air = filt(noise(0.12, 3), "bandpass", [2000, 6000]) * np.exp(-t * 60) * 0.25
    return pop * 0.7 + air


def tick(f=2400, seed=1, d=0.03):
    t = tt(d)
    return (filt(noise(d, seed), "bandpass", [f * 0.6, f * 1.5]) * np.exp(-t * 300) * 0.6
            + np.sin(2 * np.pi * f * 0.4 * t) * np.exp(-t * 160) * 0.35)


def pin():
    t = tt(0.07)
    snap = filt(noise(0.07, 5), "highpass", 3000) * np.exp(-t * 400) * 0.5
    f = 1100 + 700 * (1 - np.exp(-t * 90))
    blip = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 70) * 0.45
    return snap + blip


def tap(seed):
    r = np.random.default_rng(seed)
    t = tt(0.025)
    c = r.uniform(2500, 4500)
    return filt(noise(0.025, seed), "bandpass", [c * 0.7, c * 1.3]) * np.exp(-t * r.uniform(260, 360)) * r.uniform(0.7, 1.0)


def whoosh(seed=9, d=0.32):
    t = tt(d)
    n = noise(d, seed)
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    lo = filt(n, "bandpass", [500, 2500])
    hi = filt(n, "bandpass", [2500, 7000])
    mixp = t / d
    return (lo * (1 - mixp) + hi * mixp) * env * 0.35


def fold():
    t = tt(0.16)
    return (np.sin(2 * np.pi * 95 * t) * np.exp(-t * 28) * 0.6
            + filt(noise(0.16, 11), "lowpass", 1200) * np.exp(-t * 40) * 0.3)


def click():
    out = np.zeros(int(0.05 * SR))
    for off, g in ((0, 1.0), (0.004, 0.6)):
        c = tick(3000, 13, 0.03) * g
        i = int(off * SR)
        out[i:i + len(c)] += c[: len(out) - i]
    return out * 1.2


def sent():
    out = np.zeros(int(0.3 * SR))
    for off, f in ((0, 1318.5), (0.07, 1760)):
        t = tt(0.2)
        s = np.sin(2 * np.pi * f * t) * np.exp(-t * 22) * np.clip(t / 0.003, 0, 1)
        i = int(off * SR)
        out[i:i + len(s)] += s * 0.28
    return out


def dissolve(seed):
    t = tt(0.22)
    env = np.clip(t / 0.02, 0, 1) * np.exp(-t * 16)
    f = [5200, 4400, 3700][seed % 3]
    return filt(noise(0.22, 20 + seed), "bandpass", [f * 0.8, f * 1.25]) * env * 0.25


def make(e):
    k = e["type"]
    if k == "key": return key(int(e["t"] * 100))
    if k == "enter": return key(77, body=110, gain=1.3)
    if k == "paste": return paste()
    if k == "dragstart": return tick(2200, 2)
    if k == "release": return tick(1500, 4) * 0.8
    if k == "pin": return pin()
    if k == "tap": return tap(e.get("seed", 0))
    if k == "whoosh": return whoosh(int(e["t"] * 10))
    if k == "fold": return fold()
    if k == "click": return click()
    if k == "sent": return sent()
    if k == "dissolve": return dissolve(e.get("seed", 0))
    raise ValueError(k)


events = json.load(open("sounds.json"))
fx = np.zeros(N)
for e in events:
    s = make(e) * e.get("gain", 1.0)
    peak = int(np.argmax(np.abs(s)))            # measured peak
    start = int(round(e["t"] * SR)) - peak       # peak lands on the event
    for i, v in enumerate(range(start, start + len(s))):
        pass
    idx = (np.arange(len(s)) + start) % N        # wrap: the loop stays seamless
    np.add.at(fx, idx, s)

sr, music = wavfile.read("music.wav")
music = music.astype(np.float64) / 32767
mix = music * 0.85 + np.stack([fx, fx], 1) * 0.55
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
mix *= 0.89 / np.max(np.abs(mix))
wavfile.write("audio.wav", SR, (mix * 32767).astype(np.int16))
print(len(events), "sounds placed")
