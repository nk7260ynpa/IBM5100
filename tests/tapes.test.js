// 磁帶系統單元測試
// 對應 spec：openspec/changes/add-ibn5100-terminal/specs/tape-system/spec.md
//
// 覆蓋資料/解析相關 Requirement：catalog 元資料、BASIC 來源磁帶可被 execImmediate +
// runProgram 跑完並產出 spec 期待的輸出。

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TAPES } from '../web/tapes.js';
import IBMTerm from '../web/interpreter.js';

const { makeBASICEnv, execImmediate } = IBMTerm;

/**
 * 建立可記錄輸出的 io 替身。
 * @param {Array<string>} [inputs]
 */
function makeIO(inputs = []) {
  const lines = [];
  const queue = inputs.slice();
  return {
    print: (s) => lines.push(s),
    clear: () => { lines.length = 0; },
    input: async () => (queue.length ? queue.shift() : ''),
    output: () => lines.join(''),
    lines,
  };
}

/**
 * 將磁帶 source 載入 BASIC env：對每行 execImmediate（與 app.js loadTape 對齊）。
 */
async function loadSourceIntoEnv(source, env, io) {
  const sourceLines = source.split('\n');
  for (const sl of sourceLines) {
    if (sl.trim()) await execImmediate(sl, env, io);
  }
}

describe('磁帶 catalog 元資料', () => {
  it('TAPES 為長度 7 的陣列', () => {
    expect(Array.isArray(TAPES)).toBe(true);
    expect(TAPES).toHaveLength(7);
  });

  it.each([
    [0, 'HELLO',  'HELLO',  'A', 'GREETING ROUTINE'],
    [1, 'CLOCK',  'CLOCK',  'A', 'REAL-TIME CLOCK'],
    [2, 'FIB',    'FIB-12', 'B', 'FIBONACCI 1..12'],
    [3, 'PRIME',  'PRIME',  'B', 'SIEVE 2..50'],
    [4, 'GUESS',  'GUESS',  'C', 'NUMBER GUESS GAME'],
    [5, 'CALC',   'CALC',   'C', 'INTERACTIVE CALCULATOR'],
    [6, 'DIVERG', '∂.404',  '?', 'WORLD LINE METER'],
  ])('TAPES[%i] 為 id=%s, label=%s, side=%s, desc=%s', (idx, id, label, side, desc) => {
    expect(TAPES[idx].id).toBe(id);
    expect(TAPES[idx].label).toBe(label);
    expect(TAPES[idx].side).toBe(side);
    expect(TAPES[idx].desc).toBe(desc);
  });

  it('CLOCK 與 ∂.404 的 source 為 __BUILTIN_*', () => {
    expect(TAPES[1].source).toBe('__BUILTIN_CLOCK__');
    expect(TAPES[6].source).toBe('__BUILTIN_DIVERGENCE__');
  });

  it('其餘五卷 source 為非空 BASIC 字串', () => {
    for (const idx of [0, 2, 3, 4, 5]) {
      const t = TAPES[idx];
      expect(typeof t.source).toBe('string');
      expect(t.source.length).toBeGreaterThan(0);
      expect(t.source.startsWith('__BUILTIN_')).toBe(false);
    }
  });
});

describe('HELLO 磁帶執行', () => {
  it('輸出 HELLO, WORLD. 與 READY.', async () => {
    const tape = TAPES.find(t => t.id === 'HELLO');
    const env = makeBASICEnv();
    const io = makeIO();
    await loadSourceIntoEnv(tape.source, env, io);
    const io2 = makeIO();
    await execImmediate('RUN', env, io2);
    expect(io2.output()).toContain('HELLO, WORLD.\n');
    expect(io2.output()).toContain('READY.\n');
  });
});

describe('FIB-12 磁帶執行', () => {
  it('輸出 12 行，最後一行 B = 144', async () => {
    const tape = TAPES.find(t => t.id === 'FIB');
    const env = makeBASICEnv();
    const io = makeIO();
    await loadSourceIntoEnv(tape.source, env, io);
    const io2 = makeIO();
    await execImmediate('RUN', env, io2);
    const out = io2.output();
    // 12 個 (I, B) 行 + DONE.
    expect(out).toContain('12\t144\n');
    // 行 1 應為 (1, 1)
    expect(out).toContain('1\t1\n');
    // 行 12 後為 DONE.
    expect(out.trimEnd().endsWith('DONE.')).toBe(true);
  });
});

describe('PRIME 磁帶執行', () => {
  it('包含 2..50 內所有質數，尾行為 READY.', async () => {
    const tape = TAPES.find(t => t.id === 'PRIME');
    const env = makeBASICEnv();
    const io = makeIO();
    await loadSourceIntoEnv(tape.source, env, io);
    const io2 = makeIO();
    await execImmediate('RUN', env, io2);
    const out = io2.output();
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
    for (const p of primes) {
      expect(out).toContain(String(p));
    }
    expect(out).toContain('READY.\n');
  });
});

describe('CALC 磁帶執行（互動）', () => {
  it('輸入 0 即直接退出並輸出 BYE.', async () => {
    const tape = TAPES.find(t => t.id === 'CALC');
    const env = makeBASICEnv();
    const io = makeIO();
    await loadSourceIntoEnv(tape.source, env, io);
    // 模擬使用者輸入 A=0 → 程式跳到 100 印 BYE.
    const io2 = makeIO(['0']);
    await execImmediate('RUN', env, io2);
    expect(io2.output()).toContain('BYE.\n');
  });
});

describe('GUESS 磁帶執行（互動）', () => {
  it('鎖定 Math.random 後一次猜中應輸出 GOT IT IN 1 TRIES.', async () => {
    const tape = TAPES.find(t => t.id === 'GUESS');
    const env = makeBASICEnv();
    const io = makeIO();
    // 鎖定 Math.random 為 0 → INT(0 * 100) + 1 = 1。
    const realRandom = Math.random;
    Math.random = () => 0;
    try {
      await loadSourceIntoEnv(tape.source, env, io);
      const io2 = makeIO(['1']);
      await execImmediate('RUN', env, io2);
      expect(io2.output()).toContain('GOT IT IN ');
      expect(io2.output()).toContain('1');
      expect(io2.output()).toContain('TRIES.');
    } finally {
      Math.random = realRandom;
    }
  });
});
