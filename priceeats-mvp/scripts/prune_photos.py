"""刪除「已匯入」店家的菜單照片，只動 menu_dataset/<店號>_*/ 底下的圖片檔。

用法：
  python3 scripts/prune_photos.py --ids 101,102,103        # 指定店號
  python3 scripts/prune_photos.py --all-imported           # state 記錄為已匯入的所有店
  加 --dry-run 只列出會刪的檔數與容量，不刪

「已匯入」＝ data/pipeline-state.json 記錄該店匯入成功（status=imported）且 data/menus-maps2/<店號>.json 存在。
不符的店號一律略過（即使在 --ids 裡）。

永不刪除：metadata.json、任何非圖片檔、data/ocr-raw、data/menus-maps2（本程式只走 menu_dataset 內的店家資料夾）。
保留樣本：店號為數字且 % 20 == 0 的店（--keep-mod 可調，0 = 不保留）。
輸出：刪除檔數與 GB（1 GB = 1024^3 位元組）。
"""
import argparse
import glob
import json
import os
import sys

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".bmp", ".tif", ".tiff"}
GB = 1024 ** 3


def imported_ids(state_path, maps2_dir):
    """state 記錄匯入成功、且 maps2 檔存在的店號集合。"""
    try:
        st = json.load(open(state_path, encoding="utf-8"))
    except Exception:
        return set()
    ids = set()
    for area in st.get("areas", {}).values():
        for sid, rec in area.get("shops", {}).items():
            if rec.get("status") == "imported" and os.path.isfile(os.path.join(maps2_dir, f"{sid}.json")):
                ids.add(sid)
    return ids


def is_sample(sid, keep_mod):
    return keep_mod > 0 and sid.isdigit() and int(sid) % keep_mod == 0


def shop_dirs(dataset, sid):
    real_ds = os.path.realpath(dataset)
    out = []
    for d in sorted(glob.glob(os.path.join(dataset, f"{sid}_*"))):
        if os.path.isdir(d) and not os.path.islink(d) and os.path.realpath(d).startswith(real_ds + os.sep):
            out.append(d)
    return out


def image_files(d):
    files = []
    for root, _dirs, names in os.walk(d, followlinks=False):
        for n in names:
            p = os.path.join(root, n)
            if n == "metadata.json" or os.path.islink(p):
                continue
            if os.path.splitext(n)[1].lower() in IMG_EXT:
                files.append(p)
    return files


def prune(ids, state_path, dataset, maps2_dir, keep_mod=20, dry_run=False, assume_imported=False):
    """回傳統計 dict。assume_imported 只給 pipeline --dry-run 預估用（不會刪檔）。"""
    ok_ids = imported_ids(state_path, maps2_dir)
    res = {"deleted_files": 0, "deleted_bytes": 0, "kept_sample_shops": [], "skipped_not_imported": [], "shops": [], "dry_run": dry_run}
    if assume_imported and not dry_run:
        raise ValueError("assume_imported 只能搭配 dry_run")
    for sid in ids:
        if not (sid in ok_ids or assume_imported):
            res["skipped_not_imported"].append(sid)
            continue
        if is_sample(sid, keep_mod):
            res["kept_sample_shops"].append(sid)
            continue
        n = b = 0
        for d in shop_dirs(dataset, sid):
            for f in image_files(d):
                size = os.path.getsize(f)
                if not dry_run:
                    os.remove(f)
                n += 1
                b += size
        res["deleted_files"] += n
        res["deleted_bytes"] += b
        res["shops"].append(sid)
    res["deleted_gb"] = round(res["deleted_bytes"] / GB, 4)
    return res


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--ids", help="店號，逗號分隔")
    g.add_argument("--all-imported", action="store_true")
    ap.add_argument("--state", default=os.path.join("data", "pipeline-state.json"))
    ap.add_argument("--dataset", default="menu_dataset")
    ap.add_argument("--maps2", default=os.path.join("data", "menus-maps2"))
    ap.add_argument("--keep-mod", type=int, default=20)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--assume-imported", action="store_true", help="（僅預估）--dry-run 時把指定店號視為已匯入")
    ap.add_argument("--json", action="store_true", help="最後多印一行 JSON 統計")
    a = ap.parse_args(argv)
    ids = sorted(imported_ids(a.state, a.maps2)) if a.all_imported else [x.strip() for x in a.ids.split(",") if x.strip()]
    if a.assume_imported and not a.dry_run:
        ap.error("--assume-imported 必須搭配 --dry-run")
    r = prune(ids, a.state, a.dataset, a.maps2, a.keep_mod, a.dry_run, a.assume_imported)
    tag = "（預演，未刪）" if a.dry_run else ""
    print(f"{'將刪除' if a.dry_run else '刪除'} {r['deleted_files']} 個圖片檔，{r['deleted_gb']:.2f} GB；"
          f"涉及 {len(r['shops'])} 家，保留樣本 {len(r['kept_sample_shops'])} 家，略過未匯入 {len(r['skipped_not_imported'])} 家{tag}")
    if a.json:
        print(json.dumps(r, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
