// docker/docker-compose.yaml 之 compose project name 守護測試
// 對應 spec：openspec/changes/add-docker-compose-project-name/specs/docker-runtime/spec.md
//   「Compose project name 隔離」Requirement，Scenario「自動化檢查守護 `name:` 設定」
// 對應 task：tasks.md task 2.1
//
// 設計理由（見 design.md Decision 2）：
// - 既有測試以 vitest 為主，沿用同一 runner，可在
//   `docker compose -f docker/docker-compose.yaml run --rm web-test npm test` 中執行。
// - 不引入 js-yaml 新依賴；以「字串/regex」與「行區塊掃描」雙層斷言：
//   1) anchored regex 確認 `name: ibn5100-terminal` 出現於某一行且無縮排。
//   2) 行區塊掃描確認該行位於任何 `services:` 區塊之前（或至少不在某 service 縮排內），
//      避免被誤縮排到 service 內仍誤判通過。
// - 失敗訊息附上可辨識的行號與上下文片段，便於回歸時定位。

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const COMPOSE_PATH = join(ROOT, 'docker', 'docker-compose.yaml');

const EXPECTED_NAME = 'ibn5100-terminal';

/**
 * 讀取 compose yaml 全文。
 * @returns {string}
 */
function readCompose() {
  return readFileSync(COMPOSE_PATH, 'utf8');
}

/**
 * 找出 compose yaml 中「位於 top-level（無縮排）的 name 行」之 0-based 行號。
 * 規則：
 *   - 行首即為 `name:`（不允許前導空白）。
 *   - 不視作註解（以 `#` 起頭整行視為註解，跳過）。
 * @param {string} src
 * @returns {{ lineIndex: number, value: string } | null}
 */
function findTopLevelNameLine(src) {
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // 跳過註解與空行。
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue;
    // 嚴格 top-level：行首即 `name:`，不允許前導空白。
    const m = line.match(/^name:\s*(\S+)\s*$/);
    if (m) {
      return { lineIndex: i, value: m[1] };
    }
  }
  return null;
}

/**
 * 找出第一個 top-level `services:` 行的 0-based 行號（不存在回傳 -1）。
 * @param {string} src
 * @returns {number}
 */
function findServicesLineIndex(src) {
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (/^services:\s*$/.test(lines[i])) return i;
  }
  return -1;
}

describe('docker compose project name 守護', () => {
  it('docker/docker-compose.yaml 頂層含 name 欄位且值為預期 project name', () => {
    const src = readCompose();
    const found = findTopLevelNameLine(src);
    expect(
      found,
      `docker/docker-compose.yaml 頂層找不到無縮排的 name: 欄位（請確認該欄位是否被誤刪、誤改值、或誤縮排到 service 內）`,
    ).not.toBeNull();
    expect(
      found.value,
      `docker/docker-compose.yaml 頂層 name 應為 "${EXPECTED_NAME}"，實際為 "${found.value}"（line ${found.lineIndex + 1}）`,
    ).toBe(EXPECTED_NAME);
  });

  it('name 欄位出現於 services: 區塊之前（避免被誤縮排或誤放到 service 內）', () => {
    const src = readCompose();
    const found = findTopLevelNameLine(src);
    expect(found).not.toBeNull();
    const servicesIndex = findServicesLineIndex(src);
    expect(
      servicesIndex,
      'docker/docker-compose.yaml 找不到 top-level `services:` 行',
    ).toBeGreaterThanOrEqual(0);
    expect(
      found.lineIndex,
      `name 欄位（line ${found.lineIndex + 1}）必須位於 services:（line ${servicesIndex + 1}）之前；若位於之後請確認其縮排是否被誤改`,
    ).toBeLessThan(servicesIndex);
  });

  it('anchored regex 比對：以 multiline flag 找到無縮排的 name 行', () => {
    const src = readCompose();
    // 使用 anchored multiline regex 二度確認；與 findTopLevelNameLine 互為驗證。
    const re = new RegExp(`^name:\\s*${EXPECTED_NAME}\\s*$`, 'm');
    expect(
      re.test(src),
      'anchored regex /^name:\\s*<expected>\\s*$/m 未在 docker/docker-compose.yaml 命中；請確認該行是否被縮排或值被改動',
    ).toBe(true);
  });
});
