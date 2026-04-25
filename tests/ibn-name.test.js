// 避商標（avoid IBM trademark）字串掃描測試
// 對應 spec：openspec/changes/add-ibn5100-terminal/specs/easter-eggs/spec.md
//   「彩蛋與 IBN-5100 命名互斥於 IBM」Requirement
// 對應 task：tasks.md task 4.6
//
// 解讀（見 issues.md）：spec scenario 寫的是「掃描字串字面值」；本檔依此 narrower 語意：
// - .html / .css 全文掃描（無註解概念，內容本身即可顯示給使用者）
// - .js 僅掃描 string literals（單引號 / 雙引號 / 反引號內容），不算 JS identifier。
//   這是為了相容 design.md Goal #4「保留 window.IBMTerm / window.IBMSound 全域命名空間」。
// - README.md：用反引號 markdown code 包裹的 `IBM5100` 為白名單（指 GitHub repo 名稱）。

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WEB = join(ROOT, 'web');

/**
 * 提取 JS 來源中所有 string literal 的內容（單引號、雙引號、反引號）。
 * 簡化版 lexer：能處理 \\、\'、\" 跳脫；不處理 template literal 內嵌 ${} 表達式
 * （內嵌表達式中如果出現字串會在後續輪次被掃到，整體仍能涵蓋）。
 * @param {string} src - JS 原始碼
 * @returns {string[]} 所有 string literal 的內容（不含引號本身）
 */
function extractJsStringLiterals(src) {
  const out = [];
  let i = 0;
  const len = src.length;
  while (i < len) {
    const c = src[i];
    // 跳過行註解
    if (c === '/' && src[i + 1] === '/') {
      while (i < len && src[i] !== '\n') i += 1;
      continue;
    }
    // 跳過區塊註解
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < len && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    // 字串文字（含 template）：
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      let j = i + 1;
      let buf = '';
      while (j < len) {
        const ch = src[j];
        if (ch === '\\') { buf += ch + (src[j + 1] || ''); j += 2; continue; }
        if (ch === quote) break;
        buf += ch;
        j += 1;
      }
      out.push(buf);
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return out;
}

/**
 * 將 README markdown 中 backtick-IBM5100-backtick 等白名單字串移除，
 * 以便後續 IBM regex 不誤判合法的 repo 引用。
 * @param {string} md
 * @returns {string}
 */
function stripReadmeWhitelist(md) {
  // 移除 markdown 反引號包覆的 IBM5100 引用：`IBM5100`、`IBM5100/` 等
  let stripped = md.replace(/`[^`]*IBM5100[^`]*`/g, '`<repo-name-redacted>`');
  // 移除 markdown 區塊（```...```）中的內容（含程式碼示例可能引用 repo URL）
  stripped = stripped.replace(/```[\s\S]*?```/g, '```<code-block-redacted>```');
  // 移除 GitHub URL 形式 https://github.com/.../IBM5100(.git)?
  stripped = stripped.replace(/https?:\/\/[^\s)]+IBM5100[^\s)]*/g, '<github-url-redacted>');
  return stripped;
}

describe('避商標掃描：HTML/CSS 全文', () => {
  it.each([
    ['web/index.html'],
    ['web/styles.css'],
  ])('%s 不含 IBM / ibm', (rel) => {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    expect(src).not.toMatch(/IBM/i);
  });
});

describe('避商標掃描：JS 字串字面值', () => {
  it.each([
    ['web/audio.js'],
    ['web/interpreter.js'],
    ['web/tapes.js'],
    ['web/tweaks-panel.js'],
    ['web/app.js'],
  ])('%s 的字串字面值不含 IBM / ibm', (rel) => {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    const literals = extractJsStringLiterals(src);
    for (const lit of literals) {
      expect(lit, `String literal in ${rel}: ${JSON.stringify(lit)}`).not.toMatch(/IBM/i);
    }
  });

  it('app.js 含至少一個 IBN 字面值（防呆，確保檔案被正確讀取）', () => {
    const src = readFileSync(join(ROOT, 'web', 'app.js'), 'utf8');
    const literals = extractJsStringLiterals(src);
    expect(literals.some(l => l.includes('IBN-5100'))).toBe(true);
  });
});

describe('避商標掃描：tests/ 字串字面值', () => {
  it.each([
    'tests/basic-interpreter.test.js',
    'tests/apl-interpreter.test.js',
    'tests/tapes.test.js',
    'tests/audio-shape.test.js',
    'tests/easter-eggs.test.js',
  ])('%s 的字串字面值不含 IBM / ibm', (rel) => {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    const literals = extractJsStringLiterals(src);
    for (const lit of literals) {
      // tests 內部允許 'IBM-5100' 字面 negative assertions（如 expect(...).not.toContain('IBM-5100')）
      // 但這已經是字串字面值會被掃到。處理方式：白名單測試來源檔內以 .not.toContain 的字面值
      // 以特殊 marker 區分。實務上：tests 中如果出現 'IBM-5100'，是反向斷言用，可允許。
      // 這裡採嚴格規則：tests 字面值同樣不可有 IBM。為相容 easter-eggs 測試的 negative assertion，
      // 該測試已避免使用 'IBM-5100' literal。
      expect(lit, `String literal in ${rel}: ${JSON.stringify(lit)}`).not.toMatch(/IBM/i);
    }
  });
});

describe('避商標掃描：README.md', () => {
  it('經白名單轉換後 README 內容不含 IBM / ibm', () => {
    const src = readFileSync(join(ROOT, 'README.md'), 'utf8');
    const stripped = stripReadmeWhitelist(src);
    expect(stripped).not.toMatch(/IBM/i);
  });
});
