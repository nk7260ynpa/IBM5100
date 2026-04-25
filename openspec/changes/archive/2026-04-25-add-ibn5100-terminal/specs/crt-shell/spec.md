## ADDED Requirements

### Requirement: 機殼與面板靜態結構

The system SHALL render a fixed full-viewport machine bezel that contains a manufacturer plate (model + serial), a right-hand status plate, a CRT cabinet, a controls row, and an initial hint banner.

#### Scenario: 預設靜態元素都呈現

- **WHEN** 頁面載入完成且電源尚未開啟
- **THEN** DOM 必須包含以下節點，且 class 名稱完全符合：
  - `.machine` 為最外層
  - `.machine > .bezel` 為機殼
  - `.bezel > .plate` 含子元素 `.model`（文字 `IBN · 5100`）與 `.serial`（文字 `PORTABLE COMPUTER · S/N 042-5100-A`）
  - `.bezel > .plate-right` 含 `RAM 64K`、`BASIC · APL`、`FUTURE GADGET LAB` 三個 span
  - `.bezel > .crt-cabinet > .crt`，且 `.crt` 同時帶 `off` class
  - `.bezel > .controls`
  - `.bezel > .hint` 顯示文字 `FLIP POWER SWITCH TO BEGIN`

#### Scenario: 顯示文字一律使用 IBN-5100 而非 IBM-5100

- **WHEN** 任何 UI 文字（plate、boot 訊息、hint、help、tape 標籤、彩蛋訊息）被渲染
- **THEN** 文字中不得出現字串 `IBM`，只能使用 `IBN`（避免 IBM 商標）
- **AND** 此檢查須由自動化測試（grep 全部公開字串資源）覆蓋

### Requirement: 開機序列與 POST 訊息

The system SHALL play a deterministic boot sequence whenever the power switch transitions from OFF to ON, displaying the canonical POST self-check lines in order.

#### Scenario: 開機 POST 自檢序列依序顯示

- **WHEN** 使用者點擊 power switch 將電源切到 ON
- **THEN** 螢幕清空後依序累加顯示以下文字（每行間隔 200–380 ms 不等，必須以累加而非替換的方式呈現）：
  1. `IBN-5100  PORTABLE COMPUTER\n`
  2. `SYSTEM ROM v3.14   (C) 1975-1979\n`
  3. 空行 `\n`
  4. `POST .................. ` 接 `OK\n`
  5. `CORE MEMORY ........... ` 接 `65536 BYTES\n`
  6. `CRT WARMUP ............ ` 接 `OK\n`
  7. `TAPE DRIVE ............ ` 接 `READY\n`
  8. `INTERPRETER ........... ` 接 `BASIC / APL\n`
  9. 空行 `\n`
  10. `WORLD LINE ............ 1.130426\n`
  11. 空行 `\n`
  12. `READY.\n`
- **AND** 同時觸發開機嗶聲（呼叫 audio-engine 的 boot beep）與 60 Hz hum

#### Scenario: 開機過程不接受鍵盤輸入

- **WHEN** POST 序列尚未完成（`booting` 狀態為 true）
- **THEN** 任何鍵盤輸入（除了 power 切換）皆不得寫入 input buffer，也不得觸發指令執行
- **AND** 螢幕不顯示輸入提示符與 cursor

#### Scenario: 開機完成後自動聚焦命令列

- **WHEN** POST 最後一行 `READY.\n` 顯示完畢
- **THEN** 隱藏的 `<input>` 必須取得焦點（不晚於 100 ms）
- **AND** 在螢幕底部顯示 `BASIC` mode pill、`> ` 提示符與閃爍 cursor

### Requirement: 關機序列

The system SHALL play a graceful shutdown animation when the power switch transitions from ON to OFF, releasing audio resources and clearing terminal state.

#### Scenario: 關機觸發 whine + CRT 收縮 + 狀態清空

