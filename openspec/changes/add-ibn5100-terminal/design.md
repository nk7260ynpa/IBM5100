## Context

- **目前狀態**：repo 只有 root commit（`README.md`、`.gitignore`、`.claude/`、`openspec/`），尚無實作程式碼。
- **設計來源**：`_inbox/ibm5100/`（從 Claude Design 匯出）。包含 `IBN-5100 Terminal.html` 入口、`styles.css`、與 5 份 React JSX 檔（`audio.jsx`、`interpreter.jsx`、`tapes.jsx`、`tweaks-panel.jsx`、`app.jsx`）。原型刻意採用 **UMD React 18 + `@babel/standalone` 即時 JSX 轉譯**的「無 build step」模式，讓設計師可直接在瀏覽器迭代。
- **設計師明示意圖**（來源 `_inbox/ibm5100/README.md`）：
  > Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase. Match the visual output; don't copy the prototype's internal structure unless it happens to fit.
  → 我們有自由選擇技術，但 **視覺與互動行為必須完全保留**（含掃描線、磷光、彩蛋）。
- **約束**（來自 `~/.claude/CLAUDE.md`）：
  - 服務一律於 Docker container 中執行；專案需有 `docker/` + `logs/` + `run.sh`。
  - JS 程式碼必須含單元測試（依設計師意圖類比 Python 偏好）；測試於 container 內執行。
  - Markdown 遵 Google Markdown Style；README 必含架構說明。
  - Conventional Commits + 50/72；繁體中文。
- **品牌約束**：UI 字串必須是 `IBN-5100`（避免 IBM 商標），repo 名稱 `IBM5100` 僅作專案內部識別。
- **角色約束**：本文件由 Coordinator 撰寫，**不撰寫實作**；下游 Specialist 才會落地 `web/` / `tests/` / `docker/`。

## Goals / Non-Goals

**Goals:**

1. 落地一份**可長期維護**的 IBN-5100 終端機網頁專案，視覺與互動 100% 對齊原型（每個 spec scenario 都有對應實作）。
2. 提供 **Docker 一鍵啟動**：`./run.sh` 後可在 `http://localhost:8080` 看到完整終端機。
3. 提供**可單元測試的純函式模組**（BASIC tokenizer / parser / evaluator、APL 求值、磁帶 fixtures），覆蓋率達到「能被 Verifier 信賴」的水準。
4. 保留 design 原型的 **`window.IBMTerm` / `window.IBMSound` / `window.TAPES` / Tweaks helpers** 全域介面（pixel-perfect 重現的最低風險路徑）。
5. 文件化（`README.md`）涵蓋啟動、測試、彩蛋、避商標約束。

**Non-Goals:**

1. **不**引入 Vite / Webpack / esbuild 等 build step（保留 Babel-standalone「無 build」特性，見 Decision 1）。
2. **不**做 SSR、SSG、伺服器端渲染。
3. **不**新增任何 backend / 資料庫 / API endpoint。
4. **不**引入 CI（GitHub Actions）—— 留待後續 change。
5. **不**做 E2E 測試（Playwright）—— 留待後續 change（屬於 nice-to-have，不在本次 spec 中）。
6. **不**支援離線（CDN-loaded React + Babel）—— 後續若有需求再評估自托管。
7. **不**支援 mobile / touch 操作的最佳化（design 為桌機體驗，touch 僅做 fallback，不對應到磁帶/旋鈕拖曳的細部 UX）。
8. **不**為 APL 加入完整鍵盤輸入法（`⍳⍴⌈⌊×÷` 透過剪貼或鍵盤映射輸入即可）。

## Decisions

### Decision 1：保留 UMD React 18 + Babel-standalone（不引入 build step）

**選擇**：HTML 直接 `<script>` 載入 `react@18.3.1` UMD、`react-dom@18.3.1` UMD、`@babel/standalone@7.29.0`，並以 `<script type="text/babel" src="...jsx">` 載入 JSX。`web/` 目錄結構與原型一致。

