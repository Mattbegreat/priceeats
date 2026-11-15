"""店名清理預覽：只讀 data/shops.csv，列出新舊 clean_name 結果不同的店，寫到 data/name-clean-preview.md。
不連資料庫、不寫 DB；實際更新店名另案，需 Matt 同意。
用法：python3 scripts/name_clean_preview.py
"""
import csv, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_from_ocr import KW, clean_name  # noqa: E402


def old_clean_name(s):
    """舊規則（目前 DB 內店名的來源），僅供比對。"""
    o = s
    s = re.split(r"\s*[|｜《【]\s*", s)[0]
    s = re.sub(r"\s*[(（][^()（）]*" + KW + r"[^()（）]*[)）]?.*$", "", s)
    s = re.split(r"\s*[/／]\s*(?=.*" + KW + ")", s)[0]
    s = re.sub(r"\s*-\s*\S*" + KW + r".*$", "", s)
    s = re.sub(r"\s+\S*" + KW + r"\S*(/\S*)*$", "", s) if "/" in s else s
    s = s.replace("·開啟過的連結", "").strip(" -”。\"|/")
    return s if len(s) >= 2 else o


def esc(t):
    return t.replace("|", "\\|")


def main():
    rows = list(csv.DictReader(open("data/shops.csv", encoding="utf-8-sig")))
    changed = []
    for r in rows:
        raw = r["name"]
        old, new = old_clean_name(raw), clean_name(raw)
        if old != new:
            changed.append((r["id"], raw, old, new))
    out = [
        "# 店名清理預覽（未寫入資料庫）",
        "",
        f"店家總數 {len(rows)}；新規則改變結果 {len(changed)} 家。",
        "「目前名稱」是舊 clean_name 的輸出（即目前匯入資料庫的名字）。",
        "",
        "| 編號 | 原始名稱 | 目前名稱 | 新規則名稱 |",
        "| --- | --- | --- | --- |",
    ]
    for i, raw, old, new in changed:
        out.append(f"| {i} | {esc(raw)} | {esc(old)} | {esc(new)} |")
    still = [(r["id"], clean_name(r["name"])) for r in rows if re.search(KW, clean_name(r["name"]))]
    out += ["", f"## 清理後仍含促銷關鍵字（需人工判斷，{len(still)} 家）", ""]
    out += [f"- {i} {esc(n)}" for i, n in still]
    open("data/name-clean-preview.md", "w", encoding="utf-8").write("\n".join(out) + "\n")
    print(f"店家 {len(rows)}，受影響 {len(changed)}，仍含關鍵字 {len(still)} → data/name-clean-preview.md")


if __name__ == "__main__":
    main()