- **WHEN** 使用者在電源 ON 狀態下點擊 power switch
- **THEN** 立即呼叫 audio-engine 的 shutdown whine 與 tape stop（若磁帶在轉），並停止 60 Hz hum
- **AND** `.crt` 取得 `shutting` class 觸發 `crt-collapse` 動畫（700 ms）
- **AND** 動畫結束後 `.crt` 切回 `off` class，螢幕顯示完全清空
- **AND** 內部狀態 `lines` / `inputBuf` / `pendingInput` / `tape` / `tapeSpinning` / `builtinMode` 全部重置為初始值

### Requirement: CRT 視覺特效層

The system SHALL render five overlapping visual effect layers above the screen content to recreate the CRT phosphor look.

#### Scenario: 五層特效節點都存在於 `.crt` 容器內

- **WHEN** 電源 ON 且非關機中
- **THEN** `.crt` 直接子節點包含且僅包含：`.screen`、`.scanlines`、`.sweep`、`.flicker`、`.glare`
- **AND** `.scanlines` 透過 `repeating-linear-gradient` 與 `--scanline-strength` CSS 變數呈現掃描線
- **AND** `.sweep` 套用 9 秒線性 `sweep` keyframe（`top: -10%` → `top: 110%`）
- **AND** `.flicker` 套用 6 秒不規則 `flick` keyframe（極微亮度脈衝）
- **AND** 開機過渡期 `.crt` 額外帶 `booting` class，觸發 1.4 秒 `crt-warmup` 濾鏡動畫

### Requirement: 控制列元件

The system SHALL render a controls row containing the power switch, BRIGHT and CONTRAST knobs, three indicator LEDs (PWR / RDY / TAPE), and a tape deck slot.

#### Scenario: 控制列元素齊備

- **WHEN** 頁面載入完成
- **THEN** `.controls` 內必須依序包含：
  1. `.power-switch`（切換時 toggle `on` class）
  2. `.knob-group` × 2，分別對應 `BRIGHT` 與 `CONTRAST`
  3. `.knob-group` 含三顆 LED：紅色 PWR、綠色 RDY、琥珀色 TAPE
  4. `.tape-deck`（含 `.tape-slot` 與 `.tape-cart`）

#### Scenario: PWR / RDY / TAPE LED 對應狀態

- **WHEN** 終端機處於各種狀態
- **THEN** PWR LED 在 `powerOn === true` 時帶 `on` class，否則不亮
- **AND** RDY LED（綠）僅在 `powerOn === true` 且 `busy === false` 時帶 `on` class
- **AND** TAPE LED（琥珀）僅在 `tapeSpinning === true` 時帶 `on` class

### Requirement: 可拖動旋鈕（BRIGHT / CONTRAST）

The system SHALL allow the user to adjust BRIGHT and CONTRAST values in the range [0, 100] by dragging the corresponding knob vertically with a pointer.

#### Scenario: 上下拖動旋鈕改變數值

- **WHEN** 使用者在 BRIGHT 旋鈕上 pointer-down 並向上拖動 ΔY 像素
- **THEN** BRIGHT 值增加 ΔY，並 clamp 到 [0, 100]
- **AND** 旋鈕 SVG 指針旋轉角度為 `-135deg + (value / 100) * 270deg`
- **AND** 每次數值變更呼叫 audio-engine 的 knob tick 音效
- **AND** CRT screen 的 `filter` 套用 `brightness(0.5 + brightness/200)` 與 `contrast(0.6 + contrast/150)`

#### Scenario: 旋鈕初始值

- **WHEN** 頁面首次載入
- **THEN** BRIGHT 預設為 80，CONTRAST 預設為 70

### Requirement: 命令列輸入處理

The system SHALL accept keyboard input only when powered on, not booting, and not blocked by an in-flight BUSY operation. Special keys SHALL behave as defined.

#### Scenario: 字元鍵寫入 input buffer

- **WHEN** 在 BASIC mode 下按下單一字元鍵（非 meta / ctrl）
- **THEN** 該字元以**大寫**附加到 input buffer
- **AND** 在 APL mode 下，該字元以原本大小寫附加到 input buffer
- **AND** 同時觸發 audio-engine key click（若 audio 開啟）

#### Scenario: Enter 送出命令

