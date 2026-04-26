## 1. 配置修補

- [x] 1.1 在 `docker/docker-compose.yaml` 頂層（與 `services:`、`volumes:` 同層級）新增一行 `name: ibn5100-terminal`
  - **檔案範圍**：`docker/docker-compose.yaml`
  - **驗收條件**：
    - [ ] 檔案頂層存在 `name: ibn5100-terminal`，且不在任一 service block 內
    - [ ] yaml 仍可被 `docker compose config` 解析通過（語法合法）
    - [ ] 既有 `web` 與 `web-test` 兩個 service 的設定（image、build、ports、volumes、restart、command）完全未被改動
    - [ ] 對應 spec：`docker-runtime` Requirement「Compose project name 隔離」之 Scenario「yaml 頂層含 `name: ibn5100-terminal`」

- [x] 1.2 驗證 `run.sh` 與 `docker/build.sh` 不需改動
  - **檔案範圍**：`run.sh`、`docker/build.sh`（僅檢查，預期不修改；若實際必須修改，須先寫入 `issues.md` 由 Coordinator 重新拆 task）
  - **驗收條件**：
    - [ ] 確認兩支腳本未設定 `COMPOSE_PROJECT_NAME` 環境變數，且未使用 `-p <name>` flag 覆寫 yaml 內的 `name`
    - [ ] 確認兩支腳本仍以 `docker compose -f docker/docker-compose.yaml ...` 形式呼叫，project name 推導完全交給 yaml
    - [ ] 在 commit message 中明確記錄「驗證後不需修改」之結論
    - [ ] 若需修改，停手並寫入 `openspec/changes/add-docker-compose-project-name/issues.md`，格式遵循全域偏好 `[Specialist] [時間戳] [HIGH] 描述`

## 2. 自動化檢查與測試

- [x] 2.1 新增 vitest 測試 `tests/docker-compose-config.test.js` 以守護 `name:` 設定
  - **檔案範圍**：`tests/docker-compose-config.test.js`（新檔）；如需 yaml 解析依賴，連同 `package.json`、`package-lock.json` 一併納入範圍
  - **驗收條件**：
    - [ ] 測試讀取 `docker/docker-compose.yaml`，斷言頂層 `name === "ibn5100-terminal"`
    - [ ] 測試斷言該 `name` 欄位位於 yaml top-level，不在任一 service 內（可用 yaml 解析後檢查 `compose.services[*].name` 不存在 `"ibn5100-terminal"` 字串、或用 anchored regex `/^name:\s*ibn5100-terminal\s*$/m` 確認所在行無縮排）
    - [ ] 若選擇引入新依賴（例如 `js-yaml`），於 task commit 中說明動機，且該依賴版本固定
    - [ ] 在 `docker compose -f docker/docker-compose.yaml run --rm web-test npm test` 流程中執行該測試，PASS
    - [ ] 對應 spec：`docker-runtime` Requirement「Compose project name 隔離」之 Scenario「自動化檢查守護 `name:` 設定」

## 3. 文件與遷移指引

- [ ] 3.1 在 `README.md` 加入「升級指引」或「故障排除」章節，說明既有 container 遷移
  - **檔案範圍**：`README.md`
  - **驗收條件**：
    - [ ] 章節包含「為何需要遷移」一句話背景（default project name `docker` 與其他 repo 衝突）
    - [ ] 章節含可複製貼上的清理指令（至少包含 `docker ps -a --filter "name=ibn5100-terminal-web"` 確認，與 `docker rm -f ibn5100-terminal-web` 或等價的 `docker compose -p docker ... down web` 清理步驟）
    - [ ] 章節說明清理後再執行 `./run.sh` 即恢復正常
    - [ ] 章節遵循 Google Markdown Style Guide
    - [ ] 對應 spec：`docker-runtime` Requirement「Compose project name 隔離」之 Scenario「使用者遷移指引存在」

- [ ] 3.2 人工驗收：實際執行遷移與啟動，確認 project 隔離成功
  - **檔案範圍**：無檔案異動（純驗證步驟）；驗證結果寫入 commit message 或 issues.md
  - **驗收條件**：
    - [ ] 依 README 指引清理舊 `ibn5100-terminal-web` container（一次性）
    - [ ] 執行 `./run.sh`，確認啟動 log 不含跨 repo 的 service 名稱（如 `flightprice-web Recreated`、`Found orphan containers ([flightprice-db ...])`）
    - [ ] 執行 `docker compose ls`，確認列表中存在獨立 project `ibn5100-terminal`，且不再與其他本機專案共用 default project `docker`
    - [ ] 對應 spec：`docker-runtime` Requirement「Compose project name 隔離」之 Scenario「docker compose ls 顯示獨立 project」與「啟動時不再出現跨 repo 的 orphan 警告」