**理由**：

- 設計師 README 明示「pixel-perfect」是核心；保留同一技術堆疊可消除「轉換失真」的風險。
- 任何 build step 都會引入 `dist/` 路徑、source map、tree-shaking 行為，與原型 1:1 比對的成本變高。
- Nginx 靜態 serve 是最簡單的容器化路徑；無 build = no Node.js 在 production image。
- 設計檔本身就是「最終可執行檔」，加 build step 反而是無謂層次。

**替代方案（被否決）**：

- **Vite + React JSX 編譯**：好處是少了 babel-standalone 的執行期負擔（~100 KB+ 解碼）、更快首屏；壞處是會強迫所有 JSX 被預編譯，跟原型結構分離。**Trade-off：本次選擇放棄首屏速度，換取對 design 100% 還原與後續 review 可比對性**。
- **Next.js 移植**：對單頁靜態應用是 overkill；引入 SSR / 路由抽象、Node runtime，違反 Non-Goal 1。

**留下退路**：若日後需要離線 / CSP 嚴格化 / 首屏優化，再以新 change 引入 Vite，純函式模組已抽乾淨即可無痛切換。

### Decision 2：純函式模組「同檔雙環境」匯出策略

**選擇**：`interpreter.js`、`tapes.js`、`audio.js` 以 IIFE 為主結構，內部在最後做 host detection：

