// 彩蛋（Easter eggs）字面值掃描測試
// 對應 spec：openspec/changes/add-ibn5100-terminal/specs/easter-eggs/spec.md
//
// 由於彩蛋邏輯散落在 React 元件中（app.js）並依賴 React runtime，純函式測試以 grep
// app.js 內字面值的方式驗證 spec 要求的字串、目標序列、機率常數存在。

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_PATH = join(__dirname, '..', 'web', 'app.js');
const APP_SRC = readFileSync(APP_PATH, 'utf8');

describe('EL PSY KONGROO 加密通訊彩蛋', () => {
  it('app.js 含 EL PSY KONGROO 與 EL PSY CONGROO 兩種比對字串', () => {
    expect(APP_SRC).toContain("'EL PSY KONGROO'");
    expect(APP_SRC).toContain("'EL PSY CONGROO'");
  });

  it('app.js 含 CHANNEL VERIFIED. / TRANSMISSION SECURE. / ...EL PSY KONGROO. payload', () => {
    expect(APP_SRC).toContain('CHANNEL VERIFIED.');
    expect(APP_SRC).toContain('TRANSMISSION SECURE.');
    expect(APP_SRC).toContain('...EL PSY KONGROO.');
  });
});

describe('開機 WORLD LINE 顯示', () => {
  it('BOOT_LINES 含 1.130426 字串', () => {
    expect(APP_SRC).toContain('1.130426');
  });

  it('BOOT_LINES 含 WORLD LINE 字面值', () => {
    expect(APP_SRC).toContain('WORLD LINE ............ 1.130426');
  });
});

describe('∂.404 divergence 目標序列', () => {
  it('app.js 含完整 6 元素目標序列', () => {
    const targets = ['1.130426', '0.571024', '1.048596', '0.337187', '0.523299', '1.130205'];
    for (const v of targets) {
      expect(APP_SRC).toContain(`'${v}'`);
    }
  });

  it('glitch 動畫間隔為 2400 ms、切回延遲 80 ms', () => {
    // setInterval(... , 2400) 與 setTimeout(... , 80) 的字面數字
    expect(APP_SRC).toMatch(/2400\s*\)/);
    expect(APP_SRC).toMatch(/,\s*80\s*\)/);
  });

  it('包含 DIVERGENCE 內建命令分支', () => {
    expect(APP_SRC).toContain("'DIVERGENCE'");
    expect(APP_SRC).toContain("'divergence'");
  });
});

describe('長閒置 SERN whisper', () => {
  it('WHISPERS 池含 spec 列出的 5 句字面值', () => {
    const whispers = [
      '> EL PSY KONGROO',
      '> [SERN PACKET INTERCEPTED]',
      '> WORLD LINE DRIFT: 0.000048',
      '> 2010-08-21  AKIHABARA',
      '> CHANNEL OPEN',
    ];
    for (const w of whispers) {
      expect(APP_SRC).toContain(w);
    }
  });

  it('使用 0.4 的 Math.random 機率閾值', () => {
    expect(APP_SRC).toMatch(/Math\.random\(\)\s*<\s*0\.4/);
  });

  it('閒置間隔為 45000 ms', () => {
    expect(APP_SRC).toMatch(/,\s*45000\s*\)/);
  });
});

describe('彩蛋與 IBN-5100 命名（user-facing strings）', () => {
  it('使用者面 boot 字串使用 IBN', () => {
    // spec/easter-eggs scenario「自動化檢查」具體實作詳見 ibn-name.test.js；
    // 此處僅確認常見字面值存在 IBN-5100。完整避商標掃描由 ibn-name.test.js 負責。
    expect(APP_SRC).toContain('IBN-5100  PORTABLE COMPUTER');
  });
});
