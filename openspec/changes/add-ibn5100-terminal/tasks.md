## 1. 專案骨架與工具鏈

- [x] 1.1 在專案根新增 `package.json`，欄位至少包含：`name: "ibn5100-terminal"`、`version: "0.1.0"`、`private: true`、`scripts.test = "vitest run"`、`scripts.test:watch = "vitest"`、`devDependencies.vitest = "^1.6.0"`（或最新穩定 1.x），其他欄位由 Specialist 視需要補。
- [x] 1.2 在專案根新增 `vitest.config.js`，設定 `test.environment = 'node'`（除非個別 test file 切到 jsdom）、`test.globals = false`、`test.include = ['tests/**/*.test.js']`。
- [x] 1.3 新增 `tests/.gitkeep`（佔位）與 `web/.gitkeep`（避免空資料夾）；後續 task 會逐步覆寫。
- [x] 1.4 新增 `logs/.gitkeep`（內容為空），確認 git 追蹤；驗證 `git status` 顯示為 untracked → 加入 commit。
  - **檔案範圍**：`/package.json`、`/vitest.config.js`、`/tests/.gitkeep`、`/web/.gitkeep`、`/logs/.gitkeep`
  - **驗收條件**：上述檔案皆存在且納入版本控制，`docker compose ... run --rm web-test npm test` 在 task 4 完成後可執行（本任務只需檔案就位）。

## 2. 設計檔轉檔（保持 pixel-perfect）

- [x] 2.1 將 `_inbox/ibm5100/project/IBN-5100 Terminal.html` 複製為 `web/index.html`：
  - 把 `<script src="audio.jsx">` 改為 `<script src="audio.js">`
  - 把 `<script type="text/babel" src="interpreter.jsx">` 改為 `<script src="interpreter.js">`（純函式不需 Babel）
  - 把 `<script type="text/babel" src="tapes.jsx">` 改為 `<script src="tapes.js">`（純資料）
  - 保留 `<script type="text/babel" src="tweaks-panel.jsx">` 為 `tweaks-panel.js`（含 JSX，仍需 Babel）
  - 保留 `<script type="text/babel" src="app.jsx">` 為 `app.js`（含 JSX）
  - HTML 標題、meta 完全沿用，僅檔名後綴改 `.js`。
  - 新增 `<link rel="icon" href="data:,">` 抑制 favicon 404（design.md Open Question 5）。
- [x] 2.2 將 `_inbox/ibm5100/project/styles.css` 原樣複製到 `web/styles.css`，**不改任何字元**（保留 design 修訂後的 phosphor 變數、scanline 公式、隱藏 input 規則）。
- [x] 2.3 將 `_inbox/ibm5100/project/audio.jsx` 改寫為 `web/audio.js`：
  - 內容主體（IIFE 與所有合成函式）保持與原型一致。
  - 在 IIFE 結尾把對外 API 暴露邏輯改為「同檔雙環境」（見 design.md Decision 2）：當 `typeof module !== 'undefined' && module.exports` 為 true 時 `module.exports = { setEnabled, isEnabled, key, bootBeep, shutdownWhine, knob, tapeStart, tapeStop, powerHum, init }`，否則維持 `window.IBMSound = ...`。

### 2.3.1 音效命名空間補強（IBNSound 主、IBMSound 別名）

> 本子任務為第 2 次 spec 微調新增（2026-04-26），對應 audio-engine spec「全部音效整合於 `window.IBNSound` 命名空間（並提供 `window.IBMSound` 別名）」Requirement。`web/audio.js` 目前 line 158 僅掛 `root.IBMSound = api`，但 line 4-7 與 line 149-160 的註解已預告「掛 globalThis.IBNSound（外加相容別名 globalThis.IBMSound）」——實作落後於註解／spec，須補齊。

