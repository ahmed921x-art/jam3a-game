/* ===========================================================
   لَمة — محرك الأصوات (Web Audio، بدون ملفات خارجية)
   =========================================================== */

const Sound = (() => {
  let ctx = null;
  let enabled = true;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // نغمة بسيطة
  function tone(freq, dur, type = "sine", gain = 0.18, when = 0) {
    if (!enabled) return;
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // تتابع نغمات (لحن)
  function melody(notes, type = "triangle", gain = 0.2) {
    let t = 0;
    notes.forEach(([freq, dur]) => {
      tone(freq, dur, type, gain, t);
      t += dur;
    });
  }

  const API = {
    setEnabled(v) {
      enabled = v;
    },
    isEnabled: () => enabled,
    unlock: () => ensure(),

    click: () => tone(420, 0.07, "square", 0.08),
    select: () => tone(660, 0.09, "triangle", 0.12),
    open: () => melody([[440, 0.08], [660, 0.1]], "triangle", 0.15),
    tick: () => tone(880, 0.04, "sine", 0.05),
    tickLow: () => tone(440, 0.06, "square", 0.09),
    timeout: () => melody([[330, 0.18], [262, 0.25], [196, 0.35]], "sawtooth", 0.18),

    correct: () =>
      melody([[523, 0.1], [659, 0.1], [784, 0.12], [1047, 0.22]], "triangle", 0.2),
    wrong: () => melody([[392, 0.14], [311, 0.28]], "sawtooth", 0.18),

    steal: () => melody([[660, 0.08], [880, 0.08], [1175, 0.14]], "square", 0.15),
    lifeline: () => melody([[700, 0.07], [950, 0.07], [1200, 0.1]], "triangle", 0.14),

    win: () =>
      melody(
        [
          [523, 0.15],
          [523, 0.15],
          [523, 0.15],
          [659, 0.3],
          [587, 0.15],
          [659, 0.15],
          [784, 0.45],
        ],
        "triangle",
        0.22
      ),
    draw: () => melody([[440, 0.2], [440, 0.2], [349, 0.4]], "triangle", 0.18),
  };

  // ---------------- موسيقى خلفية (حلقة هادئة) ----------------
  let music = { on: false, timer: null, nodes: [] };
  // تتابع نوتات لطيف يتكرر
  const PAD = [220, 277, 330, 277, 247, 294, 330, 392];
  let padIdx = 0;

  function padTone(freq) {
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    const osc2 = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc2.type = "triangle";
    osc.frequency.value = freq;
    osc2.frequency.value = freq * 2;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.05, t0 + 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t0 + 1.6);
    osc.connect(g);
    osc2.connect(g);
    g.connect(ac.destination);
    osc.start(t0);
    osc2.start(t0);
    osc.stop(t0 + 1.7);
    osc2.stop(t0 + 1.7);
  }

  API.musicStart = function () {
    if (music.on) return;
    ensure();
    music.on = true;
    padIdx = 0;
    const tick = () => {
      if (!music.on) return;
      padTone(PAD[padIdx % PAD.length]);
      padIdx++;
      music.timer = setTimeout(tick, 1400);
    };
    tick();
  };
  API.musicStop = function () {
    music.on = false;
    if (music.timer) clearTimeout(music.timer);
    music.timer = null;
  };
  API.musicOn = () => music.on;

  return API;
})();
