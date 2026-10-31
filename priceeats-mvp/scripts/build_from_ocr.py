"""把 agy 寫的 data/ocr-raw/<編號>.json 加上店家資料，轉成匯入格式 data/menus-maps2/<編號>.json。

per_piece=true 的品項（每顆計價）換算成 10 顆。
用法：python3 scripts/build_from_ocr.py   之後  npm run import:menu -- --dry-run data/menus-maps2
"""
import csv, glob, json, os

CATS = {"便當", "飯類", "麵食", "肉類", "海鮮", "早餐", "小吃", "自助餐"}

def main():
    names = {r["id"]: r["name"] for r in csv.DictReader(open("data/shops.csv", encoding="utf-8-sig"))}
    os.makedirs("data/menus-maps2", exist_ok=True)
    for raw in sorted(glob.glob("data/ocr-raw/*.json")):
        sid = os.path.basename(raw)[:-5]
        d = glob.glob(f"menu_dataset/{sid}_*")
        if not d:
            print(f"{sid}：找不到 menu_dataset，略過"); continue
        m = json.load(open(os.path.join(d[0], "metadata.json"), encoding="utf-8"))
        try:
            data = json.load(open(raw, encoding="utf-8"))
        except Exception as e:
            print(f"{sid}：JSON 格式錯誤 {e}"); continue
        items, bad = [], 0
        for it in data.get("items", []):
            try:
                name, price, cat = str(it["name"]).strip(), int(it["price"]), it.get("category")
            except Exception:
                bad += 1; continue
            if cat not in CATS or price <= 0:
                bad += 1; continue
            if it.get("per_piece"):
                name, price = f"{name}（10顆，每顆{price}元）", price * 10
            items.append({"name": name, "price": price, "category": cat, "tags": [], "confidence": float(it.get("confidence", 0.9))})
        img = data.get("source_image", "google-maps-menu-photo-1")
        date = next((p["source_date"] for p in m["photos"] if p["source_image"] == img), m["photos"][0]["source_date"])
        r = dict(m["restaurant"])
        r["name"] = names.get(sid, r["name"].split("|")[0])
        out = {"restaurant": {k: r[k] for k in ("name", "address", "lat", "lng", "google_maps_url")},
               "source": "menu_photo", "source_date": date, "source_image": img, "items": items}
        json.dump(out, open(f"data/menus-maps2/{sid}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"{sid} {r['name']}：{len(items)} 道" + (f"（剔除 {bad} 筆格式不符）" if bad else ""))

if __name__ == "__main__":
    main()
