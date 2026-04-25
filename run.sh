#!/usr/bin/env bash
#
# run.sh — 一鍵啟動 IBN-5100 Terminal。
# 對應 openspec/changes/add-ibn5100-terminal/specs/docker-runtime/spec.md 的
# 「run.sh 一鍵啟動」Requirement。
#
# 使用：
#   ./run.sh         # 前景啟動（看到 Nginx log，Ctrl-C 停止）
#   ./run.sh -d      # 背景啟動（之後可用 `docker compose ... down` 停止）

set -euo pipefail

# 切到 script 所在目錄（即 repo 根）。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# 確保 logs/ 存在（給 Nginx access/error log 用，並由 docker-compose 掛載）。
mkdir -p logs

# 確認 Docker 可用，否則提供可辨識訊息並非 0 退出。
if ! command -v docker >/dev/null 2>&1; then
  echo "[run.sh] ERROR: docker 未安裝或不在 PATH 中。" >&2
  exit 1
fi

# 建置 image。build.sh 內部已 set -e。
./docker/build.sh

# 解析旗標：是否背景啟動。
DETACHED=false
for arg in "$@"; do
  case "${arg}" in
    -d|--detach) DETACHED=true ;;
    *) ;;
  esac
done

if [[ "${DETACHED}" == "true" ]]; then
  echo "[run.sh] Starting container in background..."
  docker compose -f docker/docker-compose.yaml up -d web
else
  echo "[run.sh] Starting container in foreground (Ctrl-C to stop)..."
  echo "[run.sh] Listening on http://localhost:8080"
  docker compose -f docker/docker-compose.yaml up web
fi

echo "Listening on http://localhost:8080"
