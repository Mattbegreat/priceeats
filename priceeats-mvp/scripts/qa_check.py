"""資料品質檢查：掃描所有待匯入／已匯入的菜單 JSON，列出可疑項目（不自動改）。

用法：python3 scripts/qa_check.py [資料夾 ...]   預設掃 data/menus*、輸出 data/qa-report.md
"""
import collections, glob, json, os, re, sys

DRINK = re.compile(r"(紅茶|綠茶|青茶|烏龍|奶茶|拿鐵|咖啡|美式咖啡|卡布|果汁|奶昔|可樂$|可樂（|雪碧|汽水|豆漿|米漿|冬瓜(茶|露)|檸檬(茶|汁|水|飲|愛玉)|養樂多|鮮奶$|牛奶$|飲料|啤酒|清酒|調酒|沙瓦|氣泡飲)")
ADDON = re.compile(r"^(加|\+)|(加蛋|加起司|加料|醬料|醬汁)$")
JUNK_NAME = re.compile(r"(\||開啟過的連結|推薦|必吃|首選|外送|外帶餐盒|----)")

def load(paths):
    for p in paths:
        for f in sorted(glob.glob(os.path.join(p, "*.json"))):
            try:
                yield f, json.load(open(f, encoding="utf-8"))
            except Exception as e:
                yield f, {"_error": str(e)}

def main():
    dirs = sys.argv[1:] or sorted(d for d in glob.glob("data/menus*") if os.path.isdir(d) and "hold" not in d and "maps3" not in d)
    rows = collections.defaultdict(list)
    stores = 0; items = 0
    for f, d in load(dirs):
        if "_error" in d:
            rows["JSON 壞檔"].append(f"{f}：{d['_error']}"); continue
        stores += 1
        name = d["restaurant"]["name"]; tag = f"{os.path.basename(os.path.dirname(f))}/{os.path.basename(f)} {name}"
        its = d.get("items", []); items += len(its)
        if JUNK_NAME.search(name): rows["店名有雜字"].append(tag)
        if len(its) < 3: rows["餐點少於 3 道"].append(f"{tag}（{len(its)}）")
        if len(its) > 150: rows["餐點超過 150 道（可能重複或含飲料）"].append(f"{tag}（{len(its)}）")
        if d.get("source_date", "9") < "2025-01-01": rows["資料日期早於 2025"].append(f"{tag}（{d.get('source_date')}）")
        c = collections.Counter(i["name"] for i in its)
        dups = [n for n, k in c.items() if k > 1]
        if dups: rows["同店同名重複"].append(f"{tag}：{'、'.join(dups[:5])}")
        for i in its:
            n, p = i["name"], i["price"]
            if DRINK.search(n): rows["疑似飲料（規則不收）"].append(f"{tag}：{n} {p}")
            elif ADDON.search(n): rows["疑似加料"].append(f"{tag}：{n} {p}")
            if p >= 500: rows["價格 ≥500（確認是否為多人份）"].append(f"{tag}：{n} {p}")
            if p < 10: rows["價格 <10"].append(f"{tag}：{n} {p}")
    out = [f"# 資料品質報告", "", f"店家 {stores}、餐點 {items}", ""]
    out += [f"| 項目 | 筆數 |", "|---|---|"] + [f"| {k} | {len(v)} |" for k, v in rows.items()] + [""]
    for k, v in rows.items():
        out += [f"## {k}（{len(v)}）"] + [f"- {x}" for x in v[:200]] + [""]
    open("data/qa-report.md", "w", encoding="utf-8").write("\n".join(out))
    print("\n".join(out[:4 + 2 + len(rows)]))
    print("完整清單：data/qa-report.md")

if __name__ == "__main__":
    main()
