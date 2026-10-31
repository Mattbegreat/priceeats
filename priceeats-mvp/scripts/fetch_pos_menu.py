#!/usr/bin/env python3
"""抓 iCHEF 線上點餐頁的店內價，輸出 data/menus-pos/<slug>.json（匯入格式同 data/menus/*.json，加 "source": "pos_online"）。

用法：
  python3 scripts/fetch_pos_menu.py <點餐網址> [<點餐網址> ...]
  python3 scripts/fetch_pos_menu.py --csv data/pos_shops.csv      # 欄位：id,url

規則：
  - 只收能對應 8 類的品項；飲料、甜點、冰品、加購選項、NT$0 品項略過；對應不到的不收，列在報告。
  - 價格只取頁面上看到的數字；confidence 固定 0.95。
  - lat、lng 不填也不猜；缺座標的店列在報告，由人工補。
  - 每頁之間至少間隔 5 秒。
"""
import argparse
import csv
import json
import re
import sys
import time
from datetime import date
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "menus-pos"
PAGE_GAP_SECONDS = 6
CONFIDENCE = 0.95

# ---------------------------------------------------------------
# 對應規則：先看品名關鍵字（略過 → 分類），再看分類標題，都對不到就不收
# ---------------------------------------------------------------
# 品項層級略過：飲料、甜點、冰品、加購
SKIP_ITEM_KEYWORDS = [
    ("飲料", ["茶", "汁", "奶", "咖啡", "可樂", "汽水", "沙士", "氣泡", "豆漿", "飲", "冰沙", "拿鐵", "撞", "仙草蜜"]),
    ("甜點冰品", ["冰", "豆花", "仙草", "紅豆湯", "綠豆湯", "花生湯", "芋圓", "湯圓", "布丁", "蛋糕", "甜點", "圓仔"]),
    ("加購選項", ["加購", "加點", "加料", "加飯", "加麵", "加蛋", "加配料", "升級", "配料", "餐具", "提袋", "塑膠袋", "白飯("]),
]
# 分類標題層級略過
SKIP_SECTION_KEYWORDS = [
    ("飲料", ["飲", "茶", "果汁", "咖啡", "牛奶", "豆漿"]),
    ("甜點冰品", ["冰", "豆花", "甜", "點心", "湯圓", "布丁", "蛋糕"]),
    ("加購選項", ["加購", "加點", "加料", "配料", "升級", "選項", "加價"]),
    ("醬料", ["醬料"]),
]
# 品名關鍵字 → 分類（依序比對，先中先用）
ITEM_RULES = [
    ("便當", ["便當", "餐盒", "套餐"]),
    ("自助餐", ["自助餐"]),
    ("早餐", ["蛋餅", "吐司", "漢堡", "飯糰", "三明治", "鐵板麵", "貝果", "燒餅", "油條", "蘿蔔糕"]),
    ("麵食", ["麵", "米粉", "米苔目", "粄條", "河粉", "水餃", "餛飩", "餃", "冬粉", "烏龍", "拉麵", "刀削"]),
    ("飯類", ["飯", "粥", "燴", "焗烤", "丼", "咖哩"]),
    ("小吃", ["煎", "臭豆腐", "肉圓", "湯", "羹", "碗粿", "米糕", "粿", "春捲", "蚵嗲"]),  # 先於海鮮／肉類：蚵仔煎、豬血湯屬小吃
    ("海鮮", ["蝦", "魚", "蚵", "蛤", "蟹", "花枝", "魷魚", "海鮮", "干貝", "牡蠣"]),
    ("肉類", ["排骨", "雞", "豬", "牛", "羊", "鴨", "鵝", "肉", "香腸", "培根", "火腿", "滷味"]),
    ("小吃", ["炸", "豆干", "小菜", "油豆腐", "甜不辣"]),
]
# 分類標題優先：炸物單點一律小吃（前端配菜規則會再處理），不看品名
SECTION_FIRST_RULES = [("小吃", ["炸物"])]
# 分類標題 → 分類（品名對不到時的後備）
SECTION_RULES = [
    ("便當", ["便當", "餐盒"]),
    ("自助餐", ["自助餐"]),
    ("早餐", ["早餐", "早點"]),
    ("麵食", ["麵", "粉", "餃"]),
    ("飯類", ["飯", "粥", "丼"]),
    ("海鮮", ["海鮮"]),
    ("肉類", ["肉", "排餐"]),
    ("小吃", ["小吃", "湯品", "點心", "小菜", "熱炒", "單點"]),
]
# 附加標籤（category 之外的特徵；不影響主分類）
TAG_RULES = [
    ("海鮮", ["蝦", "魚", "蚵", "蛤", "蟹", "花枝", "魷魚", "海鮮", "干貝", "牡蠣"]),
    ("肉類", ["排骨", "雞", "豬肉", "牛", "羊", "鴨", "鵝", "滷肉", "香腸", "培根"]),
]

# 提示行（不是品名）：售完、開賣時間、外送提醒
NOISE_RE = re.compile(r"^(售完|Sold out|Available from|.*開始供應$|需外送請致電)")
MENU_MARKERS = ("Menu", "菜單")

PRICE_RE = re.compile(r"^NT\$\s*([\d,]+)$")


def first_hit(rules, text):
    for label, kws in rules:
        for kw in kws:
            if kw in text:
                return label
    return None


