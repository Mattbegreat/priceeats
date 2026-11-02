"""找出菜單照太舊或沒抓到菜單的店，印出重抓指令。用法：python3 scripts/refresh_stale.py [--months 12]"""
import argparse, glob, json, os
from datetime import date

ap = argparse.ArgumentParser(); ap.add_argument("--months", type=int, default=12); a = ap.parse_args()
t = date.today(); y, m = t.year, t.month - a.months
while m <= 0: y -= 1; m += 12
cut = f"{y}-{m:02d}-01"
reject = {l.strip() for l in open("data/ocr-reject.txt", encoding="utf-8") if l.strip() and not l.startswith("#")} if os.path.exists("data/ocr-reject.txt") else set()
stale, nomenu = [], []
for f in sorted(glob.glob("menu_dataset/*_*/metadata.json")):
    sid = os.path.basename(os.path.dirname(f)).split("_")[0]
    if sid in reject: continue
    md = json.load(open(f, encoding="utf-8"))
    if md.get("status") != "ok": nomenu.append(sid)
    elif max(p["source_date"] for p in md["photos"]) < cut: stale.append(sid)
print(f"照片早於 {cut}：{len(stale)} 家；沒抓到菜單：{len(nomenu)} 家")
ids = ",".join(stale + nomenu)
if ids:
    print("重抓（舊照會被覆蓋，之後重跑 OCR 前要先把對應 data/ocr-raw/<編號>.json 移走）：")
    print(f"python3 scripts/download_menus.py --cdp http://localhost:9222 --force --only {ids}")
