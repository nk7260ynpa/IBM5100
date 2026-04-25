## ADDED Requirements

> 命名空間慣例：本 spec 中所有以 `IBMSound.xxx` / `IBNSound.xxx` 形式書寫的呼叫皆指**同一個 api 物件**（見「全部音效整合於 `window.IBNSound` 命名空間」Requirement）。新撰寫程式碼以 `IBNSound` 為主要 API，`IBMSound` 為瀏覽器環境之相容別名。

### Requirement: WebAudio context lazy 初始化

The system SHALL lazily create a single shared `AudioContext` on first sound request and SHALL resume it from `suspended` state automatically.

#### Scenario: 第一次播放才建立 ctx

- **WHEN** 頁面剛載入但尚未播放任何聲音
- **THEN** 內部變數 `ctx` 仍為 `null`，不額外消耗瀏覽器 audio 資源

#### Scenario: 第一次呼叫播放函式時建立 ctx

- **WHEN** 第一次呼叫 `IBNSound.bootBeep()`、`IBNSound.key()` 或 `IBNSound.init()`
- **THEN** 嘗試 `new AudioContext()`（fallback 到 `webkitAudioContext`），失敗時設為 `null` 並安靜返回，不拋例外
- **AND** 若 `ctx.state === 'suspended'`，立即 `resume()`

#### Scenario: 全域單一 ctx

- **WHEN** 反覆呼叫播放函式
- **THEN** 始終重用同一個 `AudioContext` 實例（不會每次新建）

### Requirement: 音效開關（enable / disable）

The system SHALL expose `IBNSound.setEnabled(bool)` and `IBNSound.isEnabled()` to globally toggle audio output, and SHALL stop the currently spinning tape noise when disabled.

#### Scenario: setEnabled(false) 停止磁帶噪音

- **WHEN** `tapeStart` 已啟動 tape noise 並仍在播放
- **AND** 呼叫 `setEnabled(false)`
- **THEN** 立刻呼叫內部 `tapeStop()` 結束 tape noise；後續所有播放函式直接 no-op

#### Scenario: setEnabled(true) 恢復播放

- **WHEN** 之前 disabled、再次 `setEnabled(true)`
- **THEN** 後續呼叫播放函式時正常產生聲音（先前已被結束的 tape noise 不會自動恢復）

### Requirement: 按鍵聲（mechanical click）

The system SHALL produce a short mechanical-click sound combining a high-pass-filtered noise burst and a low-frequency square thud whenever a key event occurs in the terminal.

#### Scenario: key click 結構

- **WHEN** 呼叫 `IBNSound.key()` 且 enabled
- **THEN** 同時觸發兩條音源：
  1. 256-sample 1-channel 噪音 buffer，經 `BiquadFilterNode (highpass, 1500 Hz)`，最終增益 0.18
  2. 80–120 Hz 隨機頻率的 `square` oscillator，envelope (attack 0.001s, decay 0.02s, release 0.02s, peak 0.05)，持續 0.05 s
- **AND** 兩者直接連到 destination

### Requirement: 開機嗶聲（boot beep）

The system SHALL emit two square-wave beeps at 880 Hz and 1320 Hz, the second offset by 0.18 s, when called.

#### Scenario: bootBeep 結構

- **WHEN** 呼叫 `IBNSound.bootBeep()`
- **THEN** 第一個 oscillator：`square` 880 Hz，於 `t0` 起播 0.2 s（envelope peak 0.12）
- **AND** 第二個 oscillator：`square` 1320 Hz，於 `t0 + 0.18` 起播 0.2 s

### Requirement: 關機 whine

The system SHALL emit a sawtooth tone falling exponentially from 1200 Hz to 40 Hz over 0.8 s with envelope peak 0.08 fading to silence by 0.85 s.

#### Scenario: shutdownWhine 結構

- **WHEN** 呼叫 `IBNSound.shutdownWhine()`
- **THEN** 一個 `sawtooth` oscillator 於 `t0` 起播 0.9 s
- **AND** frequency.setValueAtTime(1200, t0)，再 exponentialRampToValueAtTime(40, t0 + 0.8)
- **AND** gain 由 0.08 在 0.85 s 內 exponentialRampToValueAtTime 至 0.0001

### Requirement: 旋鈕 tick

The system SHALL emit a brief 320 Hz triangle tick whenever a knob value changes, with envelope peak 0.04 lasting 0.05 s.

