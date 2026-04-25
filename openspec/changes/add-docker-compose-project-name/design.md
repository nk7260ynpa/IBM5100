## Context

`add-ibn5100-terminal` change 已 archive，main 分支提供完整的 docker-runtime capability：`docker/Dockerfile`、`docker/docker-compose.yaml`（含 `web` 與 `web-test` 兩個 service）、`docker/build.sh`、`run.sh`。

實際在本機啟動本 repo 時觀察到：

1. `docker compose -f docker/docker-compose.yaml ...` 會把 project name 推導為 yaml 所在資料夾名稱，亦即 `docker`。
2. 本機其他 4 個專案（FlightPrice、Tw_stock_server_monitor、Tw_stock_DB、Tw_stock_ML）也採同樣的 `docker/docker-compose.yaml` 結構，因此全部被 docker compose 視為同一個 project `docker`。
3. 啟動本 repo 時 docker compose 因此印出 `Found orphan containers ([flightprice-db grafana tw-stock-server-monitor prometheus node-exporter tw_stock_database tw-stock-ml docker-frontend-1 docker-backend-1 docker-crawler-1 docker-postgres-1])`，並把已停止的 `flightprice-web` 標為 Recreated。

雖然目前未造成資料遺失，但 `docker compose ... down --remove-orphans` 在這個 default project name 下會誤殺其他 4 個專案的 container，是高風險缺陷。

Constraints：

- 修補僅限本 repo，不得修改其他 repo 的 compose 檔（即使能解，也屬於別人的 repo）。
- 必須保留現有 `web` 與 `web-test` 兩個 service 的行為與 spec 相容性。
- 自動化檢查必須能在 container 內或本機 Node.js 中執行（沿用既有 vitest 工具鏈為佳，避免新增 toolchain）。

Stakeholders：本 repo 的開發者（即 repo owner）為唯一受影響使用者；副作用會殃及本機其他 4 個專案。

## Goals / Non-Goals

**Goals:**

- 本 repo 的 docker compose project name 必為獨立識別碼 `ibn5100-terminal`，不再與其他 repo 共用 default `docker`。
- `docker compose ls` 能看到本 repo 為獨立 project。
- 啟動 `./run.sh` 時不再印出與其他 repo 相關的 `Found orphan containers` 警告（前提是其他 4 個專案的 container 沒被誤啟動到本 repo project 之下）。
- 提供自動化檢查，避免未來變更誤刪／誤改 `name:`。
- 提供一段遷移指引，協助使用者清理舊 default project 留下的 orphan container。

**Non-Goals:**

- 不修改其他 4 個本機專案 repo 的 compose 檔。
- 不改動現有 `web` / `web-test` service 的 image、port、volume 設定（僅在 yaml 頂層加 `name`）。
- 不引入新 docker compose v2 語法以外的工具（如 podman、kustomize）。
- 不對 GitHub Actions 或 CI 流程做變動（本專案目前無 CI workflow）。

## Decisions

### Decision 1：以 `docker-compose.yaml` 頂層 `name:` 設定 project name

**選擇方案**：在 `docker/docker-compose.yaml` 頂層新增

```yaml
name: ibn5100-terminal
```

**理由**：

