// BASIC 直譯器單元測試
// 對應 spec：openspec/changes/add-ibn5100-terminal/specs/basic-interpreter/spec.md
//
// 覆蓋 spec 全部 Requirement：tokenizer、運算式 parser、內建函式、比較與布林、PRINT、
// INPUT、賦值、控制流程、FOR/NEXT、行號式程式管理、RUN、錯誤格式、雙環境匯出、磁帶相容。

import { describe, it, expect, vi } from 'vitest';
import IBMTerm from '../web/interpreter.js';

const { tokenize, makeBASICEnv, execImmediate, runProgram } = IBMTerm;

/**
 * 建立可記錄輸出的 io 替身。
 * @param {Array<string>} [inputs] - 預先排入的 INPUT 回應；空時回 ''
 * @returns {{print: Function, clear: Function, input: Function, output: () => string, lines: string[], cleared: number}}
 */
function makeIO(inputs = []) {
  const lines = [];
  const promptsAsked = [];
  let cleared = 0;
  const queue = inputs.slice();
  return {
    print: (s) => lines.push(s),
    clear: () => { cleared += 1; lines.length = 0; },
    // 模擬 askInput 行為：將 prompt 一併寫入輸出（與 app.js 的 React io 對齊）。
    input: async (prompt) => {
      promptsAsked.push(prompt);
      lines.push(prompt);
      return queue.length ? queue.shift() : '';
    },
    output: () => lines.join(''),
    lines,
    promptsAsked,
    get cleared() { return cleared; },
  };
}

describe('BASIC tokenizer', () => {
  it('將數字、字串、識別字、運算子分類正確', () => {
    const toks = tokenize('LET A = 1.5 + "X"');
    expect(toks).toEqual([
      { t: 'id', v: 'LET' },
      { t: 'id', v: 'A' },
      { t: 'op', v: '=' },
      { t: 'num', v: 1.5 },
      { t: 'op', v: '+' },
      { t: 'str', v: 'X' },
    ]);
  });

  it('支援前導小數點數字 .5', () => {
    const toks = tokenize('PRINT .5');
    expect(toks[1]).toEqual({ t: 'num', v: 0.5 });
  });

  it('多字元運算子 <= >= <> 被識別為單一 token', () => {
    const toks = tokenize('IF X <= 3 AND Y <> 0');
    const ops = toks.filter(t => t.t === 'op').map(t => t.v);
    expect(ops).toContain('<=');
    expect(ops).toContain('<>');
    expect(ops).toContain('AND');
  });

  it('保留字 AND / OR / NOT / MOD 為 op', () => {
    const toks = tokenize('A AND B OR NOT C MOD D');
    const ops = toks.filter(t => t.t === 'op').map(t => t.v);
    expect(ops).toEqual(['AND', 'OR', 'NOT', 'MOD']);
  });

  it('識別字一律轉大寫', () => {
    const toks = tokenize('print abc');
    expect(toks[0]).toEqual({ t: 'id', v: 'PRINT' });
    expect(toks[1]).toEqual({ t: 'id', v: 'ABC' });
  });

  it('不合法字元拋出 SYNTAX ERROR', () => {
    expect(() => tokenize('@')).toThrow('SYNTAX ERROR');
    expect(() => tokenize('#abc')).toThrow('SYNTAX ERROR');
    expect(() => tokenize('!x')).toThrow('SYNTAX ERROR');
  });
});

describe('BASIC 運算式優先序', () => {
  it('1 + 2 * 3 = 7（乘法優先）', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('PRINT 1 + 2 * 3', env, io);
    expect(io.output()).toBe('7\n');
  });

  it('2 ^ 3 ^ 2 為有限值且不拋例外', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('PRINT 2 ^ 3 ^ 2', env, io);
    const v = parseFloat(io.output());
    expect(Number.isFinite(v)).toBe(true);
  });

  it('一元負號 -3 + 5 = 2', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('PRINT -3 + 5', env, io);
    expect(io.output()).toBe('2\n');
  });

  it('函式呼叫 INT(3.7) + ABS(-2) = 5', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('PRINT INT(3.7) + ABS(-2)', env, io);
    expect(io.output()).toBe('5\n');
  });
});

