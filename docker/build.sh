#!/usr/bin/env bash
#
# build.sh — 建置 IBN-5100 Terminal Docker image。
# 對應 openspec/changes/add-ibn5100-terminal/specs/docker-runtime/spec.md 的
# 「build.sh 一鍵建置」Requirement。

set -euo pipefail

# 解析自身路徑並切到 repo 根，無論呼叫端目錄為何。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

echo "[build.sh] Building Docker image from ${REPO_ROOT}"
docker compose -f docker/docker-compose.yaml build

echo "Build complete."
