## ADDED Requirements

### Requirement: Tweaks 面板控制三項設定

The system SHALL render a floating Tweaks panel that exposes exactly three settings: phosphor color, scanline strength, and sound FX toggle.

#### Scenario: 三個設定區段齊備

- **WHEN** Tweaks 面板開啟
- **THEN** 依序呈現以下三個 section：
  1. **PHOSPHOR**：三選一 radio segmented control，選項為 `P1 GREEN` / `P3 AMBER` / `P4 WHITE`
  2. **DISPLAY**：`SCANLINES` slider，範圍 `0..80`
  3. **AUDIO**：`SOUND FX` toggle（boolean）

### Requirement: 磷光色變更影響 CSS 變數

The system SHALL apply phosphor selection by writing the corresponding palette to `:root` CSS custom properties, so that all CRT visual elements react without re-rendering React components.

#### Scenario: 切到 amber

- **WHEN** 使用者在 PHOSPHOR 選 `P3 AMBER`
- **THEN** `document.documentElement.style.getPropertyValue('--phosphor')` 等於 `#ffb060`
- **AND** `--bg-screen` 等於 `#0b0703`
- **AND** `--phosphor-dim` / `--phosphor-faint` / `--phosphor-glow` 對應 amber 色板（見 crt-shell spec）

#### Scenario: 預設值

- **WHEN** 應用程式首次載入
- **THEN** phosphor 預設為 `green`、scanlines 預設為 `12`、audio 預設為 `true`

### Requirement: 掃描線強度控制

The system SHALL bind the scanline slider to the `--scanline-strength` CSS variable as `value / 100`.

#### Scenario: scanlines 滑桿映射

- **WHEN** 使用者拖動 SCANLINES 至 `40`
- **THEN** `--scanline-strength` 設為字串 `'0.4'`
- **AND** `.scanlines` 的 repeating-linear-gradient 透明度依此調整

#### Scenario: 不會出現負值或溢位

- **WHEN** slider 值
- **THEN** 必受限於 `0..80`（DOM 階層 `min`/`max` 強制），UI 不允許輸入超出範圍

### Requirement: 音效開關串接 IBMSound

The system SHALL pass the SOUND FX toggle state to `window.IBMSound.setEnabled(value)` whenever the toggle changes.

#### Scenario: 切到 OFF 立刻靜音

- **WHEN** 使用者把 SOUND FX 切到 OFF
- **THEN** `window.IBMSound.setEnabled(false)` 被呼叫
- **AND** 後續按鍵、磁帶、開機等音效不再播放
- **AND** 若 tape 正在轉，立刻停止 tape noise（由 audio-engine 規範）

#### Scenario: 切到 ON 恢復

- **WHEN** 使用者把 SOUND FX 切回 ON
- **THEN** `window.IBMSound.setEnabled(true)` 被呼叫；新的播放呼叫會發聲

### Requirement: Host 編輯模式 postMessage 協定

The system SHALL implement the host edit-mode protocol on `window.message` events: announce availability on mount, listen for `__activate_edit_mode` / `__deactivate_edit_mode`, post `__edit_mode_dismissed` on close, and post `__edit_mode_set_keys` on every value change.

#### Scenario: 掛載時宣告可用

- **WHEN** TweaksPanel 元件 mount
- **THEN** 對 `window.parent` postMessage `{ type: '__edit_mode_available' }`

#### Scenario: 接收 activate / deactivate

- **WHEN** 收到 `{ type: '__activate_edit_mode' }`
- **THEN** 將內部 `open` state 設為 true（顯示面板）
- **WHEN** 收到 `{ type: '__deactivate_edit_mode' }`
- **THEN** `open` 設為 false（隱藏）

#### Scenario: dismiss 動作

- **WHEN** 使用者點擊面板右上角 ✕ 按鈕
- **THEN** 立刻設 `open = false`
- **AND** 對 `window.parent` postMessage `{ type: '__edit_mode_dismissed' }`

#### Scenario: 設定變更時通知 host

- **WHEN** 任一 `setTweak(key, val)` 被呼叫
- **THEN** 對 `window.parent` postMessage `{ type: '__edit_mode_set_keys', edits: { [key]: val } }`

### Requirement: 面板可拖曳並夾入視窗範圍

The system SHALL allow the user to drag the panel by its header and SHALL clamp its position so that it remains within `PAD = 16 px` of viewport edges, both on drag and on viewport resize.

#### Scenario: 拖曳面板

- **WHEN** 使用者按下 `.twk-hd` 並移動 pointer
- **THEN** 面板的 `right` / `bottom` 位移依 pointer delta 更新

#### Scenario: clamp 到視窗邊界

- **WHEN** 拖曳超過視窗右下邊界
- **THEN** 面板位置被夾在 `[PAD, viewport - panel_size - PAD]` 範圍內，不會超出可視區
- **WHEN** 視窗大小變動（resize 或 ResizeObserver 觸發）
- **THEN** 面板被自動 reclamp 至新視窗範圍內

### Requirement: 面板樣式與行為一致性

The system SHALL keep the panel CSS class names stable (`.twk-panel`, `.twk-hd`, `.twk-x`, `.twk-body`, `.twk-row`, `.twk-row-h`, `.twk-lbl`, `.twk-val`, `.twk-sect`, `.twk-field`, `.twk-slider`, `.twk-seg`, `.twk-toggle`, `.twk-num`, `.twk-btn`, `.twk-swatch`) so external host CSS or tests can target them.

#### Scenario: class 名稱完整存在

- **WHEN** Tweaks 面板開啟
- **THEN** 渲染後 DOM 至少包含以下 class：`twk-panel`、`twk-hd`、`twk-x`、`twk-body`
- **AND** 各控制元件（`TweakRadio`、`TweakSlider`、`TweakToggle`）對應 `twk-seg`、`twk-slider`、`twk-toggle`

### Requirement: 控制元件 helper 對外公開

The system SHALL expose `useTweaks`, `TweaksPanel`, `TweakSection`, `TweakRow`, `TweakSlider`, `TweakToggle`, `TweakRadio`, `TweakSelect`, `TweakText`, `TweakNumber`, `TweakColor`, `TweakButton` on `window`, as required by the design's protocol shell.

#### Scenario: 全域註冊

- **WHEN** `tweaks-panel.js` 載入完成
- **THEN** 上述 12 個 helper 皆掛在 `window` 上，可被 `app.js` 直接引用