def map_item(name, section):
    """回傳 (category, None) 或 (None, 略過／不收原因)"""
    reason = first_hit(SKIP_SECTION_KEYWORDS, section)
    if reason:
        return None, f"略過：{reason}（分類標題「{section}」）"
    reason = first_hit(SKIP_ITEM_KEYWORDS, name)
    if reason:
        return None, f"略過：{reason}"
    cat = first_hit(SECTION_FIRST_RULES, section) or first_hit(ITEM_RULES, name) or first_hit(SECTION_RULES, section)
    if not cat:
        return None, "對應不到 8 類"
    return cat, None


def slugify(shop_id):
    s = re.sub(r"[^0-9A-Za-z]+", "", shop_id)
    return f"pos-{s}" if s else "pos-unknown"


def shop_id_from_url(url):
    m = re.search(r"/store/([^/?#]+)", url)
    return m.group(1) if m else url


def parse_body(text):
    """從 body inner_text 取出 [(分類標題, 品名, 價格)]；頁面最前面的分頁列（標題清單）先收集，之後同名行視為標題"""
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    start = next((i for i, l in enumerate(lines) if l in MENU_MARKERS), -1) + 1
    tabs = []  # 分頁列：到第一個重複出現的行為止（該行是第一個分類標題）
    for l in lines[start:]:
        if l in tabs:
            break
        tabs.append(l)
    body_start = start + len(tabs)
    tabset = set(tabs)
    out, section, buf = [], "", []
    for l in lines[body_start:]:
        if l.startswith("Powered by"):
            break
        if l in tabset and not buf:
            section = l
            continue
        if NOISE_RE.match(l):
            continue
        m = PRICE_RE.match(l)
        if m:
            if buf:
                out.append((section, buf[0], int(m.group(1).replace(",", ""))))
            buf = []
            continue
        if l in tabset:  # 沒有價格的殘行後遇到下一個標題
            section, buf = l, []
            continue
        buf.append(l)
    return tabs, out


def fetch(page, url):
    info = {}

    def on_response(resp):
        if "restaurantInformationQuery" in resp.url or "restaurantInformationQuery" in (resp.request.post_data or ""):
            try:
                node = resp.json()["data"]["restaurant"]["onlineRestaurantInformation"]
                info["name"], info["address"] = node.get("name"), node.get("address")
            except Exception:
                pass

    page.on("response", on_response)
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_timeout(15000)
    for _ in range(8):
        page.mouse.wheel(0, 1500)
        page.wait_for_timeout(1000)
    text = page.inner_text("body")
    page.remove_listener("response", on_response)
    return info, text


def build(url, info, text):
    tabs, raw = parse_body(text)
    first = next((l.strip() for l in text.splitlines() if l.strip()), "")
    name = info.get("name") or first
    items, skipped = [], []
    seen = set()
    for section, item, price in raw:
        if price <= 0:
            skipped.append((section, item, price, "略過：NT$0 品項"))
            continue
        cat, reason = map_item(item, section)
        if not cat:
            skipped.append((section, item, price, reason))
            continue
        if item in seen:
            skipped.append((section, item, price, "略過：品名重複"))
            continue
        seen.add(item)
        tags = [t for t in [first_hit([r], item.replace("雞蛋", "")) for r in TAG_RULES] if t and t != cat]
        items.append({"name": item, "price": price, "category": cat, "tags": tags, "confidence": CONFIDENCE})
    data = {
        "restaurant": {"name": name, "address": info.get("address") or ""},
        "source_date": date.today().isoformat(),
        "source_image": url,
        "source": "pos_online",
        "items": items,
    }
    return data, tabs, raw, skipped


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("urls", nargs="*", help="iCHEF 點餐網址")
    ap.add_argument("--csv", help="CSV（id,url）")
    args = ap.parse_args()

    urls = list(args.urls)
    if args.csv:
        with open(args.csv, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("url"):
                    urls.append(row["url"].strip())
    if not urls:
        ap.error("請給點餐網址或 --csv")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    no_coords = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for i, url in enumerate(urls):
            if i > 0:
                time.sleep(PAGE_GAP_SECONDS)
            page = browser.new_context(locale="zh-TW").new_page()
            try:
                info, text = fetch(page, url)
            except Exception as e:  # noqa: BLE001
                print(f"[失敗] {url}：{e}", file=sys.stderr)
                continue
            finally:
                page.close()
            data, tabs, raw, skipped = build(url, info, text)
            if not data["items"]:
                print(f"[無品項] {url}：頁面上抓不到可收錄品項（分類：{tabs}）", file=sys.stderr)
                continue
            out = OUT_DIR / f"{slugify(shop_id_from_url(url))}.json"
            out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            by_reason = {}
            for _, _, _, r in skipped:
                by_reason[r] = by_reason.get(r, 0) + 1
            print(f"== {data['restaurant']['name']} -> {out.relative_to(ROOT)}")
            print(f"頁面品項 {len(raw)}、收錄 {len(data['items'])}、略過／不收 {len(skipped)}")
            for r, n in sorted(by_reason.items()):
                print(f"  {n:>3}  {r}")
            unmapped = [f"{s}/{n}" for s, n, _, r in skipped if r == "對應不到 8 類"]
            if unmapped:
                print(f"  對應不到：{'、'.join(unmapped)}")
            no_coords.append((data["restaurant"]["name"], data["restaurant"]["address"] or "（抓不到地址）"))
        browser.close()
    print("== 缺座標（lat、lng 未填，需人工補）")
    for n, a in no_coords:
        print(f"  {n}｜{a}")


if __name__ == "__main__":
    main()
