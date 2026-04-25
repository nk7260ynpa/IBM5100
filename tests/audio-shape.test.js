// 音效引擎單元測試（介面契約 + enable/disable）
// 對應 spec：openspec/changes/add-ibn5100-terminal/specs/audio-engine/spec.md
//
// 由於 Node 環境沒有 WebAudio，本檔以 stub AudioContext 取代，重點驗證：
// 1. 音效物件（內部命名空間 sound; 對應 design 原型 window 全域）具備 spec 列出的
//    10 個 method 全為 function。
// 2. setEnabled(false) → 呼叫播放函式不觸發 oscillator 建立。
// 3. setEnabled(false) → tape noise 立即 stop（透過 cancelScheduledValues spy）。
// 4. init() 在 AudioContext 建構失敗時靜默返回不拋例外。
//
// 註：本檔內變數命名使用 `sound`（非 design 原型內部全域識別字），以避免在 ibn-name.test.js
// 的「字串字面值掃描」中誤觸 IBM 三字元（spec/easter-eggs Requirement「彩蛋與 IBN-5100 命名
// 互斥於 IBM」對 tests/ 字串字面值同樣禁用）。對應 design.md Goal #4 的「保留 window 全域
// 命名空間」僅及於 web/ 內 JS identifier，不及於 tests/ 字串描述。

import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * 建立 stub AudioContext class，記錄 oscillator / filter 建立次數。
 * @returns {Function} 可作為 global AudioContext 用的建構子
 */
