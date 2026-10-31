"""在 Google 地圖搜尋關鍵字，把結果店家加進 data/shops.csv（已存在的 place_id 跳過）。

用法（Mac，在 priceeats-mvp 資料夾；先開登入 Google 的 Chrome）：
  python3 scripts/discover_shops.py --cdp http://localhost:9222 --query "南港車站 便當" --max 15
"""
import argparse, csv, os, re, time, urllib.parse
from playwright.sync_api import sync_playwright

CSV = os.path.join("data", "shops.csv")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cdp", required=True)
    ap.add_argument("--query", required=True, action="append", help="可重複指定多個關鍵字")
    ap.add_argument("--max", type=int, default=15, help="每個關鍵字最多新增幾家")
    a = ap.parse_args()
    rows = list(csv.DictReader(open(CSV, encoding="utf-8-sig")))
    known = {r["place_id"] for r in rows}
    next_id = max(int(r["id"]) for r in rows) + 1
    added = []
    with sync_playwright() as p:
        ctx = p.chromium.connect_over_cdp(a.cdp).contexts[0]
        page = ctx.new_page()
        for q in a.query:
            page.goto("https://www.google.com/maps/search/" + urllib.parse.quote(q) + "?hl=zh-TW", wait_until="domcontentloaded")
            time.sleep(5)
            feed = page.locator('div[role="feed"]')
            for _ in range(6):
                if feed.count():
                    feed.first.evaluate("e => e.scrollBy(0, 2000)")
                time.sleep(2)
            links = page.eval_on_selector_all('a[href*="/maps/place/"]', "els => els.map(e => [e.getAttribute('aria-label') || '', e.href])")
            n = 0
            for name, href in links:
                m_id = re.search(r"!19s(ChIJ[^!?&]+)", href)
                m_ll = re.search(r"!3d(-?[\d.]+)!4d(-?[\d.]+)", href)
                if not (name and m_id and m_ll) or m_id.group(1) in known:
                    continue
                known.add(m_id.group(1))
                r = {"id": f"{next_id:02d}", "name": name.strip(), "lat": m_ll.group(1), "lng": m_ll.group(2), "place_id": m_id.group(1)}
                rows.append(r); added.append(r); next_id += 1; n += 1
                if n >= a.max:
                    break
            print(f"[{q}] 新增 {n} 家")
        page.close()
    with open(CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "name", "lat", "lng", "place_id"]); w.writeheader(); w.writerows(rows)
    print("新增編號：" + ",".join(r["id"] for r in added) if added else "沒有新店家")

if __name__ == "__main__":
    main()
