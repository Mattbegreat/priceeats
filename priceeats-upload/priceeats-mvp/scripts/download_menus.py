"""下載 Google 地圖「菜單」分頁的照片（每家最多 3 張）與店家資料，供後續辨識。

用法（Windows 終端機，在 priceeats-mvp 資料夾）：
  python scripts\\download_menus.py --only 12        # 先試一家
  python scripts\\download_menus.py                  # 全部（已完成的店會自動跳過）
  python scripts\\download_menus.py --headless       # 不開視窗（較容易被要求驗證）

注意：
- 這是自動瀏覽，請保持慢速、小量（本專案僅限 shops.csv 的店家），遇到驗證碼請在視窗手動完成。
- 輸出在 menu_dataset\\（已加入 .gitignore，不要上傳）。
- 需要：pip install playwright 以及 python -m playwright install chromium
"""
import argparse
import csv
import json
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime

from playwright.sync_api import sync_playwright

MAX_PHOTOS = 3
# 菜單縮圖：Google 圖床的使用者照片路徑；排除頭像（/a/、/a-/）
PHOTO_HINTS = ("/p/", "/grass-cs/", "/gps-cs-s/", "/gps-cs/", "/geougc-cs/")


def hi_res(url: str) -> str:
    """把圖床網址尾端的尺寸參數換成 =s2048（不會超過原圖大小）"""
    return re.sub(r"=[wsh]\d.*$", "=s2048", url)


def maps_url(name: str, place_id: str) -> str:
    return (
        "https://www.google.com/maps/search/?api=1&query="
        + urllib.parse.quote(name)
        + "&query_place_id="
        + place_id
    )


def parse_date(text: str):
    m = re.search(r"(?:相片|Photo)\s*[-·]\s*(\d{4})\s*年\s*(\d{1,2})\s*月", text or "")
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-01", True
    return datetime.now().strftime("%Y-%m-%d"), False


COLLECT_JS = """
(hints) => {
  const out = [];
  const seen = new Set();
  let idx = 0;
  const all = document.querySelectorAll('img, div, a, button');
  for (const el of all) {
    let url = '';
    if (el.tagName === 'IMG') url = el.currentSrc || el.src || '';
    if (!url) {
      const bg = getComputedStyle(el).backgroundImage || '';
      const m = bg.match(/url\\("?(https:[^")]+)"?\\)/);
      if (m) url = m[1];
    }
    if (!url || !/googleusercontent\\.com|ggpht\\.com/.test(url)) continue;
    if (!hints.some(h => url.includes(h))) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 60 || r.height < 60) continue;
    const key = url.replace(/=[wsh]\\d.*$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    el.setAttribute('data-pe-idx', String(idx));
    out.push({idx, url});
    idx++;
  }
  return out;
}
"""


def check_captcha(page):
    if "sorry/index" in page.url or page.locator("form#captcha-form").count() > 0:
        input("偵測到 Google 驗證碼。請在瀏覽器視窗手動完成，完成後回到這裡按 Enter 繼續...")


def open_menu_tab(page) -> bool:
    # 路線 A：總覽旁的「菜單」分頁
    for sel in (
        'button[role="tab"]:has-text("菜單")',
        '[role="tab"]:has-text("菜單")',
        'button[aria-label*="菜單"]',
        'button:has-text("菜單")',
    ):
        loc = page.locator(sel)
        if loc.count() > 0:
            loc.first.click(force=True)
            page.wait_for_timeout(2500)
            return True
    # 路線 B：瀏覽相片 → 分類「菜單」
    photo = page.locator('button:has-text("瀏覽相片")')
    if photo.count() > 0:
        photo.first.click(force=True)
        page.wait_for_timeout(5000)
        for sel in ('button:has-text("菜單")', '[role="tab"]:has-text("菜單")', '[aria-label*="菜單"]'):
            loc = page.locator(sel)
            if loc.count() > 0:
                loc.first.click(force=True)
                page.wait_for_timeout(2500)
                return True
    return False