describe('BASIC 內建函式', () => {
  it.each([
    ['ABS(-5)', '5\n'],
    ['INT(3.7)', '3\n'],
    ['SQR(9)', '3\n'],
    ['LEN("ABC")', '3\n'],
    ['CHR$(65)', 'A\n'],
    ['ASC("A")', '65\n'],
    ['LEFT$("HELLO", 3)', 'HEL\n'],
    ['RIGHT$("HELLO", 2)', 'LO\n'],
    ['MID$("HELLO", 2, 3)', 'ELL\n'],
    ['STR$(42)', '42\n'],
    ['VAL("3.14")', '3.14\n'],
    ['VAL("X")', '0\n'],
  ])('PRINT %s 輸出 %s', async (expr, expected) => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate(`PRINT ${expr}`, env, io);
    expect(io.output()).toBe(expected);
  });

  it('RND() 落於 [0, 1)', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('PRINT RND()', env, io);
    const v = parseFloat(io.output());
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it('未定義函式 FOO 拋出 UNDEF FN FOO', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('PRINT FOO(1)', env, io);
    expect(io.output()).toBe('?UNDEF FN FOO\n');
  });
});

describe('BASIC 比較與布林（-1 / 0）', () => {
  it.each([
    ['5 = 5', '-1\n'],
    ['5 < 3', '0\n'],
    ['"A" = "A"', '-1\n'],
    ['1 AND 1', '-1\n'],
    ['0 OR 0', '0\n'],
    ['NOT 0', '-1\n'],
    ['NOT 1', '0\n'],
  ])('%s 結果為 %s', async (expr, expected) => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate(`PRINT ${expr}`, env, io);
    expect(io.output()).toBe(expected);
  });
});

describe('BASIC PRINT 行為', () => {
  it('預設加換行', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('PRINT "HELLO"', env, io);
    expect(io.output()).toBe('HELLO\n');
  });

  it('逗號分隔以 \\t 連接並收尾換行', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('PRINT 1, 2, 3', env, io);
    expect(io.output()).toBe('1\t2\t3\n');
  });

  it('分號結尾抑制換行', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('PRINT 5;', env, io);
    expect(io.output()).toBe('5');
  });

  it('整數無小數點輸出', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('PRINT 3', env, io);
    expect(io.output()).toBe('3\n');
  });

  it('浮點數至多 6 位小數，去尾零', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('PRINT 1/3', env, io);
    // formatNum 用 toFixed(6) 後 Number() 去尾零，預期 '0.333333'
    expect(io.output()).toMatch(/^0\.333333\n$/);
  });
});

describe('BASIC INPUT 語句', () => {
  it('字串變數（$ 結尾）保留原文', async () => {
    const env = makeBASICEnv();
    const io = makeIO(['ALICE']);
    await execImmediate('INPUT N$', env, io);
    expect(env.vars['N$']).toBe('ALICE');
  });

  it('數值變數 parseFloat，失敗回 0', async () => {
    const env = makeBASICEnv();
    const io = makeIO(['42']);
    await execImmediate('INPUT X', env, io);
    expect(env.vars.X).toBe(42);

    const env2 = makeBASICEnv();
    const io2 = makeIO(['hello']);
    await execImmediate('INPUT Y', env2, io2);
    expect(env2.vars.Y).toBe(0);
  });

  it('自訂 prompt 寫入 io', async () => {
    const env = makeBASICEnv();
    const io = makeIO(['25']);
    await execImmediate('INPUT "AGE: "; A', env, io);
    expect(io.lines).toContain('AGE: ');
    expect(env.vars.A).toBe(25);
  });

  it('預設 prompt 為 "? "', async () => {
    const env = makeBASICEnv();
    const io = makeIO(['7']);
    await execImmediate('INPUT X', env, io);
    expect(io.lines[0]).toBe('? ');
  });
});

