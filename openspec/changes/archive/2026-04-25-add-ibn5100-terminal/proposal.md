## Why

從 Claude Design 匯出的 **IBN-5100 復古攜帶式電腦** 設計（位於 `_inbox/ibm5100/`，含 HTML / CSS / 五份 React JSX 原型）已經完成風格決策（Steins;Gate 致敬、CRT 全屏、磷光餘暉、BASIC + APL 直譯器、磁帶機、彩蛋），目前是一份僅能在瀏覽器中以 Babel-standalone 即時轉譯的設計稿。需要將其升級為**正式專案**：

- 建立可長期維護的目錄結構（`web/` / `tests/` / `docker/` / `logs/` / `run.sh`）。
- 將純函式（BASIC / APL 直譯器、磁帶 fixtures）抽出可單元測試的模組，補齊測試覆蓋（CLAUDE.md 強制要求）。
- 提供 **Docker 容器化執行環境**（CLAUDE.md 全域偏好：Web 專案需含 `docker/`、`logs/`、`run.sh`，且服務於 container 內運行）。
- 為後續疊代（pixel-perfect 微調、彩蛋擴充、CI）建立 SDD 與多代理流程的基礎。

## What Changes

- 新增 `web/` 目錄存放靜態前端資產（`index.html`、`styles.css`、`audio.js`、`interpreter.js`、`tapes.js`、`tweaks-panel.js`、`app.js`），以最小變形保留原型結構（保留 UMD React 18 + Babel standalone 的「不需 build step」特性，pixel-perfect 重現設計）。
- 新增 `docker/Dockerfile`（基於 `nginx:alpine`）、`docker/build.sh`、`docker/docker-compose.yaml`，將 `web/` 以 Nginx 靜態 serve 並掛載 `logs/`。
- 新增 `run.sh` 一鍵啟動腳本（先 build image，再 docker compose up，並掛載 `logs/`）。
- 新增 `tests/` 目錄與 Jest（或 Vitest）測試套件，覆蓋 BASIC tokenizer / parser / evaluator、APL tokenizer / monadic / dyadic 運算、所有磁帶 fixture 可被解析。測試於 container 內執行（`docker compose run --rm web npm test`）。
- 將 `interpreter.js` 改為 **同檔雙環境模組**（瀏覽器中以 IIFE 掛在 `window.IBMTerm`，Node 中以 CommonJS / ESM `module.exports` 對外，方便 Jest / Vitest 載入）；其餘 `audio.js` / `tapes.js` 等亦遵循相同對偶。
- 改寫 `README.md`，由初始化骨架說明轉為實際專案說明（架構、啟動方式、彩蛋指南、測試方式）。
- **避免 IBM 商標問題**：UI 顯示文字一律使用 `IBN-5100`（design 已經這樣命名）；GitHub repo 名稱沿用既有的 `IBM5100`，但 spec 與 README 須明確記錄此命名約束。
- **不變動**：根目錄的 `.claude/`、`openspec/` 結構、`.gitignore` 既有規則。

## Capabilities

### New Capabilities

