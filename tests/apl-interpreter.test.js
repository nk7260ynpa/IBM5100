// APL 直譯器單元測試
// 對應 spec：openspec/changes/add-ibn5100-terminal/specs/apl-interpreter/spec.md
//
// 覆蓋 spec 全部 Requirement：tokenizer、單元/雙元符號、賦值、由右而左、formatAPL、
// 雙環境匯出。

import { describe, it, expect } from 'vitest';
import IBMTerm from '../web/interpreter.js';

const { evalAPL, formatAPL } = IBMTerm;

describe('APL tokenizer 與基本求值', () => {
  it('含 APL 負號 ¯ 的數字被解為負數', () => {
    expect(evalAPL('¯3 + 5', {})).toBe(2);
  });

  it('字串使用單引號', () => {
    expect(evalAPL("'HELLO'", {})).toBe('HELLO');
  });

  it('連續數字構成向量', () => {
    expect(evalAPL('1 2 3 4', {})).toEqual([1, 2, 3, 4]);
  });

  it('識別字保留大小寫', () => {
    const env = {};
    evalAPL('X ← 5', env);
    expect(env.X).toBe(5);
    // 小寫識別字也能保存與讀回
    evalAPL('y ← 7', env);
    expect(env.y).toBe(7);
  });
});

describe('APL 單元（monadic）符號', () => {
  it('⍳ N 產生 1..N', () => {
    expect(evalAPL('⍳ 5', {})).toEqual([1, 2, 3, 4, 5]);
  });

  it('⍴ V 取得 shape', () => {
    expect(evalAPL('⍴ 1 2 3 4', {})).toEqual([4]);
  });

  it('一元算術組合', () => {
    expect(evalAPL('- 1 2 3', {})).toEqual([-1, -2, -3]);
    expect(evalAPL('÷ 2', {})).toBe(0.5);
    expect(evalAPL('⌈ 1.2', {})).toBe(2);
    expect(evalAPL('⌊ 1.7', {})).toBe(1);
    expect(evalAPL('| ¯3', {})).toBe(3);
    expect(evalAPL('× ¯2 0 5', {})).toEqual([-1, 0, 1]);
  });

  it('⍋ 升冪排序索引（1-indexed）', () => {
    expect(evalAPL('⍋ 3 1 2', {})).toEqual([2, 3, 1]);
  });

  it('⍒ 降冪排序索引（1-indexed）', () => {
    expect(evalAPL('⍒ 3 1 2', {})).toEqual([1, 3, 2]);
  });

  it('NONCE ERROR 對未實作單元符號（如 ?）', () => {
    expect(() => evalAPL('? 5', {})).toThrow('NONCE ERROR');
  });
});

describe('APL 雙元（dyadic）符號', () => {
  it('純量算術', () => {
    expect(evalAPL('2 + 3', {})).toBe(5);
    expect(evalAPL('10 - 4', {})).toBe(6);
    expect(evalAPL('2 × 3', {})).toBe(6);
    expect(evalAPL('10 ÷ 4', {})).toBe(2.5);
    expect(evalAPL('2 * 8', {})).toBe(256);
    expect(evalAPL('5 ⌈ 3', {})).toBe(5);
    expect(evalAPL('5 ⌊ 3', {})).toBe(3);
    expect(evalAPL('3 | 10', {})).toBe(1);
  });

  it('純量廣播至向量', () => {
    expect(evalAPL('2 × 1 2 3', {})).toEqual([2, 4, 6]);
    expect(evalAPL('1 2 3 + 10', {})).toEqual([11, 12, 13]);
  });

  it('等長向量逐元素', () => {
    expect(evalAPL('1 2 3 + 10 20 30', {})).toEqual([11, 22, 33]);
  });

  it('不等長向量拋 LENGTH ERROR', () => {
    expect(() => evalAPL('1 2 + 1 2 3', {})).toThrow('LENGTH ERROR');
  });

  it('⍴ reshape 重複前置', () => {
    expect(evalAPL('4 ⍴ 1 2 3', {})).toEqual([1, 2, 3, 1]);
    expect(evalAPL('6 ⍴ 1 2 3', {})).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it('比較運算回 1/0（與 BASIC -1/0 不同）', () => {
    expect(evalAPL('1 2 3 = 1 0 3', {})).toEqual([1, 0, 1]);
    expect(evalAPL('1 < 2', {})).toBe(1);
    expect(evalAPL('1 > 2', {})).toBe(0);
    expect(evalAPL('2 ≤ 2', {})).toBe(1);
    expect(evalAPL('2 ≥ 3', {})).toBe(0);
    expect(evalAPL('1 ≠ 2', {})).toBe(1);
  });

  it('catenate ,', () => {
    expect(evalAPL('1 2 , 3 4', {})).toEqual([1, 2, 3, 4]);
  });
});

describe('APL 賦值 ←', () => {
  it('賦值不 echo（回傳 null）', () => {
    const env = {};
    const r = evalAPL('X ← 1 2 3', env);
    expect(r).toBeNull();
    expect(env.X).toEqual([1, 2, 3]);
  });

  it('變數讀取', () => {
    const env = {};
    evalAPL('X ← 5', env);
    expect(evalAPL('X + 10', env)).toBe(15);
  });

  it('未定義名稱拋 VALUE ERROR', () => {
    expect(() => evalAPL('UNKNOWN + 1', {})).toThrow('VALUE ERROR');
  });
});

describe('APL 由右而左求值與括號', () => {
  it('右結合：2 × 3 + 4 = 14', () => {
    expect(evalAPL('2 × 3 + 4', {})).toBe(14);
  });

  it('括號改變優先：(2 × 3) + 4 = 10', () => {
    expect(evalAPL('(2 × 3) + 4', {})).toBe(10);
  });
});

describe('APL formatAPL 規則', () => {
  it('null / undefined 回空字串', () => {
    expect(formatAPL(null)).toBe('');
    expect(formatAPL(undefined)).toBe('');
  });

  it('整數元素以 String(x) 呈現', () => {
    expect(formatAPL([1, 2, 3])).toBe('1 2 3');
    expect(formatAPL(42)).toBe('42');
  });

  it('非整數元素以 toFixed(4) 呈現', () => {
    expect(formatAPL([0.5, 1, 1.25])).toBe('0.5000 1 1.2500');
  });

  it('純量字串以 String(x) 呈現', () => {
    expect(formatAPL('HELLO')).toBe('HELLO');
  });

  it('向量以單一空白字元間隔', () => {
    const out = formatAPL([1, 2, 3]);
    expect(out).toMatch(/^1 2 3$/);
  });
});

describe('APL 雙環境匯出', () => {
  it('evalAPL 與 formatAPL 與 BASIC API 同層存在', () => {
    expect(typeof IBMTerm.evalAPL).toBe('function');
    expect(typeof IBMTerm.formatAPL).toBe('function');
    expect(typeof IBMTerm.makeBASICEnv).toBe('function');
  });
});