- [x] 2.3.1 修訂 `web/audio.js`：在 IIFE 尾端瀏覽器環境分支同時掛 `root.IBNSound = api` 與 `root.IBMSound = api`（兩者指向**同一份** api 物件，順序不拘但兩行都要）；並更新 line 4-7、line 149-160 的註解使其與實作一致（明確說明「IBNSound 為主、IBMSound 為相容別名」）。Node 環境分支（`module.exports = api`）保持不變，`module.exports` 與 `window.IBNSound` / `window.IBMSound` 在瀏覽器環境是同一參照。
- [x] 2.3.2 修訂 `tests/audio-shape.test.js`：補測「介面契約（IBNSound）」與「IBMSound 為相容別名」兩條 scenario：
  - 載入 `web/audio.js` 後，斷言模組匯出（在 Node 為 `module.exports`、在瀏覽器為 `window.IBNSound`）具備 spec 列出的 10 個 method 全為 function。
  - 在 stub `global.window` 環境下，斷言 `global.window.IBMSound === global.window.IBNSound`（同一參照，非深拷貝）。
  - 既有 enabled/disabled 與 init 例外 scenario 保持不變，但測試名稱／註解可同步更新為 `IBNSound`。
  - **檔案範圍（強制邊界）**：`web/audio.js`、`tests/audio-shape.test.js`。**禁止**修改 `web/app.js`、`web/tweaks-panel.js`、`web/index.html`、其他 spec 檔、其他測試檔。
  - **驗收條件**：`docker compose -f docker/docker-compose.yaml run --rm web-test npm test` 全部 PASS；audio-engine spec 兩條新 scenario 皆有對應斷言；`grep -nE 'IBNSound|IBMSound' web/audio.js` 同時可見兩個 identifier 的賦值行；`web/app.js` 對 `window.IBMSound.setEnabled(...)` 的既有呼叫**仍可運作**（透過別名）。
- [x] 2.4 將 `_inbox/ibm5100/project/interpreter.jsx` 改寫為 `web/interpreter.js`：
  - 主體（BASIC tokenizer / parser / FUNCS / evalNode / execStatement / runProgram / execImmediate / makeBASICEnv / APL tokenizer / monadic / dyadic / evalAPL / evalAPLExpr / formatAPL）保持原型行為一致。
  - IIFE 尾段以 host detection 同時匯出至 `window.IBMTerm`（瀏覽器）與 `module.exports`（Node）。
  - 不改任何 BASIC / APL 行為（`-1`/`0` 真假慣例、由右而左 APL 求值、`NEXT WITHOUT FOR` 例外字串等），任何修正都需先寫入 `issues.md`。
- [x] 2.5 將 `_inbox/ibm5100/project/tapes.jsx` 改寫為 `web/tapes.js`：
  - 純資料 `window.TAPES = [ ...7 tapes... ]` 保留；尾段加上 host detection 對 Node 匯出 `module.exports = { TAPES }`。
  - 七卷磁帶資料 100% 相符（id / label / side / desc / source）；`__BUILTIN_CLOCK__` / `__BUILTIN_DIVERGENCE__` 字串原樣保留。
- [x] 2.6 將 `_inbox/ibm5100/project/tweaks-panel.jsx` 改名為 `web/tweaks-panel.js`：完全不變動程式碼（含 host postMessage 協定、所有 helper 公開到 window）。
- [x] 2.7 將 `_inbox/ibm5100/project/app.jsx` 改名為 `web/app.js`：
  - 完全保留 design 行為（含 BOOT_LINES、WHISPERS、DivergenceView 目標序列、ClockView、prompt 縮排、SET / setBuiltinMode 邏輯、idle whisper 機率 0.4、間隔 45 s）。
  - 任何文字面向 UI 的字串若包含 `IBM`，改為 `IBN`（檢查 plate、boot、help、whisper、divergence、ClockView 標題等）。設計來源已是 `IBN-5100`，本步驟為防禦性檢查。
  - **檔案範圍**：`web/index.html`、`web/styles.css`、`web/audio.js`、`web/interpreter.js`、`web/tapes.js`、`web/tweaks-panel.js`、`web/app.js`
  - **驗收條件**：所有對應 spec：crt-shell（全部 scenario）、basic-interpreter（前 12 個 Requirement，magic 運行行為）、apl-interpreter（全部 Requirement）、tape-system（前 6 個 Requirement）、audio-engine（全部 Requirement）、tweaks-panel（全部 Requirement）、easter-eggs（全部 Requirement）。

## 3. Docker 容器化

- [x] 3.1 撰寫 `docker/Dockerfile`：
  - `FROM nginx:alpine`
  - `COPY web/ /usr/share/nginx/html/`
  - `EXPOSE 80`
  - 不需自訂 `CMD`。
- [x] 3.2 撰寫 `docker/docker-compose.yaml`：
  - 定義 `web` service：`build: { context: .., dockerfile: docker/Dockerfile }`、`ports: ["8080:80"]`、`volumes: ["../logs:/var/log/nginx"]`、`restart: unless-stopped`。
  - 定義 `web-test` service：`image: node:20-alpine`、`working_dir: /app`、`volumes: [ "..:/app", "/app/node_modules" ]`、`command: sh -c "npm test"`（預設指令；實際以 `docker compose run --rm web-test ...` 覆寫）。