- `crt-shell`: CRT 終端機殼層（含開關機動畫、POST 自檢序列、`bezel` / `crt-cabinet` / `screen` / `scanlines` / `sweep` / `flicker` / `glare` 視覺層、`controls` 列、power switch、knobs、LEDs、tape deck 槽位、hint 條、mode pill、命令列輸入處理、自動聚焦、自動捲動、命令歷史、按鍵事件分派）。
- `basic-interpreter`: 行號式 BASIC 直譯器（tokenizer、運算式 parser、PRINT / INPUT / LET / GOTO / IF…THEN…ELSE / FOR / NEXT / GOSUB / RETURN / REM / END / STOP / CLS / LIST / RUN / NEW、`FUNCS`：ABS/INT/SQR/SIN/COS/TAN/RND/LEN/CHR$/ASC/STR$/VAL/LEFT$/RIGHT$/MID$、變數 namespace、字串 vs 數值區分、錯誤格式 `?MSG IN <line>`）。
- `apl-interpreter`: APL 子集直譯器（tokenizer 含 `¯` 負號、字串 `'…'`、向量字面值、單元/雙元符號 `+ - × ÷ * ⌈ ⌊ |`、`⍳` `⍴` 雙語意、比較 `= ≠ < > ≤ ≥`、`,`、`⍒` `⍋` `≡` `⍕` `~`、`←` 賦值、括號優先、由右而左求值、`formatAPL` 輸出）。
- `tape-system`: 磁帶卡匣系統（七卷磁帶 metadata：`HELLO` / `FIB-12` / `PRIME` / `GUESS` / `CALC` / `CLOCK` / `∂.404`、磁帶選單 UI、`LOAD <NAME>` 與 `EJECT` 命令、磁帶轉盤旋轉動畫、模擬讀取點點點、`__BUILTIN_CLOCK__` 與 `__BUILTIN_DIVERGENCE__` 內建檢視器、退片時序）。
- `audio-engine`: WebAudio 合成音效引擎（按鍵 click + thud、開機 880/1320Hz 雙嗶、關機 sawtooth whine、knob triangle tick、磁帶 bandpass 噪音 + LFO chirp、60Hz sine power hum、enable/disable toggle、AudioContext lazy init）。
- `tweaks-panel`: 浮動 Tweaks 面板（磷光色 `green` / `amber` / `white` 三選一、掃描線強度滑桿 0–80、音效開關、host postMessage 協定 `__edit_mode_*` 接收/發送、可拖曳定位、Esc/✕ 關閉）。
- `easter-eggs`: Steins;Gate 風格彩蛋集（`EL PSY KONGROO` / `EL PSY CONGROO` 觸發加密訊息、長閒置 SERN packet whisper、`∂.404` 世界線變動率錶在固定值集 `1.130426` / `0.571024` / `1.048596` / `0.337187` 之間 glitch 跳動、開機 `WORLD LINE 1.130426` 顯示）。
- `docker-runtime`: Docker 容器化執行（`docker/Dockerfile` 基於 `nginx:alpine`、`docker/build.sh` 建置 image、`docker/docker-compose.yaml` 暴露對外 port 並掛載 `logs/`、`run.sh` 一鍵啟動、Nginx access/error log 寫入 `logs/`、修改程式碼後支援快速重啟 container 對應於 CLAUDE.md 的 Web 專案結構偏好）。

### Modified Capabilities

<!-- 本專案目前沒有任何已歸檔 spec（openspec/specs/ 為空），故無 modified capabilities -->

## Impact

- **Affected code**：專案目前無實作程式碼；本變更會新增整個 `web/` / `tests/` / `docker/` / `logs/`（gitkeep）、`run.sh`、改寫 `README.md`，並新增 `package.json`（為了 Jest/Vitest 與測試 scripts，僅在 container 內安裝 node_modules）。
- **Affected APIs**：純前端、無對外 API。內部模組合約以 `window.IBMTerm` / `window.IBMSound` / `window.TAPES` / `window.useTweaks` 等 globals 連接（保留設計原型介面），同時提供 Node 模組匯出供測試載入。
- **Dependencies**：
  - Runtime：`react@18.3.1` / `react-dom@18.3.1` / `@babel/standalone@7.29.0`（皆走 unpkg CDN，原型既有方案；如離線需求出現再評估自托管）；`nginx:alpine`（Docker base image）。
  - Dev / Test：`jest`（或 `vitest`，由 design.md 拍板）+ 必要 ESM 介接套件，僅在 container 內安裝。
- **Systems**：本機需可執行 Docker（CLAUDE.md 強制條件）；不引入任何 backend、資料庫、外部 API。
- **Trademark / Branding**：UI 與所有面向終端使用者的字串一律保留 `IBN-5100`（避免 IBM 商標）；GitHub repo 名稱 `IBM5100` 屬於專案內部識別、不顯示於介面。
- **後續路徑**：本提案僅涵蓋首次落地；後續若需 build step（Vite / Webpack）、CI、E2E（Playwright）、APL 鍵盤輸入法等，留待新 change 處理。