- **WHEN** 在命令列模式下按 Enter
- **THEN** 將「`<mode-pill> <prompt> <inputBuf>\n`」附加到螢幕輸出，並清空 input buffer
- **AND** 若 input 非空，將該行 unshift 到歷史紀錄（最近的在前）
- **AND** 將 `historyIdx` 重設為 -1
- **AND** 若 input trim 後為空，僅 echo 後不執行任何動作
- **AND** 否則依目前 mode 分派至 BASIC 或 APL 直譯器（內建命令優先處理，見下方）

#### Scenario: Backspace 刪除最後一字元

- **WHEN** 按下 Backspace
- **THEN** input buffer 最後一字元被移除（若已空則 no-op），並觸發 key click 音效

#### Scenario: 上下方向鍵瀏覽命令歷史

- **WHEN** 按下 ↑（ArrowUp）
- **THEN** 將 input buffer 設為 `history[min(history.length-1, historyIdx+1)]`，並更新 `historyIdx`
- **AND** 按下 ↓（ArrowDown）將 `historyIdx` 減 1；若小於 0 則清空 input 並將 idx 設為 -1

#### Scenario: Esc 取消輸入或退出內建檢視器

- **WHEN** 螢幕處於 `builtinMode === 'clock'` 或 `'divergence'`
- **THEN** 按下 Esc 退出 built-in 檢視器，回到命令列
- **AND** 若不在 built-in 檢視器，按 Esc 清空 input buffer

### Requirement: 內建命令分派

The system SHALL recognise and handle the following built-in commands case-insensitively before delegating to BASIC or APL interpreters: `HELP` / `?HELP`, `BASIC`, `APL`, `CLS` / `CLEAR`, `EJECT`, `TAPES`, `LOAD <NAME>`, `EL PSY KONGROO`, `EL PSY CONGROO`, `DIVERGENCE`.

#### Scenario: HELP 顯示說明卡

- **WHEN** 使用者送出 `HELP` 或 `?HELP`
- **THEN** 螢幕輸出固定的 `HELP_TEXT` 多行內容（含 commands 列表、BASIC example、APL example）

#### Scenario: BASIC / APL 切換 mode

- **WHEN** 使用者送出 `BASIC`
- **THEN** 將 mode 設為 `BASIC`，並輸出 `MODE: BASIC\n`
- **AND** 提示符變為 `> `
- **WHEN** 使用者送出 `APL`
- **THEN** 將 mode 設為 `APL`，並輸出 `MODE: APL\n`
- **AND** 提示符變為六個空白字元 `      `（APL 縮排）

#### Scenario: CLS / CLEAR 清空螢幕

- **WHEN** 使用者送出 `CLS` 或 `CLEAR`
- **THEN** 立即清空所有歷史輸出（lines 陣列為空），但保留 mode、tape、env 狀態

#### Scenario: TAPES 列出磁帶清單

- **WHEN** 使用者送出 `TAPES`
- **THEN** 依序輸出 `AVAILABLE TAPES:\n`，再對 `window.TAPES` 每一卷輸出 `  <label-padded-to-10><desc>\n`，最後輸出 `USE: LOAD <NAME>\n`

### Requirement: Mode pill 與提示符

The system SHALL display a non-wrapping mode pill (`BASIC` or `APL`) immediately before the input prompt while the terminal is idle and accepting input.

#### Scenario: Mode pill 永不換行

- **WHEN** 螢幕渲染 mode pill 時
- **THEN** `.mode-pill` 必須帶 `white-space: nowrap` 與 `word-break: keep-all`，避免在窄視窗下被斷字

### Requirement: 自動聚焦與自動捲動

The system SHALL keep the hidden input focused for keystroke capture and SHALL keep the screen scrolled to the bottom whenever new content arrives.

#### Scenario: 任意位置點擊重新聚焦

- **WHEN** 使用者點擊頁面任何位置
- **THEN** 隱藏的 `<input>` 必須重新取得焦點

#### Scenario: 新內容到達自動捲到底

