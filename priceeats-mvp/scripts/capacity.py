"""M11.0 容量量測（數字用程式算）。三個子命令：

  python3 scripts/capacity.py counts      # 用公開 anon key 讀各表列數（環境變數 SUPABASE_URL、SUPABASE_ANON_KEY；不寫入）
  python3 scripts/capacity.py ocr         # 讀 data/ocr-run.log 與 data/ocr-raw/*.json 的修改時間
  python3 scripts/capacity.py estimate --stores 2413 --foods 87201 --tags 371 --verifs 87201 [--free-mb 500]

只讀、不改任何資料。log 的時間只有 HH:MM（沒有日期），所以「場次」用時間倒退或間隔 > 90 分鐘切開，屬推測。
"""
import argparse, collections, glob, json, os, re, sys, urllib.error, urllib.request
from datetime import datetime, timedelta, timezone

TW = timezone(timedelta(hours=8))
# 每列估計位元組（含 heap tuple 標頭 24B、對齊、索引項）。這是假設，不是量測；實際大小請讀 Supabase 後台。
ROW_BYTES = {  # 表: (低, 高, 說明)
    "restaurants": (450, 700, "name/address/google_maps_url 文字 + 2 個 double + uuid + 2 個 timestamptz；索引：pkey、(lat,lng)、unique(name,address)"),
    "foods": (300, 450, "uuid×3 + name(中文約 25 字≈75B) + description + price + 2 ts；索引：pkey、unique(restaurant_id,name)、price、category、restaurant"),
    "food_tags": (100, 150, "兩個 uuid；索引：複合 pkey、category_id"),
    "price_verifications": (150, 250, "uuid×2 + 數個短文字 + numeric + 2 ts；索引：pkey、(food_id, verified_at)"),
}


def counts():
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_ANON_KEY")
    if not (url and key):
        sys.exit("請設 SUPABASE_URL 與 SUPABASE_ANON_KEY（公開 anon key）")
    for t in ("restaurants", "foods", "food_tags", "price_verifications", "menu_images"):
        for extra in ("", "&is_test_data=eq.false"):
            req = urllib.request.Request(f"{url}/rest/v1/{t}?select=*{extra}", headers={"apikey": key, "Authorization": "Bearer " + key, "Prefer": "count=exact", "Range": "0-0"})
            try:
                r = urllib.request.urlopen(req)
                print(f"{t}{' [is_test_data=false]' if extra else ''}: {r.headers.get('Content-Range')}")
            except urllib.error.HTTPError as e:
                print(f"{t}{' [is_test_data=false]' if extra else ''}: HTTP {e.code} {json.loads(e.read() or b'{}').get('message', '')}")


def ocr():
    rows = []
    for l in open("data/ocr-run.log", encoding="utf-8"):
        m = re.match(r"(\d\d):(\d\d) (.*)", l.strip())
        if m:
            rows.append((int(m[1]) * 60 + int(m[2]), m[3]))
    segs, cur = [], [rows[0]]
    for r in rows[1:]:
        if r[0] < cur[-1][0] - 5 or r[0] - cur[-1][0] > 90:
            segs.append(cur); cur = [r]
        else:
            cur.append(r)
    segs.append(cur)
    print(f"log 行數 {len(rows)}；推測場次 {len(segs)}")
    tot_ok = tot_fail = 0; clean_ok = clean_sec = 0
    for i, s in enumerate(segs, 1):
        ok = sum(1 for _, t in s if t.endswith(" ok")); fail = sum(1 for _, t in s if "失敗" in t); q = sum(1 for _, t in s if "額度" in t)
        span = s[-1][0] - s[0][0]
        per = (span * 60 / (ok - 1)) if ok > 1 else None
        print(f"場次{i}: {s[0][0]//60:02d}:{s[0][0]%60:02d}–{s[-1][0]//60:02d}:{s[-1][0]%60:02d} 歷時 {span} 分｜成功 {ok}｜失敗 {fail}｜額度訊息 {q}｜每家（整體）{per:.1f} 秒" if per else f"場次{i}: 成功 {ok}")
        tot_ok += ok; tot_fail += fail
        if per and fail == 0 and ok >= 20:
            clean_ok += ok - 1; clean_sec += span * 60
    print(f"log 合計 成功 {tot_ok}、失敗 {tot_fail}（失敗行包含 agy 兩次嘗試都沒產生檔的店）")
    if clean_ok:
        w = clean_sec / clean_ok
        print(f"無失敗場次的整體平均：每家 {w:.1f} 秒（同時 2 家 → 單家約 {w*2:.0f} 秒；同時家數 log 沒記錄，以預設 2 推算）")
    days = collections.Counter()
    for f in glob.glob("data/ocr-raw/*.json"):
        days[datetime.fromtimestamp(os.stat(f).st_mtime, TW).strftime("%Y-%m-%d")] += 1
    print(f"ocr-raw 檔數 {sum(days.values())}；依修改日期（UTC+8）每日完成數：")
    for d in sorted(days):
        print(f"  {d}: {days[d]}")
    print(f"有紀錄的天數 {len(days)}；最大單日 {max(days.values())}；平均每個有紀錄的日子 {sum(days.values())/len(days):.0f}")


def estimate(a):
    per1k = {"restaurants": 1000.0, "foods": a.foods / a.stores * 1000, "food_tags": a.tags / a.stores * 1000, "price_verifications": a.verifs / a.stores * 1000}
    print("每 1,000 家店對應列數：" + "；".join(f"{k} {v:,.0f}" for k, v in per1k.items()))
    lo = sum(per1k[t] * ROW_BYTES[t][0] for t in per1k); hi = sum(per1k[t] * ROW_BYTES[t][1] for t in per1k)
    print(f"每 1,000 家估計大小（資料＋索引）：{lo/1e6:.1f}–{hi/1e6:.1f} MB（估算）")
    print(f"目前 {a.stores:,} 家估計：{lo*a.stores/1000/1e6:.0f}–{hi*a.stores/1000/1e6:.0f} MB（估算；請與後台實測比對）")
    for base in (0, 50, 100):
        cap_hi = (a.free_mb - base) * 1e6 / lo * 1000; cap_lo = (a.free_mb - base) * 1e6 / hi * 1000
        print(f"免費上限 {a.free_mb:g} MB、系統基底 {base} MB（假設）→ 可容納約 {cap_lo:,.0f}–{cap_hi:,.0f} 家（含目前 {a.stores:,} 家）")
    if a.measured_mb:
        mb_per_k = a.measured_mb / a.stores * 1000
        print(f"若以後台實測 {a.measured_mb:g} MB（全部資料）粗算，每 1,000 家約 {mb_per_k:.1f} MB，免費上限約可容納 {a.free_mb / mb_per_k * 1000:,.0f} 家（含基底，偏保守）")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("counts"); sub.add_parser("ocr")
    e = sub.add_parser("estimate")
    e.add_argument("--stores", type=int, required=True); e.add_argument("--foods", type=int, required=True)
    e.add_argument("--tags", type=int, required=True); e.add_argument("--verifs", type=int, required=True)
    e.add_argument("--free-mb", type=float, default=500); e.add_argument("--measured-mb", type=float, default=0)
    a = ap.parse_args()
    {"counts": counts, "ocr": ocr}.get(a.cmd, lambda: estimate(a))()


if __name__ == "__main__":
    main()
