"""產生 agy 的 OCR 待辦清單 data/ocr-queue.md：每家只列最新日期的菜單照。

跳過：下載未成功、最新照片早於 --since、data/ocr-raw/<編號>.json 已存在。
用法：python3 scripts/make_ocr_queue.py [--since 2025-01-01]
"""
import argparse, glob, json, os

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="2025-01-01")
    a = ap.parse_args()
    root = os.path.abspath(".")
    skip = set()
    if os.path.exists("data/ocr-skip.txt"):
        skip = {l.strip() for l in open("data/ocr-skip.txt", encoding="utf-8") if l.strip() and not l.startswith("#")}
    lines, skipped = ["# PriceEats OCR 待辦（agy 用）", "", "路徑都相對於 /Users/jingjhongchen/Downloads/priceeats-mvp/", ""], []
    for d in sorted(glob.glob("menu_dataset/*_*")):
        sid = os.path.basename(d).split("_")[0]
        if sid in skip:
            continue
        try:
            m = json.load(open(os.path.join(d, "metadata.json"), encoding="utf-8"))
        except Exception:
            continue
        out = os.path.join("data", "ocr-raw", f"{sid}.json")
        if m.get("status") != "ok" or os.path.exists(out) or os.path.exists(os.path.join("data", "menus-maps2", f"{sid}.json")):
            continue
        photos = m.get("photos", [])
        newest = max(p["source_date"] for p in photos)
        if newest < a.since:
            skipped.append(f"{sid} {m['restaurant']['name']}（最新照片 {newest}）"); continue
        pick = [p for p in photos if p["source_date"] == newest][:2]
        lines += [f"## {sid} {m['restaurant']['name']}"]
        lines += [f"- 照片：{os.path.join(d, p['file_name'])}" for p in pick]
        lines += [f"- 輸出：{out}", ""]
    n = sum(1 for l in lines if l.startswith("## "))
    open("data/ocr-queue.md", "w", encoding="utf-8").write("\n".join(lines))
    print(f"待辦 {n} 家 → data/ocr-queue.md")
    for s in skipped:
        print("跳過（照片太舊）：" + s)

if __name__ == "__main__":
    main()