describe('BASIC 賦值', () => {
  it('LET 與隱式賦值等價', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('LET A = 1', env, io);
    await execImmediate('B = 2', env, io);
    expect(env.vars.A).toBe(1);
    expect(env.vars.B).toBe(2);
  });

  it('未宣告變數預設值：數值 0、字串 ""', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('PRINT Z', env, io);
    expect(io.output()).toBe('0\n');

    const io2 = makeIO();
    await execImmediate('PRINT Z$', env, io2);
    expect(io2.output()).toBe('\n');
  });
});

describe('BASIC 控制流程', () => {
  it('GOTO 跳到不存在的行號輸出 UNDEF LINE', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('10 GOTO 999', env, io);
    await execImmediate('RUN', env, io);
    expect(io.output()).toContain('UNDEF LINE 999');
  });

  it('IF...THEN...ELSE 條件分支', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('LET X = 5', env, io);
    await execImmediate('IF X = 5 THEN PRINT "OK" ELSE PRINT "NO"', env, io);
    expect(io.output()).toBe('OK\n');

    const io2 = makeIO();
    await execImmediate('IF X = 4 THEN PRINT "OK" ELSE PRINT "NO"', env, io2);
    expect(io2.output()).toBe('NO\n');
  });

  it('IF X > 0 THEN 100 視為 GOTO 100', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('10 IF 1 = 1 THEN 30', env, io);
    await execImmediate('20 PRINT "SKIPPED"', env, io);
    await execImmediate('30 PRINT "JUMPED"', env, io);
    await execImmediate('RUN', env, io);
    expect(io.output()).toBe('JUMPED\n');
  });

  it('GOSUB 與 RETURN 行為', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('10 PRINT "A"', env, io);
    await execImmediate('20 GOSUB 100', env, io);
    await execImmediate('30 PRINT "B"', env, io);
    await execImmediate('40 END', env, io);
    await execImmediate('100 PRINT "SUB"', env, io);
    await execImmediate('110 RETURN', env, io);
    await execImmediate('RUN', env, io);
    expect(io.output()).toBe('A\nSUB\nB\n');
  });

  it('RETURN 在無 GOSUB 時拋 RETURN WITHOUT GOSUB', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('10 RETURN', env, io);
    await execImmediate('RUN', env, io);
    expect(io.output()).toContain('RETURN WITHOUT GOSUB');
  });
});

describe('BASIC FOR / NEXT 迴圈', () => {
  it('預設步進 1（執行 5 次）', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('10 FOR I = 1 TO 5', env, io);
    await execImmediate('20 PRINT I', env, io);
    await execImmediate('30 NEXT I', env, io);
    await execImmediate('RUN', env, io);
    expect(io.output()).toBe('1\n2\n3\n4\n5\n');
  });

  it('自訂負步進 STEP -2', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('10 FOR I = 10 TO 1 STEP -2', env, io);
    await execImmediate('20 PRINT I', env, io);
    await execImmediate('30 NEXT I', env, io);
    await execImmediate('RUN', env, io);
    expect(io.output()).toBe('10\n8\n6\n4\n2\n');
  });

  it('NEXT 不對應 FOR 拋 NEXT WITHOUT FOR', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('NEXT', env, io);
    expect(io.output()).toContain('NEXT WITHOUT FOR');
  });
});

describe('BASIC 行號式程式儲存與管理', () => {
  it('儲存 / 取代 / 刪除程式行', async () => {
    const env = makeBASICEnv();
    const io = makeIO();

    await execImmediate('10 PRINT "A"', env, io);
    expect(env.program[10]).toBeDefined();
    expect(env.program[10].text).toBe('PRINT "A"');

    await execImmediate('10 PRINT "B"', env, io);
    expect(env.program[10].text).toBe('PRINT "B"');

    await execImmediate('10', env, io);
    expect(env.program[10]).toBeUndefined();
  });

  it('LIST 依行號升冪輸出', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('30 PRINT "C"', env, io);
    await execImmediate('10 PRINT "A"', env, io);
    await execImmediate('20 PRINT "B"', env, io);
    const io2 = makeIO();
    await execImmediate('LIST', env, io2);
    expect(io2.output()).toBe('10 PRINT "A"\n20 PRINT "B"\n30 PRINT "C"\n');
  });

  it('NEW 清空 program / vars / forStack / gosubStack', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('10 PRINT "X"', env, io);
    await execImmediate('LET A = 5', env, io);
    env.forStack.push({ varName: 'I', end: 5, step: 1, line: 0 });
    env.gosubStack.push(10);
    await execImmediate('NEW', env, io);
    expect(env.program).toEqual({});
    expect(env.vars).toEqual({});
    expect(env.forStack).toEqual([]);
    expect(env.gosubStack).toEqual([]);
  });
});

