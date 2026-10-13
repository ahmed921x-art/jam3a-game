"""موسيقى خلفية أصلية لإعلان بايو (مُولّدة برمجياً، بلا حقوق نشر).
الاستخدام: python marketing/tools/music.py <المدة بالثواني> <ملف الإخراج.wav>"""
import sys, wave
import numpy as np

SR = 44100
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 22.0
OUT = sys.argv[2] if len(sys.argv) > 2 else "music.wav"
BPM = 112
BEAT = 60 / BPM
N = int(SR * DUR)
t = np.arange(N) / SR
mix = np.zeros(N)
rng = np.random.default_rng(7)


def note(freq, start, length, vol, kind="saw", decay=6.0):
    i0, i1 = int(start * SR), min(N, int((start + length) * SR))
    if i0 >= N or i1 <= i0:
        return
    tt = np.arange(i1 - i0) / SR
    if kind == "sine":
        w = np.sin(2 * np.pi * freq * tt)
    elif kind == "square":
        w = np.sign(np.sin(2 * np.pi * freq * tt)) * 0.6
    else:  # saw ناعم
        w = 2 * ((freq * tt) % 1) - 1
        w = 0.6 * w + 0.4 * np.sin(2 * np.pi * freq * tt)
    env = np.exp(-decay * tt) * np.minimum(1, tt * 200)
    mix[i0:i1] += vol * w * env


def kick(start):
    i0 = int(start * SR)
    L = min(N - i0, int(0.35 * SR))
    if L <= 0:
        return
    tt = np.arange(L) / SR
    f = 120 * np.exp(-tt * 18) + 45
    ph = 2 * np.pi * np.cumsum(f) / SR
    mix[i0 : i0 + L] += 0.9 * np.sin(ph) * np.exp(-tt * 9)


def hat(start, vol=0.12):
    i0 = int(start * SR)
    L = min(N - i0, int(0.06 * SR))
    if L <= 0:
        return
    tt = np.arange(L) / SR
    n = rng.standard_normal(L)
    n = np.diff(np.concatenate([[0], n]))  # high-pass بسيط
    mix[i0 : i0 + L] += vol * n * np.exp(-tt * 60)


def clap(start):
    i0 = int(start * SR)
    L = min(N - i0, int(0.18 * SR))
    if L <= 0:
        return
    tt = np.arange(L) / SR
    mix[i0 : i0 + L] += 0.28 * rng.standard_normal(L) * np.exp(-tt * 22)


# تسلسل Am – F – C – G (نغمات MIDI)
mtof = lambda m: 440 * 2 ** ((m - 69) / 12)
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
BASS = [45, 41, 48, 43]
bars = int(DUR / (4 * BEAT)) + 1
for b in range(bars):
    t0 = b * 4 * BEAT
    ch = CHORDS[b % 4]
    intro = b == 0
    # باص
    for k in range(4):
        note(mtof(BASS[b % 4]), t0 + k * BEAT, BEAT * 0.9, 0.22 if not intro else 0.12, "sine", 3)
    # أربيجيو (ثُمنيات)
    for k in range(8):
        m = ch[[0, 1, 2, 1][k % 4]] + 12 + (12 if k in (3, 7) else 0)
        note(mtof(m), t0 + k * BEAT / 2, BEAT / 2, 0.07, "square", 9)
    # وسادة الكورد
    for m in ch:
        note(mtof(m + 12), t0, 4 * BEAT, 0.035, "saw", 0.6)
    if not intro:
        for k in range(4):
            kick(t0 + k * BEAT)
            hat(t0 + k * BEAT + BEAT / 2)
        clap(t0 + BEAT)
        clap(t0 + 3 * BEAT)

# تلاشي في البداية والنهاية + تطبيع
fade = np.ones(N)
fi, fo = int(0.3 * SR), int(1.8 * SR)
fade[:fi] = np.linspace(0, 1, fi)
fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade
mix = np.tanh(mix * 1.2)
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.8
stereo = np.stack([mix, np.roll(mix, int(0.008 * SR))], axis=1)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((stereo * 32767).astype(np.int16).tobytes())
print("music ok", DUR, "s")
