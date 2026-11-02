#!/bin/bash
# 在 Mac 本機用 agy 逐家跑菜單 OCR（不經過 Claude）。可隨時中斷，重跑會跳過已完成的店。
# 用法：caffeinate -i bash scripts/run_ocr.sh [同時幾家，預設 2]
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"
AGY="${AGY:-$HOME/.local/bin/agy}"
MODEL="${MODEL:-Gemini 3.8 Flash (Low)}"
JOBS="${1:-2}"
rm -f data/.quota-stop
: > data/ocr-run.err
python3 scripts/make_ocr_queue.py 2>/dev/null | head -1
IDS=$(grep -oE '^## [0-9]+' data/ocr-queue.md | awk '{print $2}')
TOTAL=$(echo "$IDS" | grep -c . )
echo "開始：$TOTAL 家，同時 $JOBS 家，紀錄在 data/ocr-run.log"
one() {
  id="$1"
  [ -f "data/ocr-raw/$id.json" ] && return 0
  [ -f data/.quota-stop ] && return 0
  for try in 1 2; do
    "$AGY" -p "不要執行任何指令（不要用 shell、ls、python），只用 read_file 與寫檔工具。
1. read_file 讀 $ROOT/docs/agy-ocr-rules.md，完全遵守其格式與收錄規則。
2. read_file 讀 $ROOT/data/ocr-queue.md，只處理「## $id」這一家：讀它的照片，把 JSON 寫到它的「輸出」路徑（相對路徑前面加 $ROOT/）。
完成後只回一行：$id(道數)。" --model "$MODEL" --add-dir "$ROOT" --print-timeout 300s > /dev/null 2>>data/ocr-run.err
    if tail -3 data/ocr-run.err 2>/dev/null | grep -q "quota reached"; then
      tail -1 data/ocr-run.err > data/.quota-stop; echo "$(date +%H:%M) Google 額度用完，停止：$(cat data/.quota-stop)" | tee -a data/ocr-run.log; return 0
    fi
    if [ -f "data/ocr-raw/$id.json" ]; then echo "$(date +%H:%M) $id ok" | tee -a data/ocr-run.log; return 0; fi
  done
  echo "$(date +%H:%M) $id 失敗" | tee -a data/ocr-run.log
}
export -f one; export AGY MODEL ROOT
echo "$IDS" | xargs -P "$JOBS" -I{} bash -c 'one {}'
echo "完成。已有 $(ls data/ocr-raw/*.json | wc -l) 個辨識檔。"
python3 scripts/build_from_ocr.py | tail -3