- [x] 3.3 撰寫 `docker/build.sh`：
  - 第一行 `#!/usr/bin/env bash`，接 `set -euo pipefail`。
  - 透過 `BASH_SOURCE[0]` 計算 script 所在路徑，cd 至 repo 根。
  - 執行 `docker compose -f docker/docker-compose.yaml build`。
  - 結尾 `echo "Build complete."`。
  - `chmod +x docker/build.sh`。
- [x] 3.4 撰寫 `run.sh`（專案根）：
  - `#!/usr/bin/env bash` + `set -euo pipefail`。
  - 切到 script 所在目錄。
  - `mkdir -p logs`。
  - 呼叫 `./docker/build.sh`。
  - `docker compose -f docker/docker-compose.yaml up`（前景；註解中提示 `-d` 可改背景）。
  - `chmod +x run.sh`。
- [x] 3.5 在 `web-test` service 內首次安裝相依：
  - 執行 `docker compose -f docker/docker-compose.yaml run --rm web-test npm install`，產生 `package-lock.json`。
  - 將 `package-lock.json` commit。
  - **檔案範圍**：`docker/Dockerfile`、`docker/docker-compose.yaml`、`docker/build.sh`、`run.sh`、`package-lock.json`
  - **驗收條件**：對應 spec docker-runtime 全部 Requirement；`./run.sh` 執行後可用瀏覽器訪問 `http://localhost:8080` 看到開機畫面；`docker compose -f docker/docker-compose.yaml run --rm web-test echo OK` 可成功列印 `OK`。

## 4. 單元測試（直譯器）

- [x] 4.1 `tests/basic-interpreter.test.js`：覆蓋 basic-interpreter spec 全部 Requirement：
  - tokenizer：數字 / 字串 / 識別字 / 單字 / 多字運算子 / 保留字 / 不合法字元拋 SYNTAX ERROR
  - 運算式優先序、unary `-`、`^`、函式呼叫
  - FUNCS：ABS / INT / SQR / RND / LEN / CHR$ / ASC / LEFT$ / RIGHT$ / MID$ / STR$ / VAL；UNDEF FN 例外
  - 比較與布林（-1 / 0）
  - PRINT：預設換行、逗號 \t、分號抑制換行、整數與浮點格式化（保留 6 位 + 去尾零）
  - INPUT：mock io.input，驗證字串變數保留、數值變數 parseFloat / 0 fallback、自訂 prompt
  - LET / 隱式賦值 / 未宣告變數預設值
  - GOTO 跳行 / IF…THEN…ELSE / GOTO 不存在行號
  - GOSUB / RETURN / RETURN WITHOUT GOSUB
  - FOR/NEXT 預設步進 + 自訂負步進 + NEXT WITHOUT FOR
  - 行號程式儲存 / 替換 / 刪除 / LIST / NEW
  - RUN：空程式輸出 NO PROGRAM、安全上限 100,000、yield 行為（用 fake timer 驗 50 步 yield 即可）、`env.aborted` 旗標生效輸出 BREAK
  - 錯誤訊息格式 `?MSG IN <line>` vs 立即模式 `?MSG`
- [x] 4.2 `tests/apl-interpreter.test.js`：覆蓋 apl-interpreter spec 全部 Requirement：
  - tokenizer：`¯` 負號 / `'` 字串 / 連續數字向量 / 識別字保留大小寫
  - 單元符號 `⍳` / `⍴` / `-` / `÷` / `⌈` / `⌊` / `|` / `×` (sign) / `⍒` / `⍋`
  - NONCE ERROR 對未實作符號
  - 雙元 `+` `-` `×` `÷` `*` `⌈` `⌊` `|` `⍴` `=` `≠` `<` `>` `≤` `≥` `,`
  - 純量廣播、等長向量、不等長拋 LENGTH ERROR
  - 比較回 `1`/`0`（顯式對比 BASIC 的 `-1`/`0`）
  - 賦值 `←` 不 echo、變數查找、VALUE ERROR
  - 由右而左求值（`2 × 3 + 4 = 14`）、括號改變優先（`(2 × 3) + 4 = 10`）
  - `formatAPL` 規則（null/undefined→'', 整數無小數, 非整數 toFixed(4), 向量空白分隔）
