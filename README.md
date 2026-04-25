# IBM5100

> 個人實驗性專案，採用 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 規格驅動開發（Spec-Driven Development, SDD）流程，並搭配 Claude Code 多代理協作（Coordinator / Specialist / Verifier）。

目前處於 **初始化階段**，尚未有任何功能性程式碼；後續將以 `openspec/changes/` 下的提案逐步落地。

---

## 專案架構

```
IBM5100/
├── .claude/                # Claude Code 工作空間（slash command、skills、本地設定）
│   ├── commands/           #   專案層自訂 slash command
│   ├── skills/             #   專案層 skills
│   └── settings.local.json #   本地個人設定（不入版控）
├── openspec/               # OpenSpec SDD 工作目錄（唯一的 spec 事實來源）
│   ├── config.yaml         #   OpenSpec 設定（schema: spec-driven）
│   ├── changes/            #   進行中與已歸檔的變更提案
│   │   └── archive/        #     已完成、已合併的歷史 change
│   └── specs/              #   已落地的規格文件（由 archive 同步而來）
├── .gitignore
└── README.md               # 本檔
```

未來新增程式碼時，將依以下慣例擴充：

- `docker/`：`Dockerfile`、`build.sh`、`docker-compose.yaml`
- `logs/`：執行時產出的 log（內容不入版控）
- `run.sh`：啟動主程式（先啟動 container，再執行主程式並掛載 `logs/`）
- `tests/`：單元測試（於 container 內執行，例：`docker compose run --rm app pytest`）

---

## 開發流程

本專案採用 **OpenSpec SDD + 多代理（Multi-Agent）** 架構。三個角色職責互斥、檔案範圍受 `tasks.md` 邊界控制：

| 角色 | 職責 | 入口指令 |
|------|------|----------|
| **Coordinator** | 拆解需求、規劃 spec / tasks，禁止寫實作 | `/opsx:propose`、`/opsx:new`、`/opsx:continue`、`/opsx:ff` |
| **Specialist** | 依 `tasks.md` 撰寫程式碼與測試，禁止改動 spec | `/opsx:apply` |
| **Verifier** | 交叉比對 spec ↔ 實作、執行測試，唯讀審查 | `/opsx:verify`、`/opsx:archive` |

### 標準路徑

```
人類提需求
   │
   ▼  /opsx:propose 或 /opsx:new + /opsx:continue
[Coordinator] 切 feature branch、產出 proposal/specs/design/tasks
   │  人類 Review spec
   ▼  /opsx:apply（主對話委派）
[Specialist] 依 tasks.md 實作程式碼與測試
   │  完成後主對話「自動觸發」/opsx:verify
   ▼
[Verifier] 交叉驗證
   ├── PASS → 人類驗收 → /opsx:archive（no-ff merge 回原分支）
   └── FAIL → issues.md → 退回 Specialist 修復（同一 change 上限 4 次）
```

詳細規範定義於使用者全域 `~/.claude/CLAUDE.md`「OpenSpec 多代理開發規範」。

### 分支命名

- Feature branch：`opsx/<change-name>` 或 `feat/<change-name>`
- 主幹：`main`

### Commit 慣例

- [Conventional Commits](https://www.conventionalcommits.org/zh-hant/v1.0.0/)（Angular 風格）
- [Chris Beams 的 50/72 法則](https://cbea.ms/git-commit/)
- Commit message 使用繁體中文

---

## 常用指令一覽

| 指令 | 用途 |
|------|------|
| `/opsx:propose <題目>` | 一次產出 proposal/specs/design/tasks 並切 feature branch |
| `/opsx:new <題目>` | 僅建立 change 骨架，後續以 `/opsx:continue` 漸進產出 |
| `/opsx:continue` | 推進當前 change 的下一份 artifact |
| `/opsx:apply` | 委派 Specialist 依 `tasks.md` 實作 |
| `/opsx:verify` | 委派 Verifier 進行交叉驗證 |
| `/opsx:archive` | 驗收 PASS 後合併 feature branch、歸檔 change |
| `/opsx:explore` | 進入探索／規格釐清模式（不寫程式碼） |

---

## 授權

本專案目前未指定授權條款（All Rights Reserved by default）。日後若公開授權再行補上。