def scrape_one(page, shop: dict, shop_dir: str) -> dict:
    page.goto(maps_url(shop["name"], shop["place_id"]) + "&hl=zh-TW", wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(random.randint(3500, 5000))
    check_captcha(page)

    name = shop["name"]
    h1 = page.locator("h1")
    if h1.count() > 0:
        t = h1.first.inner_text().strip()
        if t:
            name = t
    address = ""
    addr = page.locator('button[data-item-id="address"]')
    if addr.count() > 0:
        raw = addr.first.get_attribute("aria-label") or addr.first.inner_text()
        address = re.sub(r"^地址[:：\s]*", "", raw).strip()

    restaurant = {
        "name": name,
        "address": address,
        "lat": float(shop["lat"]),
        "lng": float(shop["lng"]),
        "google_maps_url": maps_url(shop["name"], shop["place_id"]),
    }

    if not open_menu_tab(page):
        try:
            page.screenshot(path=os.path.join(shop_dir, "debug-no-menu-tab.png"))
        except Exception:
            pass
        return {"status": "no_menu_tab", "restaurant": restaurant, "photos": []}

    cands = page.evaluate(COLLECT_JS, list(PHOTO_HINTS))[:MAX_PHOTOS]
    photos = []
    for i, c in enumerate(cands):
        date, exact = datetime.now().strftime("%Y-%m-%d"), False
        # 點開檢視器讀取拍攝年月
        try:
            page.locator(f'[data-pe-idx="{c["idx"]}"]').first.click(timeout=5000)
            page.wait_for_timeout(2000)
            date, exact = parse_date(page.inner_text("body"))
        except Exception:
            pass

        fname = f"google-maps-menu-photo-{i + 1}.jpg"
        path = os.path.join(shop_dir, fname)
        ok = False
        try:
            req = urllib.request.Request(hi_res(c["url"]), headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = resp.read()
            if len(data) > 5000:
                with open(path, "wb") as f:
                    f.write(data)
                ok = True
        except Exception:
            ok = False
        if not ok:
            fname = f"google-maps-menu-photo-{i + 1}-screenshot.png"
            page.screenshot(path=os.path.join(shop_dir, fname))
        photos.append({
            "source_image": f"google-maps-menu-photo-{i + 1}",
            "file_name": fname,
            "source_date": date,
            "has_exact_date": exact,
            "original_downloaded": ok,
        })
        try:
            page.keyboard.press("Escape")
            page.wait_for_timeout(800)
        except Exception:
            pass

    return {"status": "ok" if photos else "no_photos_found", "restaurant": restaurant, "photos": photos}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=os.path.join("data", "shops.csv"))
    ap.add_argument("--out", default="menu_dataset")
    ap.add_argument("--only", default="", help="只跑指定編號，逗號分隔，例如 12 或 01,02")
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--cdp", default="", help="連到已登入 Google 的 Chrome，例如 http://localhost:9222")
    a = ap.parse_args()

    with open(a.csv, "r", encoding="utf-8-sig") as f:
        shops = list(csv.DictReader(f))
    if a.only:
        want = {x.strip().zfill(2) for x in a.only.split(",")}
        shops = [s for s in shops if s["id"].zfill(2) in want]
    if not shops:
        print("沒有符合的店家")
        sys.exit(1)

    os.makedirs(a.out, exist_ok=True)
    profile = os.path.join(a.out, ".browser_profile")
    with sync_playwright() as p:
        if a.cdp:
            browser = p.chromium.connect_over_cdp(a.cdp)
            ctx = browser.contexts[0]
            page = ctx.new_page()
        else:
            ctx = p.chromium.launch_persistent_context(
                profile, headless=a.headless, viewport={"width": 1280, "height": 900}, locale="zh-TW"
            )
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
        for s in shops:
            sdir = os.path.join(a.out, f"{s['id']}_{s['place_id']}")
            meta = os.path.join(sdir, "metadata.json")
            done = False
            if os.path.exists(meta):
                try:
                    done = json.load(open(meta, encoding="utf-8")).get("status") == "ok"
                except Exception:
                    done = False
            if done:
                print(f"[跳過] {s['id']} {s['name']}（已完成）")
                continue
            os.makedirs(sdir, exist_ok=True)
            print(f"[處理中] {s['id']} {s['name']} ...")
            result = {"status": "error", "photos": []}
            for attempt in range(2):
                try:
                    result = scrape_one(page, s, sdir)
                    if result["status"] == "ok":
                        break
                except Exception as e:  # noqa: BLE001
                    result = {"status": "error", "error_msg": str(e), "photos": []}
                time.sleep(3)
            with open(meta, "w", encoding="utf-8") as mf:
                json.dump(result, mf, ensure_ascii=False, indent=2)
            print(f"  -> {result['status']}，照片 {len(result.get('photos', []))} 張")
            time.sleep(random.uniform(5.0, 9.0))
        if not a.cdp:
            ctx.close()
    print("完成。")


if __name__ == "__main__":
    main()