```js
(function (root) {
  // ... 邏輯 ...
  const api = { makeBASICEnv, execImmediate, runProgram, evalAPL, formatAPL, tokenize };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;          // Node / Jest
  } else {
    root.IBMTerm = api;            // 瀏覽器
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

**理由**：

- 一份原始檔即可被瀏覽器 `<script>` 與 Node `require()` / Jest 載入。
- 不需 dual-package、不需 babel transform、不需 ESM ↔ CJS adapter。
- Specialist 可以最直接地把原型 `interpreter.jsx` 改名為 `interpreter.js` 並在尾段加 host detection（保留 IIFE 結構）。

**替代方案（被否決）**：

- **改用 ESM `export`**：需要 build step 把 `import` 改寫成 `<script type="module">` 載入；瀏覽器需多一輪 fetch；Jest 需要 `--experimental-vm-modules` 或 babel-jest。Trade-off：複雜度提升，無實質好處。
- **拆出 `*.node.js` / `*.browser.js` 雙檔**：違反 single source of truth；維護兩份意味著容易脫鉤。

### Decision 3：測試框架 = **Vitest**

**選擇**：使用 Vitest（Vite 生態，原生支援 ESM 與 CJS、TS 友好、快速啟動），設定獨立的 `web-test` Docker service 在容器內執行。

**理由**：

- Vitest 對 IIFE / CommonJS 模組無痛載入（`require('../web/interpreter.js')` 即可）。
- 啟動時間遠低於 Jest（雖然本專案未引 ts，但 Vitest 對 watch 模式體驗更好）。
- 與「不引入 Vite as build step」並不矛盾：Vitest 只是測試工具，不會把 web/ 變成 Vite 應用。
- DOM 模擬（jsdom）開箱即用，未來若想加上 React 元件測試（`@testing-library/react`）時可平滑擴充。

**替代方案（被否決）**：

- **Jest**：成熟但啟動慢、ESM 支援需額外 config。
- **Node 內建 `node:test` + `node:assert`**：零依賴最乾淨；但對未來想加 DOM/React 測試的擴充性差。
- **手寫測試**：違反「品質底線」與 CLAUDE.md「必須含單元測試」原則。

### Decision 4：目錄結構

```
IBM5100/
├── .claude/                      # Claude Code 工作空間（既有）
├── _inbox/                       # 設計收件匣（gitignored）
├── docker/
│   ├── Dockerfile                #   nginx:alpine 單階段
│   ├── build.sh                  #   docker compose build wrapper
│   └── docker-compose.yaml       #   web service + web-test service
├── logs/
│   └── .gitkeep                  #   保留資料夾，內容空
├── openspec/                     # OpenSpec SDD（既有）
├── tests/
│   ├── basic-interpreter.test.js
│   ├── apl-interpreter.test.js
│   ├── tapes.test.js
│   ├── audio-shape.test.js
│   ├── easter-eggs.test.js
│   └── ibn-name.test.js          #   全資產 grep 不可有 `IBM` / `ibm`
├── web/
│   ├── index.html                #   原 IBN-5100 Terminal.html，rename + 修 src 路徑
│   ├── styles.css
│   ├── audio.js                  #   原 audio.jsx + host detection 尾段
│   ├── interpreter.js            #   同上
│   ├── tapes.js                  #   同上（純資料 + 雙環境匯出）
│   ├── tweaks-panel.js           #   保持 type="text/babel" 載入（含 JSX）
│   └── app.js                    #   保持 type="text/babel" 載入（含 JSX）
├── package.json                  #   定義 vitest dev dep + npm test script
├── package-lock.json             #   container 內首次 install 後 commit
├── run.sh
├── README.md                     #   改寫為實際專案說明
└── .gitignore                    #   既有 + 一個小調整（_inbox/ 已加上）
```

**特別說明**：

- `web/audio.js`、`web/interpreter.js`、`web/tapes.js` 是純 JS（不含 JSX 語法），用 `<script src="...">` 載入即可，**不**需 Babel 轉譯（避免增加 boot 開銷）。
- `web/tweaks-panel.js`、`web/app.js` 含 JSX，必須以 `<script type="text/babel" src="...">` 載入；副檔名統一為 `.js`（HTML 屬性區分 type）。
- `tests/` 一律 `.test.js`，由 Vitest config 自動 glob。

### Decision 5：Docker 服務拆分（web / web-test）

**選擇**：`docker-compose.yaml` 定義兩個 service：

| Service | Image base | Volumes | Ports | 用途 |
|---|---|---|---|---|
| `web` | `nginx:alpine`（`docker/Dockerfile`） | `../logs:/var/log/nginx` | `8080:80` | 正式靜態 serve |
| `web-test` | `node:20-alpine`（內聯 `image:` 即可，無需獨立 Dockerfile） | `..:/app`、`/app/node_modules` | 無 | `npm test` 執行 vitest |

**理由**：

- 將 production image 與 test image 隔離 → production 不背 Node toolchain（image 約 25 MB vs 200+ MB）。
- 測試命令統一為 `docker compose -f docker/docker-compose.yaml run --rm web-test npm test`，符合 CLAUDE.md「測試環境亦於 Docker container 中執行」的偏好。
- `node_modules` 用 named volume 隔離 host，避免汙染 macOS / Linux 不一致的 binary。

**替代方案（被否決）**：

- **單一 multistage Dockerfile（builder + runtime）**：對沒有 build step 的 web 不適用；複雜度反而提升。
- **GitHub-Actions only 跑測試**：違反 CLAUDE.md「測試於 container 內執行」要求；CI 規劃留給後續 change。

### Decision 6：Spec 切分為 8 份，依「責任邊界」而非「檔案邊界」

**選擇**：8 份 spec（`crt-shell` / `basic-interpreter` / `apl-interpreter` / `tape-system` / `audio-engine` / `tweaks-panel` / `easter-eggs` / `docker-runtime`）。

**理由**：

- 這個切分讓 Verifier 在審查時，每份 spec 對應**一個可獨立測試的關注點**，例如 `easter-eggs` 跨多個檔案但獨立可驗證；`tape-system` 涵蓋 metadata、命令、UI 動畫一條龍。
- `docker-runtime` 獨立成 spec 可保 CLAUDE.md 對 web 專案的硬性要求被當成「能力」而非雜務 task。

**替代方案（被否決）**：

- **以檔案切**（`audio.spec`、`interpreter.spec`、`app.spec`）：會把跨檔案的彩蛋邏輯切散，不利驗收。

### Decision 7：避商標的執行落地

**選擇**：

1. UI 字串一律 `IBN-5100`、`IBN · 5100`、`IBN5100`；任何包含 `IBM` 三字元的字串視為違規。
2. `tests/ibn-name.test.js` 對 `web/` + `README.md` 內所有可顯示文字字面值做 grep，命中 `IBM` / `ibm` 即測試失敗（白名單：`README.md` 中提到 GitHub repo 名稱 `IBM5100` 屬於必要標示，需以反引號標記並在白名單豁免）。
3. Repo 名稱 `IBM5100` 僅出現於 GitHub URL 與 `package.json#name`（如需 publish 再改名）。

