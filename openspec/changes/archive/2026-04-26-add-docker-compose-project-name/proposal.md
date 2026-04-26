## Why

本機多個專案（IBM5100、FlightPrice、Tw_stock_server_monitor、Tw_stock_DB、Tw_stock_ML）皆把 `docker-compose.yaml` 放在 `docker/` 子目錄且未設定頂層 `name:`，docker compose 因此把所有專案歸到同一個 default project name `docker`。啟動本 repo（`./run.sh`）時觀察到實際副作用：

- docker compose 輸出 `Found orphan containers ([flightprice-db grafana tw-stock-server-monitor prometheus node-exporter tw_stock_database tw-stock-ml docker-frontend-1 docker-backend-1 docker-crawler-1 docker-postgres-1])` 警告。
- `flightprice-web` 被列為「Recreated」（雖未實際啟動，仍是跨 repo 干擾）。
- 未來若對本 repo 執行 `docker compose ... down --remove-orphans` 會誤殺其他專案的 container。

需要把本 repo 的 compose 隔離到獨立 project name，避免污染與誤刪風險。

## What Changes

- `docker/docker-compose.yaml` 頂層新增 `name: ibn5100-terminal`，將本 repo 從 default project name `docker` 隔離出來。
- 檢查並（若必要）調整 `run.sh` 與 `docker/build.sh`，確保 CLI 不會以非預期方式覆蓋 yaml 內的 `name`（例如不引入 `COMPOSE_PROJECT_NAME` 或 `-p` flag 衝突）。
- 新增自動化檢查（具體形式於 design.md 拍板），守護 `docker/docker-compose.yaml` 之頂層 `name` 不被未來變更誤刪或誤改。
- `README.md` 補上 project name 變更後的「既有 container 遷移指引」段落（說明舊 project `docker` 下的 `ibn5100-terminal-web` 如何安全清理／重新建立）。
- 不修改其他 4 個專案的 compose 檔（屬不同 repo，不在本 change 範圍）。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `docker-runtime`: 新增「Compose project name 隔離」Requirement，規範頂層 `name:` 必須存在、值必須為 `ibn5100-terminal`，並要求自動化檢查守護。

## Impact

- **Code**：
  - `docker/docker-compose.yaml`（增加頂層 `name:`）
  - 視自動化檢查策略：可能新增 `tests/docker-compose-config.test.js` 或 shell 測試腳本
  - `run.sh` / `docker/build.sh`：預期不需改動，但需驗證並於 commit 訊息註明
- **Docs**：`README.md` 增加既有 container 遷移段落。
- **Specs**：`openspec/specs/docker-runtime/spec.md`（archive 後由 OpenSpec 自動套用 delta）。
- **Runtime / Migration**：本 repo 既有以 default project name 啟動的 `ibn5100-terminal-web` container 在 yaml 改動後會變成 orphan；使用者需依 README 指引清理一次。
- **Dependencies**：要求 docker compose v2.20+（支援頂層 `name:`）。需於 design.md 評估專案最低版本。
- **不影響**：其他 4 個本機專案 repo 完全不動。
