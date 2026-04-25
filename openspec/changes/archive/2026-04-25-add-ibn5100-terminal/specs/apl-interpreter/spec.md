## ADDED Requirements

### Requirement: APL tokenizer

The system SHALL tokenize an APL line into numeric, string, identifier, and operator tokens using APL conventions: `¯` as the negative-number sign, single-quoted string literals, and Unicode glyphs as operators.

#### Scenario: 數字含 APL 負號

- **WHEN** 輸入 `¯3 + 5`
- **THEN** tokenizer 產出 `{t:'num',v:-3}`、`{t:'op',v:'+'}`、`{t:'num',v:5}`

#### Scenario: 字串使用單引號

- **WHEN** 輸入 `'HELLO'`
- **THEN** 產出 `{t:'str',v:'HELLO'}`

#### Scenario: 連續數字構成向量

- **WHEN** 輸入 `1 2 3 4`
- **THEN** 產出四個 `{t:'num'}` token；evaluator 後續會將連續 num 合併為向量 `[1,2,3,4]`

#### Scenario: 識別字保留大小寫

- **WHEN** 輸入 `X ← 5`
- **THEN** identifier token 為 `{t:'id',v:'X'}`（不被強制大寫）

### Requirement: 單元（monadic）符號運算

The system SHALL implement monadic forms for the following glyphs: `⍳` (iota), `⍴` (shape), `-` (negate), `+` (identity), `×` (sign), `÷` (reciprocal), `⌈` (ceiling), `⌊` (floor), `|` (absolute), `*` (exp), `⍒` (descending grade), `⍋` (ascending grade), `≡` (depth, simplified), `⍕` (format), `~` (logical NOT).

#### Scenario: ⍳ N 產生 1..N

- **WHEN** 求值 `⍳ 5`
- **THEN** 結果為向量 `[1, 2, 3, 4, 5]`

#### Scenario: ⍴ V 取得 shape

- **WHEN** 求值 `⍴ 1 2 3 4`
- **THEN** 結果為 `[4]`（1-element vector 表示 shape）

#### Scenario: 一元算術

- **WHEN** 求值
- **THEN**
  - `- 1 2 3` 結果為 `[-1, -2, -3]`
  - `÷ 2` 結果為 `0.5`
  - `⌈ 1.2` 結果為 `2`、`⌊ 1.7` 結果為 `1`
  - `| ¯3` 結果為 `3`
  - `× ¯2 0 5` 結果為 `[-1, 0, 1]`（sign）

#### Scenario: ⍋ ⍒ 取得排序索引

- **WHEN** 求值 `⍋ 3 1 2`
- **THEN** 結果為升冪排序後對應原始位置的 1-indexed 索引（`[2, 3, 1]`）
- **WHEN** 求值 `⍒ 3 1 2`
- **THEN** 結果為降冪排序索引（`[1, 3, 2]`）

#### Scenario: NONCE ERROR 對未支援單元符號

- **WHEN** 對未實作的符號（如 `?`）以 monadic 形式求值
- **THEN** 拋出 `Error('NONCE ERROR')`

### Requirement: 雙元（dyadic）符號運算

The system SHALL implement dyadic forms for: `+`, `-`, `×`, `÷`, `*` (power), `⌈` (max), `⌊` (min), `|` (residue: `y mod x`), `⍴` (reshape), `=`, `≠`, `<`, `>`, `≤`, `≥`, `,` (catenate).

#### Scenario: 純量對純量算術

- **WHEN** 求值
- **THEN**
  - `2 + 3` 結果為 `5`
  - `10 - 4` 結果為 `6`
  - `2 × 3` 結果為 `6`
  - `10 ÷ 4` 結果為 `2.5`
  - `2 * 8` 結果為 `256`（power）
  - `5 ⌈ 3` 結果為 `5`、`5 ⌊ 3` 結果為 `3`
  - `3 | 10` 結果為 `1`（10 mod 3）

#### Scenario: 純量廣播至向量

- **WHEN** 求值 `2 × 1 2 3`
- **THEN** 結果為 `[2, 4, 6]`（左純量、右向量）
- **WHEN** 求值 `1 2 3 + 10`
- **THEN** 結果為 `[11, 12, 13]`

#### Scenario: 等長向量逐元素

- **WHEN** 求值 `1 2 3 + 10 20 30`
- **THEN** 結果為 `[11, 22, 33]`

#### Scenario: 不等長向量拋 LENGTH ERROR

- **WHEN** 求值 `1 2 + 1 2 3`
- **THEN** 拋出 `Error('LENGTH ERROR')`

#### Scenario: ⍴ reshape

- **WHEN** 求值 `4 ⍴ 1 2 3`
- **THEN** 結果為向量 `[1, 2, 3, 1]`（重複前置）
- **WHEN** 求值 `6 ⍴ 1 2 3`
- **THEN** 結果為 `[1, 2, 3, 1, 2, 3]`

#### Scenario: 比較運算回 0/1

- **WHEN** 求值 `1 2 3 = 1 0 3`
- **THEN** 結果為 `[1, 0, 1]`
- **AND** 注意：APL 的真假慣例為 `1` / `0`，**與 BASIC 的 `-1` / `0` 不同**

#### Scenario: catenate

- **WHEN** 求值 `1 2 , 3 4`
- **THEN** 結果為 `[1, 2, 3, 4]`

### Requirement: 賦值（`←`）

The system SHALL parse `<name> ← <expression>` lines that store the value into the APL environment without producing screen output.

#### Scenario: 賦值不 echo

- **WHEN** 輸入 `X ← 1 2 3`
- **THEN** APL evaluator 回傳 `null`（不輸出），但 `env.X` 等於 `[1, 2, 3]`

#### Scenario: 變數讀取

- **WHEN** 在賦值後輸入 `+/X` 或 `X + 10`（具體運算依本 spec 範圍）
- **THEN** evaluator 能透過 `env.X` 找到該變數
- **AND** 對未定義名稱求值拋 `Error('VALUE ERROR')`

### Requirement: 由右而左求值與括號

The system SHALL evaluate APL expressions right-to-left and SHALL recursively evaluate parenthesised sub-expressions.

#### Scenario: 右結合

- **WHEN** 求值 `2 × 3 + 4`
- **THEN** 結果為 `14`（`2 × (3 + 4)`，APL right-to-left；非 BASIC 的 `(2*3)+4`）

#### Scenario: 括號改變優先

- **WHEN** 求值 `(2 × 3) + 4`
- **THEN** 結果為 `10`

### Requirement: 結果格式化（`formatAPL`）

The system SHALL provide a `formatAPL(value)` helper that converts a scalar / vector / string / null into a printable string for the screen.

#### Scenario: 格式化規則

- **WHEN** 呼叫 `formatAPL`
- **THEN**
  - `null` 或 `undefined` 回傳空字串
  - 向量以單一空白字元間隔逐元素輸出
  - 非整數元素以 `.toFixed(4)` 呈現
  - 整數元素以 `String(x)` 呈現（無小數點）
  - 純量字串以 `String(x)` 呈現

### Requirement: 雙環境模組匯出（與 BASIC 共用同一檔）

The system SHALL expose APL helpers (`evalAPL`, `formatAPL`) on the same `IBMTerm` namespace used by BASIC, available in both browser globals and Node module exports.

#### Scenario: 介面共存

- **WHEN** 載入 interpreter 模組（瀏覽器或 Node）
- **THEN** `IBMTerm.evalAPL` 與 `IBMTerm.formatAPL` 與 BASIC API 同層存在，且不互相干擾
