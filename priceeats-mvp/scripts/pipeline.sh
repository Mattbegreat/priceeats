#!/bin/bash
# 全台擴張串流流程（M11.1）：discover → download → OCR → build → QA → import → 刪照片 → 記狀態，可續跑。
# 用法：bash scripts/pipeline.sh <區域> [區域 ...] [--batch 50] [--limit N] [--only 步驟] [--dry-run]
# 細節見 scripts/pipeline.py --help 與 README「全台擴張流程」。
cd "$(dirname "$0")/.." || exit 1
export PYTHONDONTWRITEBYTECODE=1
exec python3 -B scripts/pipeline.py "$@"
