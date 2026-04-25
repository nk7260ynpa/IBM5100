# docker-runtime Specification

## Purpose
TBD - created by archiving change add-ibn5100-terminal. Update Purpose after archive.
## Requirements
### Requirement: Docker 目錄與檔案結構

The system SHALL provide a `docker/` directory at the project root containing the build script, Dockerfile, and Compose file, plus a top-level `run.sh`, all conforming to the global preferences in `~/.claude/CLAUDE.md`.

#### Scenario: 必要檔案齊備

- **WHEN** 變更落地後檢查專案根目錄
- **THEN** 必須存在以下檔案，路徑完全相符：
  - `/docker/Dockerfile`
  - `/docker/build.sh`（具執行權限 `chmod +x`）
  - `/docker/docker-compose.yaml`
  - `/run.sh`（具執行權限 `chmod +x`）
  - `/logs/.gitkeep`（用於保留資料夾，內容為空）

#### Scenario: 各腳本符合 Google Shell Style

- **WHEN** 執行 shellcheck 或 lint
- **THEN** `docker/build.sh` 與 `run.sh` 不違反 Google Shell Style Guide 的關鍵規則（含 `set -euo pipefail`、雙引號展開變數、避免 `eval`）

### Requirement: Dockerfile 基於 nginx:alpine 並 serve `web/`

The system SHALL build a single-stage image based on `nginx:alpine`, copy the entire `web/` directory to `/usr/share/nginx/html`, expose port 80, and rely on the default Nginx start command.

#### Scenario: Dockerfile 內容約束

- **WHEN** 檢查 `docker/Dockerfile`
- **THEN** `FROM` 指令使用 `nginx:alpine`（pinned tag 可選，但 base 必須為 alpine 變體）
- **AND** 透過 `COPY web/ /usr/share/nginx/html/` 將靜態資產放入
- **AND** 暴露 `EXPOSE 80`
- **AND** 不需自訂 `CMD`，沿用 base image 的 nginx daemon 啟動

#### Scenario: 不引入 Node.js runtime

- **WHEN** image 建置完成
- **THEN** 主映像不含 Node.js / npm 等開發 toolchain（測試是另一個 service / target，不混入 production image）

### Requirement: docker-compose.yaml 對外服務

The system SHALL define a `web` service in `docker/docker-compose.yaml` that builds from project context, exposes port 8080 → 80, and bind-mounts `./logs/` to `/var/log/nginx/` so Nginx access/error logs persist on the host.

#### Scenario: compose 服務定義

- **WHEN** 檢查 `docker/docker-compose.yaml`
- **THEN** 至少定義一個 service `web`：
  - `build` 指向 repo 根（`context: ..` 與 `dockerfile: docker/Dockerfile`）
  - `ports` 包含 `"8080:80"`（host:container；host port 可在文件中標註可調整）
  - `volumes` 包含 `../logs:/var/log/nginx`
  - `restart` 設為 `unless-stopped`

#### Scenario: 額外的 test service（可選但建議）

- **WHEN** 需要在 container 內執行單元測試
- **THEN** compose 可額外定義 `web-test` service（基於含 Node.js 的測試 image / target），用 `docker compose run --rm web-test npm test` 執行；該 service 不暴露 port、不掛載 `logs/`

### Requirement: build.sh 一鍵建置

The system SHALL provide `docker/build.sh` that builds the image with `docker compose build` (or `docker build`), printing a success summary on completion.

#### Scenario: build.sh 行為

- **WHEN** 在專案根執行 `./docker/build.sh`
- **THEN** 切換到 repo 根（透過 script 自身 path 計算），執行等價於 `docker compose -f docker/docker-compose.yaml build`
- **AND** 結束 status 為 0 表示成功；非 0 表示失敗（Bash 應 `set -e`）

### Requirement: run.sh 一鍵啟動

The system SHALL provide a top-level `run.sh` that ensures the image is built and starts the container, with `logs/` volume mount, on `http://localhost:8080`.

#### Scenario: run.sh 行為

- **WHEN** 在專案根執行 `./run.sh`
- **THEN** 內部依序：
  1. 確保 `logs/` 目錄存在（`mkdir -p logs`）
  2. 呼叫 `./docker/build.sh`（或 `docker compose build`）
  3. 執行 `docker compose -f docker/docker-compose.yaml up -d`（或 `up` 前景執行，二擇一並於 README 註明）
  4. 印出 `Listening on http://localhost:8080`

#### Scenario: 失敗時退出碼非 0

- **WHEN** Docker 未安裝、port 8080 已占用、或 build 失敗
- **THEN** `run.sh` 必須以非 0 exit code 結束，並輸出可辨識的錯誤訊息到 stderr

### Requirement: logs 目錄與 .gitignore 配合

The system SHALL keep `logs/` checked-in (via `.gitkeep`) yet ignore all log files inside (already covered by global gitignore rules: `logs/`、`*.log`).

#### Scenario: 目錄存在但內容不入版控

- **WHEN** 任何 Nginx access/error log 被寫入 `logs/`
- **THEN** `git status` 不顯示這些 `.log` 檔案為 untracked
- **AND** `logs/.gitkeep` 為唯一被版控的檔案，內容為空

### Requirement: 容器內測試流程

The system SHALL allow running unit tests inside a container with `docker compose run --rm <service> npm test`, fulfilling the global preference “Python / 測試環境亦於 Docker container 中執行” adapted to the JS toolchain.

#### Scenario: 測試命令成功運行

- **WHEN** 開發者執行 `docker compose -f docker/docker-compose.yaml run --rm web-test npm test`（service 名以 design.md 拍板為準）
- **THEN** Jest / Vitest 在 container 內執行 `tests/` 套件，所有測試 PASS
- **AND** 此命令亦可在 `tasks.md` 的驗收條件中作為自動化測試的入口

### Requirement: README 啟動章節

The system SHALL update the project root `README.md` to document Docker prerequisites, the `./run.sh` quick-start, the test command, and how to access the running site at `http://localhost:8080`.

#### Scenario: README 包含啟動指引

- **WHEN** 讀取 `README.md`
- **THEN** 必須有「快速開始」或同義章節，列出：
  - 前置需求：Docker Engine + Docker Compose v2
  - 啟動指令：`./run.sh`（執行後可在瀏覽器打開 `http://localhost:8080`）
  - 測試指令：`docker compose -f docker/docker-compose.yaml run --rm <service> npm test`
  - 停止指令：`docker compose -f docker/docker-compose.yaml down`

### Requirement: 修改程式碼後可重啟容器

The system SHALL support reloading the running site after `web/` changes either by re-running `./run.sh` or by `docker compose restart web`, fulfilling the global preference “每次修改完程式碼自動重啟 container”.

#### Scenario: 重啟流程

- **WHEN** 開發者修改 `web/` 內任何檔案
- **THEN** 透過 `docker compose -f docker/docker-compose.yaml restart web`（或 down + up）使瀏覽器強制 reload 後即可看到變更
- **AND** README 必須記錄此流程

### Requirement: 沒有額外 backend 依賴

The system SHALL keep the runtime image purely a static-file server; no databases, queues, external APIs, or background workers may be added in this change.

#### Scenario: 唯一服務

- **WHEN** 檢查 `docker-compose.yaml`
- **THEN** 除 `web`（與可選 `web-test`）外不得定義任何其他 service
- **AND** 此 change 不引入任何 Python / Node.js runtime 至 production image

