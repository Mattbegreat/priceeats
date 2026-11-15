"""把 agy 寫的 data/ocr-raw/<編號>.json 加上店家資料，轉成匯入格式 data/menus-maps2/<編號>.json。

per_piece=true 的品項（每顆計價）換算成 10 顆。
用法：python3 scripts/build_from_ocr.py   之後  npm run import:menu -- --dry-run data/menus-maps2
"""
import csv, glob, json, os

import re
KW = r"(必吃|推薦|外送|外帶|會議|便當推薦|美食|人氣|熱門|平價|宵夜|晚餐|午餐|早午餐|下午茶|低卡|健康餐|專門店|專賣店|直營|滿\d+元)"
# 括號內的營業／促銷／訂位資訊（如「(滿額贈)」「(休假日請看IG)」「(最後點餐時間…)」）
PROMO = r"(滿額|贈|優惠|訂餐|訂位|預約|電話|LINE|line|IG|臉書|粉絲|公休|休假|店休|不定休|最後|[Ll]ast order|營業|僅此一家|絕無分店|不接待|不對外|開放|takeaway|活動)"
# 尾綴雜訊：自該詞（含前面的分隔符）起整段移除
TAIL = r"[\s\-/]*(?:連鎖第一品牌|心累|見紅休).*$"
def clean_name(s):
    o = s
    s = re.sub(TAIL, "", s)
    s = re.split(r"\s*[|｜《【]\s*", s)[0]
    s = re.sub(r"\s*[(（][^()（）]*(?:" + KW + "|" + PROMO + r")[^()（）]*[)）]?.*$", "", s)
    s = re.split(r"\s*[/／]\s*(?=.*" + KW + ")", s)[0]
    s = re.sub(r"\s*-\s*\S*" + KW + r".*$", "", s)
    s = re.sub(r"\s+\S*" + KW + r"\S*(/\S*)*$", "", s) if "/" in s else s
    s = s.replace("·開啟過的連結", "").strip(" -”。\"|/")
    return s if len(s) >= 2 else o

CATS = {"便當", "飯類", "麵食", "肉類", "海鮮", "早餐", "小吃", "自助餐"}

def main():
    names = {r["id"]: r["name"] for r in csv.DictReader(open("data/shops.csv", encoding="utf-8-sig"))}
    reject = set()
    if os.path.exists("data/ocr-reject.txt"):
        reject = {l.strip() for l in open("data/ocr-reject.txt", encoding="utf-8") if l.strip() and not l.startswith("#")}
    os.makedirs("data/menus-maps2", exist_ok=True)
    for raw in sorted(glob.glob("data/ocr-raw/*.json")):
        sid = os.path.basename(raw)[:-5]
        if sid in reject:
            continue
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
        r["name"] = clean_name(names.get(sid, r["name"]))
        out = {"restaurant": {k: r[k] for k in ("name", "address", "lat", "lng", "google_maps_url")},
               "source": "menu_photo", "source_date": date, "source_image": img, "items": items}
        json.dump(out, open(f"data/menus-maps2/{sid}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"{sid} {r['name']}：{len(items)} 道" + (f"（剔除 {bad} 筆格式不符）" if bad else ""))

if __name__ == "__main__":
    main()