- **WHEN** `lines` 或 `inputBuf` 改變
- **THEN** `.screen` 的 `scrollTop` 設為 `scrollHeight`（顯示最新內容）

### Requirement: BUSY 期間阻擋輸入

The system SHALL block keyboard handling while a BASIC program is running (busy === true) **except** when an `INPUT` statement is awaiting user response (pendingInput truthy).

#### Scenario: BUSY 阻擋按鍵但 INPUT 模式放行

- **WHEN** `busy === true` 且 `pendingInput === null`
- **THEN** 不處理任何鍵盤事件
- **WHEN** `busy === true` 且 `pendingInput` 為 resolver function
- **THEN** 鍵盤輸入正常運作，Enter 送出時將值傳給 resolver 並清掉 pendingInput

### Requirement: 隱藏輸入框定位

The system SHALL position the hidden `<input>` off-screen so that it captures focus without affecting layout or visibility.

#### Scenario: 隱藏 input 必須以 important 規則定位

- **WHEN** CSS 套用至 `.screen input`
- **THEN** 必須符合：`position: absolute !important`、`left: -9999px !important`、`top: -9999px !important`、`width: 1px !important`、`height: 1px !important`、`opacity: 0 !important`
- **AND** 此規則為 design 修訂後的固定方案，不得放回 `display:none`（會喪失焦點能力）

### Requirement: Built-in 檢視器（CLOCK / DIVERGENCE）切換顯示

The system SHALL render the alternate `ClockView` or `DivergenceView` instead of the terminal output panel when `builtinMode` is `'clock'` or `'divergence'` respectively.

#### Scenario: CLOCK 視圖顯示

- **WHEN** `builtinMode === 'clock'`
- **THEN** 渲染 `ClockView`，包含：
  - 頂部標題列：`— REAL-TIME CLOCK · CARTRIDGE <label> —`
  - `.bigclock` 顯示 `HH:MM:SS`，冒號使用 `.colon` 套用 1 秒 blink 動畫
  - `.bigclock-date` 顯示 `YYYY-MM-DD  ·  <DAY>`，DAY 為 SUN/MON/TUE/WED/THU/FRI/SAT
  - 底部提示 `PRESS  ESC  TO RETURN TO TERMINAL`
- **AND** 每 500 ms 更新一次時間

#### Scenario: DIVERGENCE 視圖顯示

- **WHEN** `builtinMode === 'divergence'`
- **THEN** 渲染 `DivergenceView`，包含：
  - 頂部標題 `— DIVERGENCE METER · ∂.404 —`
  - `.divergence` 顯示當前世界線值（96 px 大字）
  - `.divergence-label` 顯示 `WORLD LINE`
  - 底部提示 `EL PSY KONGROO · PRESS ESC TO RETURN`

### Requirement: hint 條根據狀態切換文字

The system SHALL update the bottom hint banner based on power and boot state.

#### Scenario: 三種 hint 文字

- **WHEN** `powerOn === false`
- **THEN** hint 顯示 `FLIP POWER SWITCH TO BEGIN`
- **WHEN** `powerOn === true && booting === true`
- **THEN** hint 顯示空字串（不顯示）
- **WHEN** `powerOn === true && booting === false`
- **THEN** hint 顯示 `TYPE  HELP  ·  TAPES  ·  BASIC / APL  ·  CLS`

### Requirement: CSS 變數調色版

The system SHALL drive phosphor colors and scanline strength through CSS variables on `:root` so that tweaks-panel changes propagate without re-render.

#### Scenario: 變數名稱固定

- **WHEN** UI 渲染或 tweaks 變動
- **THEN** `:root` 必須維護以下 CSS 變數：
  - `--phosphor`、`--phosphor-dim`、`--phosphor-faint`、`--phosphor-glow`
  - `--bg-deep`、`--bg-screen`
  - `--scanline-strength`
- **AND** 三套磷光色板（green / amber / white）的 RGB 值必須完全符合 design：
  - green：main `#7fff5a`、bg `#050b07`
  - amber：main `#ffb060`、bg `#0b0703`
  - white：main `#e8eef0`、bg `#06080a`
