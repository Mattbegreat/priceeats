"""收集進度盤點：依距離區域中心分圈，統計店家狀態。用法：python3 scripts/coverage.py [區域名稱，預設南港]"""
import csv, glob, json, math, os, sys
AREA = sys.argv[1] if len(sys.argv) > 1 else "南港"
_c = json.load(open("data/areas.json", encoding="utf-8"))[AREA]
C = (_c["lat"], _c["lng"])
print(f"區域：{AREA}（{_c['label']}）")
rings = [(0.5, "500m 內"), (1, "500m–1km"), (2, "1–2km"), (99, "2km 以上")]
skip = {l.strip() for l in open("data/ocr-skip.txt", encoding="utf-8") if l.strip() and not l.startswith("#")} if os.path.exists("data/ocr-skip.txt") else set()
stat = {r[1]: {"店家": 0, "已上線": 0, "沒菜單": 0, "照片太舊": 0, "待辨識": 0, "不收": 0} for r in rings}
for r in csv.DictReader(open("data/shops.csv", encoding="utf-8-sig")):
    d = math.hypot((float(r["lat"]) - C[0]) * 111, (float(r["lng"]) - C[1]) * 111 * math.cos(math.radians(25)))
    ring = next(n for lim, n in rings if d <= lim)
    s = stat[ring]; s["店家"] += 1
    md = glob.glob(f"menu_dataset/{r['id']}_*/metadata.json")
    m = json.load(open(md[0], encoding="utf-8")) if md else {}
    if os.path.exists(f"data/menus-maps2/{r['id']}.json") or os.path.exists(f"data/menus-maps3/{r['id']}.json") or os.path.exists(f"data/ocr-raw/{r['id']}.json") and r["id"] in skip or (r["id"] in skip and int(r["id"]) <= 13):
        s["已上線"] += 1
    elif r["id"] in skip:
        s["不收"] += 1
    elif m.get("status") != "ok":
        s["沒菜單"] += 1
    elif max(p["source_date"] for p in m["photos"]) < "2025-01-01":
        s["照片太舊"] += 1
    else:
        s["待辨識"] += 1
print("距離 | " + " | ".join(next(iter(stat.values())).keys()))
for k, v in stat.items():
    print(k + " | " + " | ".join(str(x) for x in v.values()))
