# tape-system Specification

## Purpose
TBD - created by archiving change add-ibn5100-terminal. Update Purpose after archive.
## Requirements
### Requirement: 磁帶 catalog 元資料

The system SHALL define a global `window.TAPES` array containing exactly seven cartridges with strict metadata.

#### Scenario: 七卷磁帶完整存在且順序固定

- **WHEN** 程式載入完成
- **THEN** `window.TAPES` 為長度 7 的陣列，依序為：
  1. `{ id:'HELLO', label:'HELLO', side:'A', desc:'GREETING ROUTINE' }`
  2. `{ id:'CLOCK', label:'CLOCK', side:'A', desc:'REAL-TIME CLOCK', source:'__BUILTIN_CLOCK__' }`
  3. `{ id:'FIB', label:'FIB-12', side:'B', desc:'FIBONACCI 1..12' }`
  4. `{ id:'PRIME', label:'PRIME', side:'B', desc:'SIEVE 2..50' }`
  5. `{ id:'GUESS', label:'GUESS', side:'C', desc:'NUMBER GUESS GAME' }`
  6. `{ id:'CALC', label:'CALC', side:'C', desc:'INTERACTIVE CALCULATOR' }`
  7. `{ id:'DIVERG', label:'∂.404', side:'?', desc:'WORLD LINE METER', source:'__BUILTIN_DIVERGENCE__' }`

#### Scenario: BASIC 來源磁帶帶有 source 字串

- **WHEN** 檢查 HELLO / FIB / PRIME / GUESS / CALC 五卷磁帶
- **THEN** 每卷的 `source` 為以 `\n` 連接的合法 BASIC 行號程式（與 design 來源一致），且不為兩個 `__BUILTIN_*` 之一

#### Scenario: 雙環境匯出

- **WHEN** 在 Node 測試環境 `require('../web/tapes.js')`
- **THEN** 取得相同 7 卷磁帶資料（CommonJS / ESM 對外、瀏覽器內也同步掛上 `window.TAPES`）

### Requirement: TAPES 列表命令

The system SHALL print the tape list in response to the `TAPES` command, formatted exactly per design.

#### Scenario: TAPES 命令輸出格式

- **WHEN** 使用者輸入 `TAPES` 並按 Enter
- **THEN** 輸出 `AVAILABLE TAPES:\n`
- **AND** 對每卷磁帶輸出一行 `  <label.padEnd(10)><desc>\n`
- **AND** 結尾輸出 `USE: LOAD <NAME>\n`

### Requirement: LOAD 載入流程（含視覺、音效、模擬讀取）

The system SHALL load a cartridge in response to `LOAD <NAME>` (case-insensitive, matching either `id` or `label`), unloading the previous tape if necessary, animating the reels, playing tape audio, and either parsing BASIC source into `env.program` or switching to the appropriate built-in viewer.

#### Scenario: LOAD 不存在的磁帶

- **WHEN** 使用者輸入 `LOAD FOO`
- **THEN** 輸出 `?TAPE NOT FOUND\n`，不變動其他狀態

#### Scenario: LOAD 替換現有磁帶

- **WHEN** 已載入 `HELLO`，使用者再執行 `LOAD FIB-12`
- **THEN** 先呼叫 audio-engine `tapeStop` 並輸出 `UNLOADING HELLO...\n`、等待 ~300 ms
- **AND** 之後依新磁帶執行載入序列

#### Scenario: LOAD 視覺與音效

- **WHEN** 開始載入任何磁帶
- **THEN** `tape` state 設為新磁帶、`tapeSpinning` 設為 true（兩顆 reel 套 `spin` class，做 1.2s 線性旋轉）
- **AND** 呼叫 audio-engine `tapeStart`，啟動 bandpass 噪音 + LFO chirp
- **AND** 螢幕輸出 `LOADING <label> [<desc>]\n`
- **AND** 模擬讀取：以 ~320 ms 間隔印出三次 `....`，最後加 ` OK\n`
- **AND** 短暫等待 200 ms 後停止 tape audio 與 reel 旋轉

#### Scenario: LOAD BASIC 來源磁帶