**替代方案（被否決）**：

- **完全不允許 `IBM5100` 字串**：但 GitHub repo 名稱、git remote URL 已存在；違反現實。

### Decision 8：CDN vs 自托管 React/Babel

**選擇**：CDN（unpkg）+ SRI hash（design 已附）。

**理由**：

- pixel-perfect 與 design 一致；零額外資產複製。
- SRI integrity 已存在於 design HTML 中，沿用即安全。

**替代方案（被否決）**：

- **下載至 `web/vendor/`**：適合離線需求，但目前 Non-Goal 6 已排除離線；可後續改。

### Decision 9：State 管理 = React 內建 hooks（不引入 Redux / Zustand）

**選擇**：app.js 沿用 design 的 `useState` / `useRef` / `useEffect` / `useCallback`；不引入任何狀態庫。

**理由**：原型已經是 React 函式元件 + hooks 寫法；狀態結構單純，沒有跨樹分享需求。

### Decision 10：BASIC 與 APL 的真假慣例不一致 → 保留差異（spec 顯式聲明）

**選擇**：BASIC 比較回 `-1`/`0`、APL 比較回 `1`/`0`，保留 design 原本行為。

**理由**：BASIC 慣例為負一即真；APL 慣例為正一。改成統一會破壞兩語言的歷史風貌，且 design 原本即如此。

**Trade-off**：使用者在跨模式時可能感到困惑；用 README 文件化即可。

## Risks / Trade-offs

- **[Risk]** Babel-standalone 的執行期 overhead（首屏多 ~100–200 ms 的 JSX 編譯時間）。  
  **Mitigation**：本次保留以維持 pixel-perfect；後續若 Lighthouse / 體感拖累再開新 change 改 Vite。

- **[Risk]** 純函式測試覆蓋不到 React 元件互動（例如「按 Enter 執行 RUN，FIB-12 跑完」整條鏈）。  
  **Mitigation**：本次先保證直譯器層 100% 對 spec scenario 對齊；React 互動以人類驗收為主，後續再以 Playwright 補上。

