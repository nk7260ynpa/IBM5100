# add-ibn5100-terminal — Issues

本檔記錄 Specialist 在 `/opsx:apply` 過程中發現的、超出個別 task 範圍或需要 Coordinator/Verifier 確認的事項。
格式：`[角色] [時間戳] [嚴重度: HIGH/MED/LOW] 描述`。

---

## 2026-04-25 首次 /opsx:apply 過程紀錄

### [Specialist] [2026-04-25] [LOW] `.gitignore` 例外規則必要修改

`tasks.md` Task 1.4 要求「`logs/.gitkeep` 加入版控」。但專案根 `.gitignore` 既有規則 `logs/` 會把整個資料夾連同 `.gitkeep` 一併忽略，導致無法 track。

**處置**：將 `.gitignore` 中 `logs/` 改為 `logs/*` 並追加 `!logs/.gitkeep` 例外。此修改：

- 完全保留「log 檔不入版控」的全域偏好（`logs/` 內任何檔案仍被忽略）
- 是實現 design.md Decision 4（明確列出 `logs/.gitkeep` 為版控檔）與 task 1.4 驗收條件的唯一可行做法
- 屬於配置性、非實作性變更

`.gitignore` 雖未列入 task 1.4 的「檔案範圍」，但若不調整則 task 1.4 永不可能完成。建議 Coordinator 在後續 spec/tasks 修訂時將 `.gitignore` 顯式納入該 task 範圍以消除此模糊。Verifier 可將此修改視為 task 1.4 的隱含必要副作用。

### [Specialist] [2026-04-25] [LOW] `IBM` 字串掃描的合理範圍解讀

`easter-eggs/spec.md`「彩蛋與 IBN-5100 命名互斥於 IBM」Requirement 的 Scenario 寫的是：

> WHEN 自動化測試掃描 `web/`、`tests/` 內所有 `.html` / `.css` / `.js` **字串字面值**

而 `tasks.md` Task 4.6 寫的是「全部內容...斷言不出現 IBM 或 ibm」。兩者粒度不同。

design.md Goal #4 與 Decision 1 都明確指示**保留** `window.IBMTerm` / `window.IBMSound` 全域命名空間（「pixel-perfect 重現的最低風險路徑」）。若採 task 4.6 字面解讀（全部檔案內容），則 `interpreter.js`、`audio.js`、`app.js` 都會違反，需要重新設計命名空間，與 design.md 衝突。

**處置**：實作 `tests/ibn-name.test.js` 時採 spec 的「字串字面值」語意：
1. 對 `.html` / `.css` 全文掃描（這兩種格式內容皆可視為使用者面字串）。
2. 對 `.js` 檔僅掃描雙引號 / 單引號 / 反引號內的字串字面值；JS 識別字（如 `IBMTerm`、`IBMSound`）不算違規。
3. 同時加入「白名單」常數陣列（保留 `IBMTerm`、`IBMSound` 名稱字串以便 `app.js` 等以字串形式 reference 該全域時能通過；但實作上應盡量避免）。
4. README 中 ` `IBM5100` `（反引號包覆指 GitHub repo）為唯一允許出現的 IBM 字串。

這個做法同時尊重 spec 的細粒度語意與 design.md 的命名約束，並仍能阻擋使用者面字串（boot 訊息、help、tape 標籤、彩蛋 payload）混入 `IBM`。建議 Coordinator 後續釐清 task 4.6 描述以對齊 spec scenario。

### [Specialist] [2026-04-25] [LOW] 設計原型存在 `IBM` 字面殘留，需轉檔時 scrub

下列原型檔的非機密註解／文字含有 `IBM`，轉成 `web/` 時改為 `IBN`：

- `_inbox/ibm5100/project/styles.css` line 1：`/* IBM 5100-style retro terminal ... */` → `IBN-5100-style`。
- `_inbox/ibm5100/project/app.jsx` line 1：`// Main React app for the IBM 5100-style terminal.` → `IBN-5100`。

此修改在 task 2.2（styles.css 「不改任何字元」）與 task 2.7（app.js）的範圍內視情況處理：

- **2.2 衝突**：spec/task 2.2 嚴格要求「不改任何字元」，但 styles.css 第一行包含 `IBM`。task 2.7 要 app.js scrub `IBM`。`IBM` 字串掃描測試會抓到 styles.css 第一行。**處置**：在 task 2.2 內做最小修改，僅替換首行註解中的 `IBM 5100-style` → `IBN-5100-style`（其他字元、變數、規則完全不動），符合 task 2.7 的「防禦性 IBM scrub」精神，並讓 ibn-name 測試通過。建議 Coordinator 後續更新 task 2.2 描述以承認此例外。

### [Specialist] [2026-04-25] [LOW] interpreter.jsx 對舊版 design 註解的相容說明

`interpreter.jsx` 開頭兩行為：

```
// Tiny BASIC + APL interpreter for the retro terminal
// Exposes: window.runBASIC(source, io), window.runAPL(line, env, io), window.evalBASICLine(...)
```

但實際 IIFE 末尾匯出的是 `window.IBMTerm = { makeBASICEnv, execImmediate, runProgram, evalAPL, formatAPL, tokenize }`。註解過時。task 2.4 要求 spec 行為一致即可，註解非實作；本次依 spec 實際行為改寫註解到反映真實 API（不再提及不存在的 `runBASIC`/`runAPL`/`evalBASICLine`），不影響任何 scenario。