#### Scenario: knob tick 結構

- **WHEN** 呼叫 `IBNSound.knob()`
- **THEN** 一個 `triangle` oscillator 320 Hz，envelope (attack 0.001, decay 0.01, release 0.02, peak 0.04)，持續 0.05 s

### Requirement: 磁帶讀取噪音（loop + LFO）

The system SHALL produce a band-pass-filtered noise loop modulated by a 7 Hz sine LFO to simulate tape head reading; the loop SHALL be replaceable (start while already running stops the previous).

#### Scenario: tapeStart 結構

- **WHEN** 呼叫 `IBNSound.tapeStart()`
- **THEN** 建立 2 秒長 1-channel noise buffer 並以 `BufferSource` loop 播放
- **AND** 透過 `BiquadFilterNode (bandpass, freq=1800, Q=0.6)` 過濾
- **AND** 額外建立 7 Hz `sine` LFO，gain 800，連到 bandpass `frequency` 做 chirp 調變
- **AND** 主 gain 由 0.0001 在 0.05 s 內升到 0.04

#### Scenario: tapeStart 重啟先停舊

- **WHEN** 已有 tape noise 在播放，呼叫 `tapeStart` 再次啟動
- **THEN** 先呼叫內部 `tapeStop` 結束舊的，再建立新的

#### Scenario: tapeStop fade-out

- **WHEN** 呼叫 `IBNSound.tapeStop()`
- **THEN** 主 gain 在 0.2 s 內 exponentialRampToValueAtTime 至 0.0001
- **AND** 0.25 s 後實際停止 BufferSource 與 LFO（容錯包 try/catch）

### Requirement: 60 Hz power hum

The system SHALL provide a `powerHum()` helper that returns a controllable handle for a 60 Hz sine hum at gain 0.008, and the App SHALL hold this handle while powered on and call `stop()` on shutdown.

#### Scenario: powerHum 起停

- **WHEN** 呼叫 `IBNSound.powerHum()`
- **THEN** 回傳 `{ stop: function }`，內部已啟動 60 Hz `sine` oscillator + gain 0.008
- **WHEN** 呼叫該物件的 `stop()`
- **THEN** oscillator 停止（容錯包 try/catch）

#### Scenario: 開機開啟、關機關閉

- **WHEN** crt-shell 在開機 powerOnSeq 中
- **THEN** 呼叫 `powerHum()` 並保存回傳 handle
- **WHEN** 關機 powerOffSeq 中
- **THEN** 呼叫保存 handle 的 `stop()` 並清掉參考

### Requirement: 全部音效整合於 `window.IBNSound` 命名空間（並提供 `window.IBMSound` 別名）

The system SHALL expose all audio API on a single `window.IBNSound` object with stable shape: `{ setEnabled, isEnabled, key, bootBeep, shutdownWhine, knob, tapeStart, tapeStop, powerHum, init }`，作為主要對外命名空間（呼應 design.md Goal #4 的避商標精神）。同時 SHALL 在瀏覽器環境提供 `window.IBMSound` 作為相容別名，指向**同一份 api 物件**（reference equality），以維持 design 原型既有引用（如 `web/app.js`）不破壞。

#### Scenario: 介面契約（IBNSound）

- **WHEN** `audio.js` 載入
- **THEN** `typeof window.IBNSound === 'object'`，且上述 10 個 method 皆為 function

#### Scenario: IBMSound 為相容別名

- **WHEN** `audio.js` 載入
- **THEN** `window.IBMSound === window.IBNSound`（同一物件參照，非各自獨立的副本）
- **AND** 對 `window.IBMSound.setEnabled(false)` 的呼叫等效於對 `window.IBNSound.setEnabled(false)` 的呼叫（共享內部 enabled 狀態）

### Requirement: 雙環境匯出

The system SHALL allow `audio.js` to be imported in Node test environment so the helper shape (not its actual sound output) can be unit tested via mocked AudioContext.

#### Scenario: Node 載入不拋錯

- **WHEN** 在 Node 中 `require('../web/audio.js')`（測試 setup 提供 stub `AudioContext`）
- **THEN** 模組成功載入，`module.exports` 為**與瀏覽器 `window.IBNSound`／`window.IBMSound` 同一份**的 api 物件（同 shape，包含上述 10 個 method）
- **AND** 測試可斷言 enabled/disabled 切換、init 可被呼叫且不拋錯
