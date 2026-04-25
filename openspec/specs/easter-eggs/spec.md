# easter-eggs Specification

## Purpose
TBD - created by archiving change add-ibn5100-terminal. Update Purpose after archive.
## Requirements
### Requirement: EL PSY KONGROO 加密通訊彩蛋

The system SHALL detect when the user enters `EL PSY KONGROO` (or the alternate spelling `EL PSY CONGROO`) at the command prompt and SHALL display a fixed encrypted-channel message.

#### Scenario: 觸發訊息序列

- **WHEN** 使用者在 BASIC 或 APL 模式下輸入 `EL PSY KONGROO` 並按 Enter（大小寫不限，比較前先 trim + uppercase）
- **THEN** 螢幕依序輸出（每行皆為 `print` 一次呼叫，含換行）：
  1. 一個空白行 `\n`
  2. `  CHANNEL VERIFIED.\n`
  3. `  TRANSMISSION SECURE.\n`
  4. 另一個空白行 `\n`
  5. `  ...EL PSY KONGROO.\n\n`
- **AND** 不執行任何 BASIC / APL 直譯
- **AND** 不變動 mode、tape、env 任何狀態

#### Scenario: 替代拼寫

- **WHEN** 使用者輸入 `EL PSY CONGROO`（C 而非 K）
- **THEN** 觸發完全相同的訊息序列（design 為了相容兩種常見拼寫）

#### Scenario: 部分匹配不觸發

- **WHEN** 使用者輸入 `EL PSY` 或 `EL PSY KONGROO!` 等非完全匹配字串
- **THEN** 不觸發彩蛋；該字串走一般 BASIC / APL 流程，會產生 `?SYNTAX ERROR\n`

### Requirement: 開機 WORLD LINE 顯示

The system SHALL include the line `WORLD LINE ............ 1.130426\n` as part of the boot POST sequence (see crt-shell capability).

#### Scenario: 開機顯示 1.130426

- **WHEN** 開機 POST 序列進行到 WORLD LINE 行
- **THEN** 文字精確為 `WORLD LINE ............ 1.130426\n`，不可省略或替換成其他值

### Requirement: ∂.404 世界線變動率錶 glitch

The system SHALL animate the divergence value when `builtinMode === 'divergence'`, alternating between random glitch values and a deterministic target sequence.

#### Scenario: 目標序列固定

- **WHEN** divergence 視圖開啟
- **THEN** 內部目標序列必須為陣列：`['1.130426', '0.571024', '1.048596', '0.337187', '0.523299', '1.130205']`
- **AND** 此序列被循環取用（`i % length`）

#### Scenario: glitch 顯示時序

- **WHEN** divergence 視圖每 2400 ms tick 一次
- **THEN** 先顯示一段格式為 `<digit>.<6-digit>` 的隨機數字（從 8 個隨機 0–9 中取前 7 個並插入小數點）
- **AND** 80 ms 後切換為目標序列的下一個值

#### Scenario: ESC 關閉 divergence

- **WHEN** 使用者在 divergence 視圖中按 Esc
- **THEN** `builtinMode` 設為 `null`，glitch interval 被清除，回到命令列

### Requirement: 長閒置 SERN whisper

The system SHALL emit, with probability 0.4, a single random whisper line from a fixed pool when the terminal has been idle (powered on, not booting, not busy, not in a built-in viewer) for 45 s without new lines being printed.

#### Scenario: whisper 池

- **WHEN** 觸發閒置條件
- **THEN** 隨機從以下五句中挑一句並 print 一行（含 `\n`）：
  1. `> EL PSY KONGROO`
  2. `> [SERN PACKET INTERCEPTED]`
  3. `> WORLD LINE DRIFT: 0.000048`
  4. `> 2010-08-21  AKIHABARA`
  5. `> CHANNEL OPEN`

#### Scenario: 機率 40% 不必觸發

- **WHEN** 閒置 timer 到期
- **THEN** 以 `Math.random() < 0.4` 判斷是否實際 print；其餘 60% 機率為靜默
- **AND** 任一狀態變動（新輸出、busy、tape 切換、builtinMode 進入）會清掉 timer，需重新計時

### Requirement: DIVERGENCE 內建命令

The system SHALL accept `DIVERGENCE` as a built-in command that switches `builtinMode` directly to `'divergence'` without going through tape loading.

#### Scenario: 直接命令

- **WHEN** 使用者輸入 `DIVERGENCE` 並 Enter
- **THEN** 立即設 `builtinMode = 'divergence'` 並進入相同 glitch 動畫
- **AND** 不撥放磁帶讀取音效

### Requirement: 彩蛋與 IBN-5100 命名互斥於 IBM

The system SHALL never display the literal string `IBM` in any user-facing surface (boot messages, tape labels, UI text, easter-egg payloads, help text); the brand reference SHALL always be `IBN-5100` or `IBN · 5100`.

#### Scenario: 自動化檢查

- **WHEN** 自動化測試掃描 `web/`、`tests/` 內所有 `.html` / `.css` / `.js` 字串字面值
- **THEN** 不出現連續三個字元 `IBM`（小寫亦不允許 `ibm`）
- **AND** 出現處須改為 `IBN`