- 該語法為 docker compose v2.20+ 內建支援（[Compose Specification: Top-level name element](https://docs.docker.com/reference/compose-file/version-and-name/)）。Docker Desktop 4.25+ 與 Docker Engine 24.0+ 內建的 compose plugin 都已 ≥ v2.20。Repo owner 本機使用 Docker Desktop，最低版本可滿足。
- 「設定一次、處處生效」：`./run.sh`、`./docker/build.sh`、開發者直接打 `docker compose -f docker/docker-compose.yaml ...` 都會自動採用此 project name，無需在 CLI 帶 `-p` flag 或在 shell 設環境變數。
- 隨 yaml 一同進版控，未來 fork 或 clone 的開發者立即繼承隔離設定，不需口耳相傳。

**被否決的替代方案**：

| 方案 | 否決理由 |
|---|---|
| 於 CLI 加 `-p ibn5100-terminal` flag | 需修改 `run.sh` 與 `build.sh`，且使用者若直接打 `docker compose ...` 仍會用回 default。涵蓋面不完整。 |
| 設定 `COMPOSE_PROJECT_NAME=ibn5100-terminal` 環境變數 | 需在 shell 或 `.env` 設定，跨機器/跨 shell 體驗不一致。`.env` 雖可進版控，但語意較隱晦（不在 yaml 顯眼處）。 |
| 把 `docker-compose.yaml` 從 `docker/` 移到 repo 根 | 雖能讓 default project name 變成 repo 根目錄名 `IBM5100`（仍會與其他 repo 區分），但會違反全域偏好「網頁專案結構」（`docker/` 資料夾應含 compose）並引發 `add-ibn5100-terminal` change 的 spec 衝突，影響面大。 |

### Decision 2：自動化檢查策略

**選擇方案**：新增 vitest 測試 `tests/docker-compose-config.test.js`，使用 Node.js 內建 `fs` 與既有的 yaml 解析（若 `package.json` 已有 `js-yaml`／`yaml` 則沿用；否則以純文字 regex 確認 `^name:\s*ibn5100-terminal\s*$` 出現於頂層）。

**理由**：

- 既有測試套件以 vitest 為主（archive 後的 `tests/` 已含多個 `.test.js`），沿用同一 runner 可在 `docker compose run --rm web-test npm test` 流程中一併執行，不需新增 shell 測試框架或 GH Action。
- 測試斷言內容簡單，不需複雜 yaml schema 驗證；以「字串／regex 比對」即足夠，且若日後需擴充（如禁止 `COMPOSE_PROJECT_NAME` env override），同檔案可加新 test case。
- 失敗訊息對人類可讀（vitest reporter）。

**被否決的替代方案**：

| 方案 | 否決理由 |
|---|---|
| Shell 測試（`bats` 或純 bash） | 需新增 toolchain，且測試結果難融入既有 `npm test` 流程。 |
| `docker compose config` 後 grep | 需在 CI/測試環境內安裝 docker，違反「測試於 container 內執行 Node.js」既有路線；本機跑可行但 web-test 容器內不會有 docker CLI。 |
| 不加自動化、僅靠 spec scenario 守護 | spec 是離線文件，無法阻止實作回歸；archive 後若有人手抖刪掉 `name:` 一行，測試不擋就只能靠 review 人工眼力。 |

**對 `package.json` 的影響評估**：以最小改動為原則，先嘗試「純文字／regex」斷言不引入新依賴；若實作時發現解析需求複雜（例如要驗證 `name:` 確實在 top-level 而非某 service 內），再評估是否新增 `js-yaml` 依賴（須由 Specialist 在 task 內紀錄並由 Verifier 確認）。

### Decision 3：既有 container 遷移路徑

**選擇方案**：「文件指引 + 一次性手動清理」，不寫自動 cleanup script。

具體在 `README.md` 的「快速開始」或「故障排除」章節新增一段：

> 若你曾以舊版 `docker-compose.yaml`（無 `name:` 行）啟動過本 repo，docker compose 會把 container 留在 default project `docker` 下。升級後請先執行：
>
> ```bash
> # 確認舊 container 是否還在
> docker ps -a --filter "name=ibn5100-terminal-web"
> # 若存在，移除舊 project 中的 service（不會影響其他 repo 的 service）
> docker compose -p docker -f docker/docker-compose.yaml down web web-test 2>/dev/null || docker rm -f ibn5100-terminal-web
> # 再以新 project name 啟動
> ./run.sh
> ```

**理由**：

- 自動 cleanup script 風險高：腳本若誤判其他 repo 的 service，反而可能誤刪。文字指引可讓使用者自行核對 `docker ps` 輸出。
- 本 repo 目前只有 owner 一人在用，遷移成本低；不值得為一次性遷移寫長期維護的 script。
- 仍提供具體指令（不是空話「請手動清理」），使用者能複製貼上。

**被否決的替代方案**：

| 方案 | 否決理由 |
|---|---|
| 在 `run.sh` 加 cleanup 邏輯 | 跨 project 操作（`-p docker down web`）有誤殺其他 repo container 的風險；且 cleanup 應只執行一次，不該每次 `./run.sh` 都跑。 |
| 完全不處理，使用者自行解決 | 違反「文件需含啟動／故障排除指引」全域偏好；orphan container 不清理會持續占用 `ibn5100-terminal-web` 名稱。 |
| 寫獨立 `docker/migrate-project-name.sh` | 過度工程；本 change 是一次性遷移，不需常駐工具。 |

## Risks / Trade-offs

- [docker compose 版本 < v2.20 不支援頂層 `name:`] → Mitigation：在 README 與 task 中明列「需要 docker compose v2.20+ / Docker Desktop 4.25+」；自動化測試在 web-test 容器內僅檢查 yaml 字串，無 docker daemon 版本依賴，因此本地測試不受影響；實際啟動失敗時 docker 會給可辨識錯誤。
- [既有 `ibn5100-terminal-web` container 在改動後變 orphan，使用者若忽略 README 指引不清理] → Mitigation：README 段落顯著放在「故障排除」或「升級指引」；docker 自身啟動時也會印出 orphan 警告（雖然訊息文字不變，但本 repo 自己的 container 出現在 orphan 清單會更明顯）。
- [自動化測試只用 regex 比對，可能漏掉「`name:` 出現在某 service 內而非 top-level」這種人為錯誤] → Mitigation：以 anchored regex（`^name:\s*ibn5100-terminal\s*$`，搭配 `m` flag 與「不在縮排上下文」檢查）控制；若測試實作時發現難以單純 regex 涵蓋，Specialist 可改用 yaml 解析（會在 task 中記錄是否引入 `js-yaml`）。
- [使用者直接打 `docker compose -f docker/docker-compose.yaml -p docker ...` 仍能繞過 yaml `name:`] → Mitigation：屬「使用者刻意覆蓋」場景，不在防護範圍。spec 只規範 yaml 內容、不規範使用者 CLI 行為。

## Migration Plan

**順序**：

1. 切到 `opsx/add-docker-compose-project-name` 分支（已完成，本 change 階段）。
2. Specialist 階段（`/opsx:apply`）：
   1. 修改 `docker/docker-compose.yaml`，於頂層第 4 行（services 之前）加 `name: ibn5100-terminal`。
   2. 驗證 `run.sh`、`docker/build.sh` 不需異動（預期不需）；若驗證有問題則記入 issues.md。
   3. 新增 `tests/docker-compose-config.test.js`。
   4. 修改 `README.md`，加入遷移指引段落。
3. Verifier 階段：執行 `docker compose run --rm web-test npm test`，確認所有測試 PASS。
4. 使用者人工驗收：
   1. 依 README 指引清理舊 `ibn5100-terminal-web` container（一次性）。
   2. 執行 `./run.sh`，確認啟動時不再有「`flightprice-web Recreated`」這類跨 repo 的 service 動作。
   3. 執行 `docker compose ls`，確認 `ibn5100-terminal` 與其他專案分屬不同 project。

**Rollback Strategy**：若加上 `name:` 後無法啟動（例如 docker compose 版本過舊），revert 該 commit 即可恢復原狀；無資料遷移、無破壞性 schema 變更。

## Open Questions

- 自動化測試斷言是否要進一步包含「不存在 `COMPOSE_PROJECT_NAME` env file」與「README 含遷移指引段落」？目前 spec 只規範 `name:` 必須存在；若要強化保護，可在 tasks.md 增列加碼測試。**人類 Review 時請拍板**。
- `name: ibn5100-terminal` 的命名是否與 image name `ibn5100-terminal-web`（已存在於 `docker/docker-compose.yaml`）的命名風格一致？目前一致（皆為 `ibn5100-terminal` 前綴），保留。
