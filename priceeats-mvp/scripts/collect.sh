#!/bin/bash
# 收集新店家：搜尋 → 下載菜單照 → 產生 agy OCR 待辦
# 用法：bash scripts/collect.sh --query "南港車站 便當" [--query "南港 麵"] [--max 15]
cd "$(dirname "$0")/.." || exit 1
python3 scripts/discover_shops.py --cdp http://localhost:9222 "$@" || exit 1
python3 scripts/download_menus.py --cdp http://localhost:9222
python3 scripts/make_ocr_queue.py