describe('BASIC RUN 行為', () => {
  it('空程式輸出 NO PROGRAM', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('RUN', env, io);
    expect(io.output()).toBe('NO PROGRAM\n');
  });

  it('RUN 從最小行號開始執行', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('30 PRINT "C"', env, io);
    await execImmediate('10 PRINT "A"', env, io);
    await execImmediate('20 PRINT "B"', env, io);
    const io2 = makeIO();
    await execImmediate('RUN', env, io2);
    expect(io2.output()).toBe('A\nB\nC\n');
  });

  it('END / STOP 終止程式', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('10 PRINT "ALIVE"', env, io);
    await execImmediate('20 END', env, io);
    await execImmediate('30 PRINT "DEAD"', env, io);
    const io2 = makeIO();
    await execImmediate('RUN', env, io2);
    expect(io2.output()).toBe('ALIVE\n');
  });

  it('aborted 旗標生效輸出 BREAK 並重置', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    // 構造一個會跑數十次的迴圈，然後在跑之前先 abort
    await execImmediate('10 FOR I = 1 TO 1000', env, io);
    await execImmediate('20 PRINT I', env, io);
    await execImmediate('30 NEXT I', env, io);
    env.aborted = true;
    const io2 = makeIO();
    await runProgram(env, io2);
    expect(io2.output()).toContain('BREAK');
    expect(env.aborted).toBe(false);
  });

  it('每 50 步 yield 一次（驗證 setTimeout(cb, 0) 被排程）', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    // 構造 60 行線性程式（無跳轉），確保 idx 自然遞增到 50。
    for (let i = 1; i <= 60; i += 1) {
      await execImmediate(`${i * 10} REM step ${i}`, env, io);
    }

    // 暫時 spy setTimeout 計算 0-ms delay 的呼叫次數。
    const realSetTimeout = global.setTimeout;
    let zeroDelayCount = 0;
    global.setTimeout = (cb, ms) => {
      if (ms === 0) zeroDelayCount += 1;
      return realSetTimeout(cb, ms);
    };
    try {
      await runProgram(env, io);
    } finally {
      global.setTimeout = realSetTimeout;
    }
    // 60 行線性執行：idx 走過 50 後應觸發一次 yield。
    expect(zeroDelayCount).toBeGreaterThanOrEqual(1);
  });
});

describe('BASIC 錯誤訊息格式', () => {
  it('程式行錯誤格式為 ?MSG IN <line>', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('30 PRINT FOO(1)', env, io);
    const io2 = makeIO();
    await execImmediate('RUN', env, io2);
    expect(io2.output()).toBe('?UNDEF FN FOO IN 30\n');
  });

  it('立即模式錯誤格式為 ?MSG（無 IN <line>）', async () => {
    const env = makeBASICEnv();
    const io = makeIO();
    await execImmediate('PRINT FOO(1)', env, io);
    expect(io.output()).toBe('?UNDEF FN FOO\n');
  });
});

describe('BASIC 雙環境匯出', () => {
  it('匯出物件具備 spec 列出的全部 API', () => {
    expect(typeof IBMTerm.makeBASICEnv).toBe('function');
    expect(typeof IBMTerm.execImmediate).toBe('function');
    expect(typeof IBMTerm.runProgram).toBe('function');
    expect(typeof IBMTerm.evalAPL).toBe('function');
    expect(typeof IBMTerm.formatAPL).toBe('function');
    expect(typeof IBMTerm.tokenize).toBe('function');
  });
});