- **WHEN** 載入磁帶的 source 不是 `__BUILTIN_*`
- **THEN** 重置 `env.program = {}`，逐行呼叫 `execImmediate` 解析（忽略空行；個別解析錯誤不 break 載入流程）
- **AND** 全部行載入完畢輸出 `TYPE  RUN  TO EXECUTE,  LIST  TO VIEW.\n`

#### Scenario: LOAD CLOCK 切換內建檢視器

- **WHEN** 使用者執行 `LOAD CLOCK`（或從磁帶選單點選 CLOCK）
- **THEN** 在完成讀取序列後將 `builtinMode` 設為 `'clock'`
- **AND** 螢幕改為渲染 ClockView（見 crt-shell capability）
- **AND** 不對 BASIC env 做任何變更

#### Scenario: LOAD ∂.404 切換 divergence 檢視器

- **WHEN** 使用者執行 `LOAD ∂.404`（或選單點選）
- **THEN** 在完成讀取序列後將 `builtinMode` 設為 `'divergence'`
- **AND** 立即顯示初始世界線值 `1.130426`
- **AND** 進入週期性 glitch：每 2400 ms 顯示一個 7 位隨機數字字串（中間插小數點）80 ms 後切回固定目標序列 `['1.130426', '0.571024', '1.048596', '0.337187', '0.523299', '1.130205']` 中的下一個

### Requirement: EJECT 退片

The system SHALL eject the currently loaded cartridge in response to `EJECT`, stopping audio and clearing built-in viewers.

#### Scenario: 沒有磁帶時的 EJECT

- **WHEN** `tape === null` 時執行 `EJECT`
- **THEN** 輸出 `NO TAPE LOADED\n`，不執行其他副作用

#### Scenario: 退片動作

- **WHEN** `tape !== null` 時執行 `EJECT`
- **THEN** 呼叫 audio-engine `tapeStop`、設 `tapeSpinning = false`、`tape = null`、`builtinMode = null`
- **AND** 輸出 `TAPE EJECTED.\n`

### Requirement: 磁帶選單 UI

The system SHALL render a dropdown tape menu when the user clicks the `.tape-slot` while powered on, listing all cartridges with `SIDE` indicator and an EJECT option when a tape is loaded.

#### Scenario: 選單條目格式

- **WHEN** 使用者點開磁帶選單
- **THEN** 標題為 `<h4>SELECT CARTRIDGE</h4>`
- **AND** 每卷磁帶呈現一列 `<label> · SIDE <side>`，右側 `desc`
- **AND** 點選任一列即觸發等同 `LOAD <id>` 的流程

#### Scenario: EJECT 區塊只在已載入磁帶時顯示

- **WHEN** 已載入磁帶
- **THEN** 選單最底額外出現 `▲  EJECT  <當前 label>` 一列，點擊即觸發 `EJECT`

#### Scenario: 電源關閉時不可開啟選單

- **WHEN** `powerOn === false` 時點擊 `.tape-slot`
- **THEN** 不展開選單

### Requirement: 磁帶卡匣視覺狀態

The system SHALL render the cartridge slot showing either an empty placeholder or the loaded tape with two reels that animate while busy.

#### Scenario: 無磁帶顯示空槽

- **WHEN** `tape === null`
- **THEN** `.tape-cart` 套 `empty` class，顯示文字 `— EMPTY —`

#### Scenario: 有磁帶顯示 label 與兩顆 reel

- **WHEN** `tape !== null`
- **THEN** 顯示左 reel、磁帶 label、右 reel
- **AND** `tapeSpinning === true` 時兩顆 reel 同步套 `spin` class（1.2 秒線性旋轉動畫）

### Requirement: GUESS / CALC 與 INPUT 互動

The system SHALL allow tapes that issue `INPUT` calls (`GUESS`, `CALC`) to receive user input through the same async input pipeline used by `INPUT` keyword.

#### Scenario: GUESS 流程能完整跑完

- **WHEN** 載入 GUESS 並執行 `RUN`
- **THEN** 終端進入 INPUT 等待狀態（顯示 `> ` 提示），使用者可逐次輸入猜測；遊戲依規則回 `HIGHER` / `LOWER` / `GOT IT IN N TRIES.`
- **AND** 過程中 `busy === true`，但 `pendingInput` 為 resolver function，使按鍵不被 BUSY 阻擋