function buildStubAudioContextFactory() {
  const stats = {
    oscillatorsCreated: 0,
    biquadsCreated: 0,
    buffersCreated: 0,
    bufferSourcesCreated: 0,
    gainsCreated: 0,
    cancelScheduledCount: 0,
    instances: 0,
  };
  function FakeParam() {
    return {
      cancelScheduledValues: () => { stats.cancelScheduledCount += 1; },
      setValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {},
      linearRampToValueAtTime: () => {},
      value: 0,
    };
  }
  function FakeOscillator() {
    return {
      type: 'sine',
      frequency: FakeParam(),
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }
  function FakeGain() {
    return {
      gain: FakeParam(),
      connect: () => {},
    };
  }
  function FakeBiquad() {
    return {
      type: 'lowpass',
      frequency: FakeParam(),
      Q: FakeParam(),
      connect: () => {},
    };
  }
  function FakeBufferSource() {
    return {
      buffer: null,
      loop: false,
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }
  class FakeAudioContext {
    constructor() {
      stats.instances += 1;
      this.state = 'running';
      this.currentTime = 0;
      this.sampleRate = 44100;
      this.destination = {};
    }
    createOscillator() { stats.oscillatorsCreated += 1; return FakeOscillator(); }
    createGain() { stats.gainsCreated += 1; return FakeGain(); }
    createBiquadFilter() { stats.biquadsCreated += 1; return FakeBiquad(); }
    createBuffer(channels, length /* , rate */) {
      stats.buffersCreated += 1;
      return { getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() { stats.bufferSourcesCreated += 1; return FakeBufferSource(); }
    resume() {}
  }
  return { FakeAudioContext, stats };
}

let sound;
let stats;

beforeEach(async () => {
  const { FakeAudioContext, stats: s } = buildStubAudioContextFactory();
  stats = s;
  // audio.js IIFE 在載入時偵測 `window`/`globalThis`；先把 stub 掛上去再 import。
  globalThis.AudioContext = FakeAudioContext;
  globalThis.webkitAudioContext = FakeAudioContext;
  // 用 vi.resetModules() 強制 Vitest 重新執行 audio.js IIFE，避免不同 test 共享同一份
  // 內部 enabled / tapeNoise 狀態。
  vi.resetModules();
  const mod = await import('../web/audio.js');
  sound = mod.default;
});

describe('音效物件介面契約', () => {
  it('具備 spec 列出的 10 個 method 且皆為 function', () => {
    const methods = ['setEnabled', 'isEnabled', 'key', 'bootBeep', 'shutdownWhine',
                     'knob', 'tapeStart', 'tapeStop', 'powerHum', 'init'];
    for (const m of methods) {
      expect(typeof sound[m]).toBe('function');
    }
  });

  it('預設 enabled 為 true', () => {
    expect(sound.isEnabled()).toBe(true);
  });
});

describe('音效物件 enable / disable 行為', () => {
  it('setEnabled(false) 後呼叫 key 不建立 oscillator', () => {
    sound.setEnabled(false);
    const before = stats.oscillatorsCreated;
    sound.key();
    sound.bootBeep();
    sound.knob();
    expect(stats.oscillatorsCreated).toBe(before);
    sound.setEnabled(true);
  });

  it('setEnabled(false) 在 tape 播放中會觸發 tapeStop（驗證 cancelScheduledValues）', () => {
    // 先啟動 tape noise，確認有 oscillator/buffer source 建立
    sound.tapeStart();
    expect(stats.bufferSourcesCreated).toBeGreaterThanOrEqual(1);
    const before = stats.cancelScheduledCount;
    sound.setEnabled(false);
    // tapeStop 內部呼叫 g.gain.cancelScheduledValues
    expect(stats.cancelScheduledCount).toBeGreaterThan(before);
    sound.setEnabled(true);
  });

  it('setEnabled(true) 後播放函式恢復建立 oscillator', () => {
    sound.setEnabled(false);
    const baseline = stats.oscillatorsCreated;
    sound.setEnabled(true);
    sound.knob();
    expect(stats.oscillatorsCreated).toBeGreaterThan(baseline);
  });
});

describe('音效物件 init / lazy AudioContext', () => {
  it('init() 不拋例外', () => {
    expect(() => sound.init()).not.toThrow();
  });

  it('AudioContext 建構失敗時 init 安靜返回（不拋）', async () => {
    // 重新載入並改 stub 為「建構即拋」
    globalThis.AudioContext = function () { throw new Error('no audio'); };
    globalThis.webkitAudioContext = globalThis.AudioContext;
    vi.resetModules();
    const mod = await import('../web/audio.js');
    const s2 = mod.default;
    expect(() => s2.init()).not.toThrow();
    // 在 ctx === null 狀態下，後續播放也不應拋
    expect(() => s2.key()).not.toThrow();
    expect(() => s2.bootBeep()).not.toThrow();
  });
});

describe('音效物件播放函式建立預期音源', () => {
  it('bootBeep 建立 2 個 oscillator', () => {
    const before = stats.oscillatorsCreated;
    sound.bootBeep();
    expect(stats.oscillatorsCreated - before).toBe(2);
  });

  it('knob 建立 1 個 oscillator', () => {
    const before = stats.oscillatorsCreated;
    sound.knob();
    expect(stats.oscillatorsCreated - before).toBe(1);
  });

  it('shutdownWhine 建立 1 個 sawtooth oscillator', () => {
    const before = stats.oscillatorsCreated;
    sound.shutdownWhine();
    expect(stats.oscillatorsCreated - before).toBe(1);
  });

  it('tapeStart 建立 BufferSource + bandpass filter + LFO oscillator', () => {
    const beforeOsc = stats.oscillatorsCreated;
    const beforeBs = stats.bufferSourcesCreated;
    const beforeBp = stats.biquadsCreated;
    sound.tapeStart();
    expect(stats.oscillatorsCreated - beforeOsc).toBe(1); // LFO
    expect(stats.bufferSourcesCreated - beforeBs).toBe(1); // noise loop
    expect(stats.biquadsCreated - beforeBp).toBe(1); // bandpass
  });

  it('powerHum 回傳含 stop function 的 handle', () => {
    const handle = sound.powerHum();
    expect(handle).not.toBeNull();
    expect(typeof handle.stop).toBe('function');
    expect(() => handle.stop()).not.toThrow();
  });
});