- [x] 4.3 `tests/tapes.test.js`：覆蓋 tape-system spec 中與資料/解析相關 Requirement：
  - `window.TAPES`（或 Node `require('../web/tapes.js').TAPES`）長度 7、順序與 metadata 與 spec 完全一致
  - 對 HELLO / FIB / PRIME / GUESS / CALC 五卷磁帶 source，逐行 `IBMTerm.execImmediate` 載入後 `RUN`，斷言 io.print 累積輸出符合 spec：
    - HELLO 含 `HELLO, WORLD.\n`、`READY.\n`
    - FIB-12 含 12 行，最後一行 B = 144
    - PRIME 包含 2..50 內所有質數列表 + `READY.\n`
    - CALC：mock io.input 依序回 `0`，斷言輸出 `BYE.\n` 即可（避免長交互）
    - GUESS：mock io.input 直接回 N（已知答案，需要 stub `Math.random` 鎖定 N），斷言一次猜中 `GOT IT IN 1 TRIES.\n`
  - 兩個 BUILTIN tape 的 source 字串為 `__BUILTIN_CLOCK__` 與 `__BUILTIN_DIVERGENCE__`
- [x] 4.4 `tests/audio-shape.test.js`：覆蓋 audio-engine spec 的「介面契約」與 enable/disable 行為：
  - 在 setup 內 stub `global.AudioContext` / `global.window` 提供假的 `AudioContext` class（具備所需 method 的 spy）。
  - 載入 `web/audio.js`（CommonJS 匯出）後，斷言 `IBMSound` 物件具備 10 個 method 全部為 function。
  - `setEnabled(false)` → 後續呼叫 `key` / `bootBeep` 等不會觸發 stub AudioContext 的 oscillator 建立呼叫。
  - `setEnabled(false)` → 內部 `tapeStop` 被呼叫（透過 spy 驗證）。
  - `init()` 在沒有 AudioContext 時不拋例外（試以 stub throw 模擬）。
  - 不需要實際發聲；驗證 oscillator / filter 建立次數與 envelope schedule 呼叫即可。
- [x] 4.5 `tests/easter-eggs.test.js`：覆蓋 easter-eggs spec 的可純測部分：
  - 對 `EL PSY KONGROO` 與 `EL PSY CONGROO` trim+upper 後比對的純函式（若 app.js 抽出），或保守做法：對 `app.js` 中該分支的字串字面值做 grep 確認存在。
  - 對 divergence 目標序列字串字面值 grep（陣列順序與內容對齊 spec）。
  - WHISPERS 五句字串字面值 grep。
- [x] 4.6 `tests/ibn-name.test.js`：避商標掃描：
  - 讀取 `web/index.html`、`web/styles.css`、`web/audio.js`、`web/interpreter.js`、`web/tapes.js`、`web/tweaks-panel.js`、`web/app.js`、`README.md` 全部內容。
  - 斷言「非白名單」內容不出現 `IBM` 或 `ibm`（白名單：`README.md` 內反引號包裹的 `\`IBM5100\``、git remote URL、`package.json#name`）。
  - 實作建議：先取出檔案文字，對 README 套白名單轉換（移除 ` \`IBM5100\` `、`https://github.com/.../IBM5100` 等子字串），再 regex `/IBM/i`。
  - **檔案範圍**：`tests/basic-interpreter.test.js`、`tests/apl-interpreter.test.js`、`tests/tapes.test.js`、`tests/audio-shape.test.js`、`tests/easter-eggs.test.js`、`tests/ibn-name.test.js`
  - **驗收條件**：執行 `docker compose -f docker/docker-compose.yaml run --rm web-test npm test` 全部 PASS，覆蓋對應 spec scenario。

## 5. README 改寫

