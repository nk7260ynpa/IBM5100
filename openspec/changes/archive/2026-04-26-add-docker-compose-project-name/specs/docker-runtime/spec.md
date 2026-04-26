## ADDED Requirements

### Requirement: Compose project name 隔離

The system SHALL declare a top-level `name: ibn5100-terminal` in `docker/docker-compose.yaml`, ensuring this repository's compose project is uniquely named and isolated from other repositories that may also place a `docker-compose.yaml` file under a `docker/` subdirectory.

#### Scenario: yaml 頂層含 `name: ibn5100-terminal`

- **WHEN** 檢查 `docker/docker-compose.yaml`
- **THEN** 檔案頂層（與 `services:`、`volumes:` 同層級，亦即沒有任何縮排）必含一行 `name: ibn5100-terminal`
- **AND** 該行不在任一 service block 內，不被任何其他 mapping 巢狀包覆
- **AND** yaml 解析後 `compose["name"] == "ibn5100-terminal"`

#### Scenario: docker compose ls 顯示獨立 project

- **WHEN** 開發者啟動本 repo（執行 `./run.sh` 或 `docker compose -f docker/docker-compose.yaml up -d web`）
- **AND** 在另一個 shell 執行 `docker compose ls`
- **THEN** 列表中必出現名稱為 `ibn5100-terminal` 的 project
- **AND** 該 project 不與其他本機專案（如 FlightPrice、Tw_stock_*）共用 default project name `docker`

#### Scenario: 啟動時不再出現跨 repo 的 orphan 警告

- **WHEN** 在沒有其他專案 container 正以 default project name `docker` 在跑的前提下，於本 repo 執行 `./run.sh`
- **THEN** docker compose 不得印出包含其他專案 service（例如 `flightprice-db`、`grafana`、`tw_stock_database` 等）的 `Found orphan containers` 警告
- **AND** docker compose 不得對其他專案的 service（例如 `flightprice-web`）執行 `Recreated`、`Started`、`Stopped` 等動作

#### Scenario: 自動化檢查守護 `name:` 設定

- **WHEN** 執行 `docker compose -f docker/docker-compose.yaml run --rm web-test npm test`（或等價的 vitest 入口）
- **THEN** 測試套件必含至少一個測試案例斷言 `docker/docker-compose.yaml` 頂層 `name` 欄位等於 `ibn5100-terminal`
- **AND** 若該欄位被誤刪、誤改值、或被誤縮排到 service 內，該測試 FAIL 並回報可辨識訊息

#### Scenario: 使用者遷移指引存在

- **WHEN** 開發者打開專案根的 `README.md`
- **THEN** 必含一段「升級指引」或「故障排除」章節，說明如何清理過去以 default project name `docker` 啟動的舊 `ibn5100-terminal-web` container
- **AND** 該段落必含可複製貼上的清理指令（例如 `docker rm -f ibn5100-terminal-web` 或等價的 `docker compose -p docker ... down web` 變體）
