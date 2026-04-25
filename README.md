# `IBM5100`

> IBN-5100 復古攜帶式電腦終端機網頁版，致敬 1975 年的小型可攜式機型與《Steins;Gate》中
> 用來解讀 SERN 加密文件的傳奇機種。視覺與互動行為以 pixel-perfect 為目標，採磷光餘暉、
> 掃描線、磁帶卡匣與 BASIC / APL 雙直譯器於一身。

> 採用 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 規格驅動開發（Spec-Driven
> Development, SDD）流程，並搭配 Claude Code 多代理協作（Coordinator / Specialist /
> Verifier）。

---

## 快速開始

### 前置需求

- Docker Engine（建議 24 以上）
- Docker Compose v2（隨新版 Docker Desktop 內建；CLI 命令為 `docker compose`）

### 啟動

```sh
./run.sh           # 前景啟動（看到 Nginx log，Ctrl-C 停止）
./run.sh -d        # 背景啟動（之後可用 `docker compose ... down` 停止）
```

啟動成功後在瀏覽器打開 [http://localhost:8080](http://localhost:8080) 即可看見終端機。

### 停止

```sh
docker compose -f docker/docker-compose.yaml down
```

---

## 測試

所有單元測試於專屬 Docker container（`web-test` service，base image: `node:20-alpine`）內
執行，符合全域偏好「測試環境亦於 Docker container 中執行」。

```sh
docker compose -f docker/docker-compose.yaml run --rm web-test npm test
```

首次跑會自動由 named volume 載入 `node_modules`；後續 run 即時啟動。

---

## 專案架構

```
IBM5100/
├── .claude/                # Claude Code 工作空間（slash command、skills、本地設定）
├── docker/                 # Docker 化執行環境
│   ├── Dockerfile          #   nginx:alpine 單階段，靜態 serve web/
│   ├── build.sh            #   一鍵建置 image
│   └── docker-compose.yaml #   web 與 web-test 兩個 service
├── logs/                   # Nginx access/error log（內容不入版控）
│   └── .gitkeep
├── openspec/               # OpenSpec SDD 工作目錄（規格唯一事實來源）
│   ├── config.yaml         #   OpenSpec 設定（schema: spec-driven）
│   ├── changes/            #   進行中與已歸檔的變更提案
│   └── specs/              #   已落地的規格文件
├── tests/                  # Vitest 單元測試
│   ├── basic-interpreter.test.js
│   ├── apl-interpreter.test.js
│   ├── tapes.test.js
│   ├── audio-shape.test.js
│   ├── easter-eggs.test.js
│   └── ibn-name.test.js
├── web/                    # 靜態前端資產（pixel-perfect 還原 design 原型）
│   ├── index.html
│   ├── styles.css
│   ├── audio.js            #   WebAudio 音效引擎
│   ├── interpreter.js      #   BASIC + APL 直譯器（同檔雙環境匯出）
│   ├── tapes.js            #   七卷磁帶 fixtures
│   ├── tweaks-panel.js     #   浮動 Tweaks 面板（含 JSX）
│   └── app.js              #   主 React 元件樹（含 JSX）
├── package.json            # vitest dev dependency 與 npm scripts
├── package-lock.json       # 由 web-test container 內 npm install 產生
├── run.sh                  # 一鍵啟動（內部呼叫 build.sh + docker compose up）
└── README.md               # 本檔
```

---

## 使用指南

開機後依序敲下列命令探索：

```basic
HELP            列出全部命令
TAPES           列出全部磁帶卡匣
LOAD HELLO      載入 HELLO 磁帶
RUN             執行載入的 BASIC 程式
LIST            列出載入的程式行
NEW             清空 BASIC 程式記憶體
BASIC / APL     在兩種直譯器之間切換
CLS             清空螢幕
EJECT           退出當前磁帶
```

### BASIC 範例

```basic
10 FOR I = 1 TO 5
20 PRINT I, I*I
30 NEXT I
RUN
```

```basic
LOAD FIB-12     # 載入費氏數列磁帶
RUN             # 印出 12 行
```

### APL 範例

```apl
⍳ 5             # → 1 2 3 4 5
2 × 3 + 4       # → 14（由右而左求值）
(2 × 3) + 4     # → 10（括號改變優先）
1 2 3 + 10      # → 11 12 13（純量廣播）
```

> APL 由右而左求值是 APL 語言慣例，刻意保留以還原原型風貌；BASIC 維持左而右的標準
> 優先序。兩種模式的真假慣例也不同：BASIC 比較回 `-1` / `0`，APL 比較回 `1` / `0`。

---

## 彩蛋（Easter Eggs）

- `EL PSY KONGROO`（或 `EL PSY CONGROO`）— 觸發加密通訊訊息序列。
- `LOAD ∂.404` — 載入世界線變動率錶，96 px 大字 + glitch 動畫。
- `DIVERGENCE` — 直接切換到上述變動率錶，跳過讀取磁帶序列。
- 開機 POST 序列含 `WORLD LINE ............ 1.130426` 一行致敬。
- 終端閒置 45 秒後有 40% 機率印一句 SERN packet whisper。

---

## Tweaks（個人化）

設定面板預設隱藏，提供三類調整：

| 區塊 | 選項 |
|------|------|
| `PHOSPHOR` | P1 GREEN（預設）／ P3 AMBER ／ P4 WHITE |
| `DISPLAY` | `SCANLINES` 強度滑桿（0–80） |
| `AUDIO` | `SOUND FX` 開關 |

開啟方式（design 原型未提供 UI 入口，需手動觸發 host postMessage）：

```js
// 於瀏覽器 DevTools console 執行
window.postMessage({ type: '__activate_edit_mode' }, '*');
```

亮度（`BRIGHT`）與對比（`CONTRAST`）兩個旋鈕位於機殼控制列，直接拖曳即可。

---

## 品牌與商標

- **使用者面字串**一律使用 `IBN-5100` / `IBN · 5100`。任何包含 design.md Decision 7
  禁用的三字元商標的字串視為違規，由 `tests/ibn-name.test.js` 自動掃描 `web/`、
  `tests/` 內 `.html` / `.css` / `.js` 字串字面值與 `README.md` 全文。
- **Repo 名稱** `IBM5100` 為內部識別（GitHub 路徑），透過 markdown code 反引號包裹
  通過 ibn-name 測試的白名單。
- **JS identifier**（如 design 原型保留的 `window` 全域命名空間）屬於 `tests/ibn-name.test.js`
  的字串字面值掃描範圍之外（依 design.md Goal #4 與 Decision 7 的拍板），對應的具體
  名稱請參閱 `web/interpreter.js` 與 `web/audio.js`。

---

## 開發流程（OpenSpec 多代理）

本專案採用 **OpenSpec SDD + 多代理（Multi-Agent）** 架構。三個角色職責互斥、檔案範圍
受 `tasks.md` 邊界控制：

| 角色 | 職責 | 入口指令 |
|------|------|----------|
| **Coordinator** | 拆解需求、規劃 spec / tasks，禁止寫實作 | `/opsx:propose`、`/opsx:new`、`/opsx:continue`、`/opsx:ff` |
| **Specialist** | 依 `tasks.md` 撰寫程式碼與測試，禁止改動 spec | `/opsx:apply` |
| **Verifier** | 交叉比對 spec ↔ 實作、執行測試，唯讀審查 | `/opsx:verify`、`/opsx:archive` |

詳細規範定義於使用者全域 `~/.claude/CLAUDE.md`「OpenSpec 多代理開發規範」。

### 分支命名

- Feature branch：`opsx/<change-name>` 或 `feat/<change-name>`
- 主幹：`main`

### Commit 慣例

- [Conventional Commits](https://www.conventionalcommits.org/zh-hant/v1.0.0/)（Angular 風格）
- [Chris Beams 的 50/72 法則](https://cbea.ms/git-commit/)
- Commit message 使用繁體中文

### 重啟流程（修改 `web/` 後）

修改 `web/` 內任何檔案後，可選下列任一方式讓瀏覽器看到變更：

```sh
docker compose -f docker/docker-compose.yaml restart web
# 或
./run.sh
```

---

## 已知限制 / Non-goals

- **CDN 依賴**：React 18.3.1 / ReactDOM / `@babel/standalone` 走 unpkg CDN，需要網路
  連線；離線需求待後續 change 自托管。
- **無 build step**：保留 design 原型的「無 build」特性，pixel-perfect 還原優先。引入
  Vite / Webpack / esbuild 屬於後續 change（見 `openspec/changes/add-ibn5100-terminal/tasks.md`
  第 7 節）。
- **無 E2E 測試**：本次僅含單元測試（直譯器、磁帶資料、音效介面契約、彩蛋字面值、
  避商標）。互動流程以人類驗收為主，後續再以 Playwright 補上。
- **無 CI**：GitHub Actions 留待後續 change。
- **桌機優先**：行動裝置 / 觸控未做最佳化；旋鈕拖曳僅支援 pointer event。

---

## 授權

本專案目前未指定授權條款（All Rights Reserved by default）。日後若公開授權再行補上。