- [x] 5.1 重寫 `README.md`，章節結構建議：
  - 標題與一句話介紹（`IBN-5100 復古攜帶式電腦終端機網頁版`）
  - 「快速開始」：前置（Docker / Compose）、`./run.sh`、瀏覽器訪問 `http://localhost:8080`、停止指令 `docker compose ... down`
  - 「測試」：`docker compose -f docker/docker-compose.yaml run --rm web-test npm test`
  - 「專案架構」：`web/` / `tests/` / `docker/` / `logs/` / `openspec/` 目錄樹說明
  - 「使用指南」：開機 → `HELP` → `TAPES` → `LOAD <NAME>` → `RUN`，附 BASIC/APL 範例
  - 「彩蛋」：`EL PSY KONGROO`、`LOAD ∂.404`、長閒置 SERN whispers
  - 「Tweaks」：磷光色、掃描線、音效開關；附使用方法（如何顯示面板）
  - 「品牌與商標」說明：UI 一律 `IBN-5100`；Repo 名稱 \`IBM5100\` 為內部識別（需用 markdown code 反引號包裹以通過 ibn-name 測試的白名單）
  - 「OpenSpec 流程」：簡述本專案使用 SDD + 多代理（保留現有 README 該段，視情況整併）
  - 「已知限制 / Non-goals」：CDN 依賴、無 build step、無 E2E 測試
  - 「授權」：保留現狀
- [x] 5.2 `README.md` 須通過 `tests/ibn-name.test.js`（即 `IBM` 出現處皆已包白名單格式）。
  - **檔案範圍**：`README.md`
  - **驗收條件**：對應 spec docker-runtime「README 啟動章節」Requirement；測試 `tests/ibn-name.test.js` PASS。

## 6. 整合與最終驗收

- [x] 6.1 在 container 內執行 `docker compose -f docker/docker-compose.yaml run --rm web-test npm test`，所有測試 PASS（無 skip）。
- [ ] 6.2 執行 `./run.sh` 啟動 `web` service，於本機瀏覽器（推薦 Chrome / Firefox 桌機版）打開 `http://localhost:8080`，逐項手動驗證：
  - 開機動畫、POST 序列、READY. 提示
  - `HELP`、`TAPES`、`LOAD HELLO`、`RUN`、`LIST`、`NEW`
  - `LOAD FIB-12` → `RUN` 印出 12 行
  - `LOAD GUESS` → `RUN` → 互動猜數字
  - `LOAD CLOCK` → 看到大字時鐘 + 日期、`ESC` 返回
  - `LOAD ∂.404` → 看到 96 px divergence 數字 + glitch、`ESC` 返回
  - `EL PSY KONGROO` 觸發加密訊息
  - `BASIC` ↔ `APL` 切換、APL 試算 `⍳ 5` / `2 × 3 + 4`
  - 拖動 BRIGHT / CONTRAST 旋鈕，亮度 / 對比變化
  - 開啟 Tweaks（透過 `window.postMessage({type:'__activate_edit_mode'},'*')` 或 fallback 鍵盤捷徑），切換 phosphor green / amber / white、scanlines、SOUND FX
  - 關機 → CRT 收縮動畫 + whine 音效，狀態完全重置
  - **註（2026-04-26 spec 微調）**：人工驗收項目仍以原既有音效行為為準（按鍵聲、tape 噪音、boot beep、shutdownWhine、SOUND FX toggle）。新增的 `window.IBNSound` 命名空間僅在 spec 與 audio.js 內部增設別名，**不新增使用者面互動**；驗收時可額外於 DevTools console 確認 `window.IBMSound === window.IBNSound` 為 `true`，但這不是必驗項。
- [x] 6.3 確認 `git status` 無遺漏；feature branch 上所有 commit 均已 push。
- [ ] 6.4 若驗收中發現任何**spec 未涵蓋**的問題，寫入 `openspec/changes/add-ibn5100-terminal/issues.md`（格式：`[Specialist] [時間戳] [嚴重度] 描述`），不得擅自擴充 spec。
  - **檔案範圍**：無新增實作；僅執行測試 + 人工驗收 + 必要時更新 `issues.md`
  - **驗收條件**：以上 6.1 / 6.2 全部通過；對應「整合測試」相當於本 change 的 acceptance gate，由 Verifier 在 `/opsx:verify` 中複核。

## 7. 不在本次範圍（給未來 change）

> 本節僅作備忘，不對應 task；如使用者後續需要，請開新 change 處理。

- [ ] 7.1 引入 Vite/Webpack build step（提升首屏速度，移除 babel-standalone）
- [ ] 7.2 將 React/Babel 自托管至 `web/vendor/`（離線支援）
- [ ] 7.3 加入 Playwright E2E 測試（覆蓋互動流程）
- [ ] 7.4 GitHub Actions CI（自動跑單元測試）
- [ ] 7.5 APL 鍵盤輸入法（Backtick prefix → 對應 glyph）
- [ ] 7.6 行動裝置 / 觸控優化
- [ ] 7.7 Container 資源限額（`mem_limit` / `cpus`）與 reverse proxy / TLS
