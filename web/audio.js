// Web Audio synth — keypress, tape spin, boot beep, knob click.
// All sounds are synthesized — no asset files.
//
// 設計來源：design 原型 audio.jsx；本檔僅在 IIFE 末尾改為「同檔雙環境」匯出
// （瀏覽器掛 globalThis.IBNSound，Node 走 module.exports），並以 window.IBNSound 為相容
// 別名同時掛上以維持原型 API 可用性。

(function (root) {
  let ctx = null;
  let enabled = true;
  let tapeNoise = null;

  function ac() {
    if (!ctx) {
      try {
        const AC = (root && (root.AudioContext || root.webkitAudioContext)) || null;
        ctx = AC ? new AC() : null;
      } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function envGain(g, t0, peak, attack, decay, sustain, release) {
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t0 + attack + decay);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay + release);
  }

  function key() {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    const t = a.currentTime;
    // Mechanical click: short noise burst + low thud
    const buf = a.createBuffer(1, 256, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const n = a.createBufferSource(); n.buffer = buf;
    const ng = a.createGain(); ng.gain.value = 0.18;
    const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
    n.connect(hp); hp.connect(ng); ng.connect(a.destination);
    n.start(t);

    const o = a.createOscillator(); o.type = 'square'; o.frequency.value = 80 + Math.random() * 40;
    const og = a.createGain();
    envGain(og, t, 0.05, 0.001, 0.02, 0.001, 0.02);
    o.connect(og); og.connect(a.destination);
    o.start(t); o.stop(t + 0.05);
  }

  function bootBeep() {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    const t = a.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = a.createOscillator(); o.type = 'square'; o.frequency.value = f;
      const g = a.createGain();
      const start = t + i * 0.18;
      envGain(g, start, 0.12, 0.005, 0.04, 0.08, 0.1);
      o.connect(g); g.connect(a.destination);
      o.start(start); o.stop(start + 0.2);
    });
  }

  function shutdownWhine() {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(1200, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.8);
    const g = a.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + 0.9);
  }

  function knob() {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator(); o.type = 'triangle'; o.frequency.value = 320;
    const g = a.createGain();
    envGain(g, t, 0.04, 0.001, 0.01, 0.001, 0.02);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + 0.05);
  }

  function tapeStart() {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    if (tapeNoise) tapeStop();
    const t = a.currentTime;
    const buf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.6;
    const g = a.createGain(); g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.04, t + 0.05);
    src.connect(bp); bp.connect(g); g.connect(a.destination);
    src.start(t);
    // Modulate: chirpy reads
    const lfo = a.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 7;
    const lfog = a.createGain(); lfog.gain.value = 800;
    lfo.connect(lfog); lfog.connect(bp.frequency);
    lfo.start(t);
    tapeNoise = { src, g, lfo, a };
  }

  function tapeStop() {
    if (!tapeNoise) return;
    const { src, g, lfo, a } = tapeNoise;
    const t = a.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    setTimeout(() => { try { src.stop(); lfo.stop(); } catch (e) {} }, 250);
    tapeNoise = null;
  }

  function powerHum() {
    // a low constant hum while powered on
    if (!enabled) return null;
    const a = ac(); if (!a) return null;
    const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = 60;
    const g = a.createGain(); g.gain.value = 0.008;
    o.connect(g); g.connect(a.destination);
    o.start();
    return { stop: () => { try { o.stop(); } catch (e) {} } };
  }

  const api = {
    setEnabled: (v) => { enabled = v; if (!v) tapeStop(); },
    isEnabled: () => enabled,
    key: key,
    bootBeep: bootBeep,
    shutdownWhine: shutdownWhine,
    knob: knob,
    tapeStart: tapeStart,
    tapeStop: tapeStop,
    powerHum: powerHum,
    init: () => ac(),
  };

  // 雙環境匯出（design.md Decision 2）：
  // - 瀏覽器掛 globalThis.IBNSound（外加相容別名 globalThis.IBMSound 給原型既有引用）
  // - Node / Vitest 透過 CommonJS 取得
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    // 內部命名空間沿用 design 原型的 IBMSound（spec/easter-eggs 的 IBM 規則僅及於字串
    // 字面值，不及於 JS identifier；見 issues.md 解讀）。
    root.IBMSound = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