- **[Risk]** `tests/ibn-name.test.js` 可能誤殺 `README.md` 中合法出現的 `IBM5100`（指 repo）。  
  **Mitigation**：測試實作維護白名單檔案＋白名單 substring（`backtick-IBM5100-backtick`），並在 README 用 markdown code 寫 \`IBM5100\`。

- **[Risk]** macOS / Linux Docker volume mount 對 logs/ 目錄權限差異可能造成 Nginx 寫入失敗。  
  **Mitigation**：`run.sh` 開頭 `mkdir -p logs`；compose 設定 `read_only: false`；如仍失敗，README 提供 `chmod 755 logs/` 與 `chown` 指引。

- **[Risk]** APL 由右而左求值的測試斷言可能與部分讀者直覺衝突。  
  **Mitigation**：spec 已顯式列出例題（`2 × 3 + 4 = 14`）；測試以這些例題為基準。

- **[Risk]** 設計原型的 `<script type="text/babel">` 不支援 ESM `import` —— 需要把所有 helper 透過 globals 串接。  
  **Mitigation**：保留 design 原本的全域命名空間（`IBMTerm` / `IBMSound` / `TAPES`），spec 已明示。

- **[Risk]** Production image 不含 Node 工具，與 test image 行為不對等可能掩蓋差異（例如 polyfill）。  
  **Mitigation**：所有純函式測試在 Node 跑；`web/` 內所有程式碼必須是 ES 2018+ 標準語法、避免依賴 Node 專屬 globals（測試 setup 中對 `window` / `AudioContext` 用 stub）。

- **[Trade-off]** UMD CDN 載入需要網路連線。本變更暫不解決（Non-Goal 6）。

- **[Trade-off]** Vitest 對 IIFE 模組的偵錯體驗略遜於 ESM；但本次模組單純（純函式），影響有限。

## Migration Plan

由於 `main` 上沒有實作程式碼，本次落地不涉及資料 / API 遷移。流程：

1. **Coordinator（本次）**：產出 spec / design / tasks，commit & push 到 `opsx/add-ibn5100-terminal`。
2. **人類 Review spec**：確認 8 份 spec、design.md、tasks.md 無誤；若需調整由 Coordinator 改寫並再次 push。
3. **Specialist `/opsx:apply`**：依 `tasks.md` 順序實作。每完成一組 task 即 commit & push（feature branch 上多次 commit 允許）。完成後主對話自動觸發 Verifier。
4. **Verifier `/opsx:verify`**：跑完整測試 + 對 spec scenario 比對；PASS 後將驗證報告交回使用者。
5. **使用者人工驗收**：本機執行 `./run.sh`，於 `http://localhost:8080` 操作所有彩蛋與磁帶。
6. **Verifier `/opsx:archive`**：no-ff merge `opsx/add-ibn5100-terminal` 回 `main`，刪 feature branch，archive 該 change。

**回滾**：若使用者驗收失敗且修改成本過高，使用 `git revert` 將 archive merge commit 反向；feature branch 仍保留歷史。最差情況直接 `git reset --hard` 到 `0aa6b76`（pre-change main HEAD）—— 因尚無使用者依賴。

## Open Questions

1. **CDN integrity hash 升級節奏**：design 提供的 React 18.3.1 SRI hash 是否需要在本次主動升級至 18.3.x 最新？  
   → **暫定**：保留 design 提供的 18.3.1，避免 SRI mismatch。後續安全更新另開 change。

2. **`run.sh` 預設前景或背景啟動**：design 沒指明。  
   → **暫定**：預設 `up` 前景啟動（看 log 方便）；README 註記 `up -d` 為背景模式。Specialist 可依 task 中具體驗收條件實作。

3. **`web-test` service 內 `node_modules` 第一次安裝時機**：是 `npm install` 在 host 內預先生 `package-lock.json` 後 commit，還是純粹於 container 內 install？  
   → **決定**：在 host 上**只生 `package.json`**（手寫，不執行 install）；首次 `package-lock.json` 由 `docker compose run --rm web-test npm install` 在 container 內生成後一次 commit。確保 lock 檔反映的是 container 內 Node 20-alpine 的真實 resolution。

4. **Tweaks 面板的 host postMessage 協定**：在獨立部署（沒有 design 平台 host）情境下，`__edit_mode_*` 訊息會無 listener。是否要讓 `Tweaks` 改成預設可見？  
   → **暫定**：保留 design 行為（預設隱藏，等 host 啟動）。但 README 提示使用者透過開發者工具 `window.postMessage({type:'__activate_edit_mode'},'*')` 開啟，或由 Specialist 在 `app.js` 增加一條鍵盤捷徑（例如 `Ctrl+,`）做 fallback；後者列入 tasks.md 的「nice-to-have」task。

5. **是否需要 favicon？** design 沒附。  
   → **暫定**：本次不處理；HTML head 加 `<link rel="icon" href="data:,">` 抑制 404 即可（Specialist 可酌情實作；列入 tasks.md）。

6. **Container CPU/memory limit 是否在 compose 中設定？**  
   → **暫定**：本次不設，因為 nginx:alpine 本身 footprint 極小；後續若部署到資源受限環境再開 change。
