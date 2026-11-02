#!/bin/bash
# 把 priceeats-mvp 同步到 GitHub（取代網頁拖放上傳）。排除金鑰、node_modules、菜單照片。
# 第一次：brew install gh && gh auth login   （選 GitHub.com → HTTPS → 用瀏覽器登入）
# 之後：bash scripts/publish.sh "更新說明"
set -e
SRC="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$HOME/Downloads/priceeats-git"
MSG="${1:-更新 $(date +%m%d-%H%M)}"
[ -d "$REPO/.git" ] || gh repo clone Mattbegreat/priceeats "$REPO"
cd "$REPO" && git pull --ff-only
rsync -a --delete \
  --exclude node_modules --exclude .env.local --exclude '.env*.local' --exclude menu_dataset \
  --exclude .next --exclude out --exclude __pycache__ --exclude .DS_Store --exclude tsconfig.tsbuildinfo \
  --exclude test-results --exclude 'data/ocr-raw' --exclude 'data/ocr-chunks' --exclude 'data/ocr-run.*' \
  "$SRC/" "$REPO/priceeats-mvp/"
git add -A priceeats-mvp
if git diff --cached --quiet; then echo "沒有變更"; exit 0; fi
git -c user.name="Mattbegreat" -c user.email="Mattbegreat@users.noreply.github.com" commit -m "$MSG" -q
git push -q && echo "已推上 GitHub，Netlify 會自動重建：$MSG"
