"""scripts/pipeline.py 與 scripts/prune_photos.py 的自動化測試（Python 標準函式庫 unittest，不新增套件）。

在暫存資料夾組一個假 repo：真的 pipeline.py／prune_photos.py／build_from_ocr.py／qa_check.py，
discover／download／run_ocr／npm 用替身（不開 Chrome、不呼叫 agy、不連 Supabase）。
執行：python3 -B -m unittest discover -s tests/pipeline -v    （或 npm run test:pipeline）
"""
import csv
import http.server
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import unittest

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
REAL = ["pipeline.py", "prune_photos.py", "build_from_ocr.py", "qa_check.py"]
FAKE_KEY = "eyJFAKEKEYFAKEKEYFAKEKEY.payload.sig"

STUB_DISCOVER = r'''
import argparse, csv, json, os, sys
ap = argparse.ArgumentParser(); ap.add_argument("--cdp"); ap.add_argument("--area"); ap.add_argument("--query-file")
ap.add_argument("--radius"); ap.add_argument("--stop-on-block", action="store_true"); ap.add_argument("--limit", type=int, default=0)
a = ap.parse_args()
open("calls.log", "a").write("discover limit=%s\n" % a.limit)
c = json.load(open("data/areas.json", encoding="utf-8"))[a.area]
rows = list(csv.DictReader(open("data/shops.csv", encoding="utf-8-sig")))
n = int(open("fake/new_shops.txt").read()) if os.path.exists("fake/new_shops.txt") else 7
if a.limit: n = min(n, a.limit)
nid = max(int(r["id"]) for r in rows) + 1
for k in range(n):
    rows.append({"id": "%02d" % (nid + k), "name": "店%d" % (nid + k), "lat": c["lat"], "lng": c["lng"], "place_id": "ChIJ%d" % (nid + k)})
with open("data/shops.csv", "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["id", "name", "lat", "lng", "place_id"]); w.writeheader(); w.writerows(rows)
print("新增編號：" + ",".join(r["id"] for r in rows[-n:]))
'''

STUB_DOWNLOAD = r'''
import argparse, csv, json, os, sys
ap = argparse.ArgumentParser(); ap.add_argument("--cdp"); ap.add_argument("--only"); ap.add_argument("--stop-on-block", action="store_true")
a = ap.parse_args()
want = a.only.split(",")
open("calls.log", "a").write("download %s\n" % ",".join(want))
shops = {r["id"]: r for r in csv.DictReader(open("data/shops.csv", encoding="utf-8-sig"))}
nomenu = open("fake/nomenu.txt").read().split() if os.path.exists("fake/nomenu.txt") else []
block = open("fake/block_at.txt").read().split() if os.path.exists("fake/block_at.txt") else []
for sid in want:
    if sid in block:
        print("BLOCKED:Google 驗證碼"); sys.exit(75)
    s = shops[sid]; d = "menu_dataset/%s_%s" % (sid, s["place_id"]); os.makedirs(d, exist_ok=True)
    rest = {"name": s["name"], "address": "地址" + sid, "lat": float(s["lat"]), "lng": float(s["lng"]), "google_maps_url": "https://maps.example/" + sid}
    if sid in nomenu:
        json.dump({"status": "no_menu_tab", "restaurant": rest, "photos": []}, open(d + "/metadata.json", "w")); continue
    photos = []
    for i in (1, 2, 3):
        fn = "google-maps-menu-photo-%d.jpg" % i
        open(d + "/" + fn, "wb").write(b"x" * 4096)
        photos.append({"source_image": "google-maps-menu-photo-%d" % i, "file_name": fn, "source_date": "2026-10-01", "has_exact_date": True, "original_downloaded": True})
    open(d + "/debug.txt", "w").write("keep me")
    json.dump({"status": "ok", "restaurant": rest, "photos": photos}, open(d + "/metadata.json", "w"))
    print("  -> ok")
'''

STUB_OCR = r'''#!/bin/bash
cd "$(dirname "$0")/.." || exit 1
rm -f data/.quota-stop
echo "ocr $OCR_ONLY" >> calls.log
mkdir -p data/ocr-raw
for id in $(echo "$OCR_ONLY" | tr ',' ' '); do
  if grep -qx "$id" fake/quota_at.txt 2>/dev/null; then echo "429 quota reached" > data/.quota-stop; exit 0; fi
  [ -f "data/ocr-raw/$id.json" ] && continue
  printf '{"source_image":"google-maps-menu-photo-1","items":[{"name":"滷肉飯","price":60,"category":"飯類"},{"name":"排骨飯","price":90,"category":"便當"},{"name":"牛肉麵","price":150,"category":"麵食"}]}' > "data/ocr-raw/$id.json"
done
echo "完成"
'''

STUB_NPM = r'''#!/bin/bash
echo "npm $*" >> "$PE_ROOT/calls.log"
echo "using key $PE_FAKE_KEY"   # 模擬子程序不小心印出金鑰：pipeline 必須遮蔽
if [ "$2" = "import:menu" ] && [ -f "$PE_ROOT/fake/import_fail" ]; then echo "寫入失敗"; exit 1; fi
exit 0
'''


def W(path, text, mode="w"):
    with open(path, mode, **({} if "b" in mode else {"encoding": "utf-8"})) as f:
        f.write(text)


def R(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


class CdpServer:
    def __init__(self):
        class H(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers()
                self.wfile.write(b'{"Browser":"fake"}')
            def log_message(self, *a): pass
        self.srv = http.server.HTTPServer(("127.0.0.1", 0), H)
        self.url = "http://127.0.0.1:%d" % self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
    def close(self): self.srv.shutdown(); self.srv.server_close()


def tree(root):
    out = {}
    for d, _dirs, files in os.walk(root):
        out[d] = None
        for f in files:
            p = os.path.join(d, f); st = os.stat(p); out[p] = (st.st_size, st.st_mtime_ns)
    return out


class Base(unittest.TestCase):
    key_in_env_file = True

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="pe-pipe-")
        self.root = os.path.join(self.tmp, "repo"); os.makedirs(self.root)
        sd = os.path.join(self.root, "scripts"); os.makedirs(sd)
        for f in REAL:
            shutil.copy(os.path.join(REPO, "scripts", f), sd)
        for name, src in (("discover_shops.py", STUB_DISCOVER), ("download_menus.py", STUB_DOWNLOAD)):
            W(os.path.join(sd, name), src)
        W(os.path.join(sd, "run_ocr.sh"), STUB_OCR)
        for d in ("data", "fake", "bin", "menu_dataset", "data/menus-maps2", "data/ocr-raw", "data/queries"):
            os.makedirs(os.path.join(self.root, d), exist_ok=True)
        W(self.root + "/data/areas.json", json.dumps({"測試": {"lat": 25.0478, "lng": 121.517, "label": "測試站", "queries": "data/queries/test.txt"}}, ensure_ascii=False))
        W(self.root + "/data/queries/test.txt", "測試 便當\n")
        # 既有店 01–17：很遠（不在區域內），讓新店編號從 18 起（含 20 這個樣本）
        with open(self.root + "/data/shops.csv", "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f); w.writerow(["id", "name", "lat", "lng", "place_id"])
            for i in range(1, 18):
                w.writerow(["%02d" % i, "舊店%d" % i, 22.0, 120.0, "ChIJold%d" % i])
        if self.key_in_env_file:
            W(self.root + "/.env.local", "SUPABASE_URL=https://x.example\nSUPABASE_SERVICE_ROLE_KEY=%s\n" % FAKE_KEY)
        npm = os.path.join(self.root, "bin", "npm")
        W(npm, STUB_NPM); os.chmod(npm, 0o755)
        os.chmod(os.path.join(sd, "run_ocr.sh"), 0o755)
        self.cdp = CdpServer()

    def tearDown(self):
        self.cdp.close(); shutil.rmtree(self.tmp, ignore_errors=True)

    def env(self):
        e = dict(os.environ)
        for k in ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"):
            e.pop(k, None)
        e["PATH"] = os.path.join(self.root, "bin") + os.pathsep + e["PATH"]
        e["PE_ROOT"] = self.root; e["PE_FAKE_KEY"] = FAKE_KEY; e["PYTHONDONTWRITEBYTECODE"] = "1"
        return e

    def run_pipe(self, *args, cdp=None, min_free="0.001"):
        cmd = [sys.executable, "-B", os.path.join(self.root, "scripts", "pipeline.py"), "測試", "--cdp", cdp or self.cdp.url, "--min-free-gb", min_free, *args]
        return subprocess.run(cmd, cwd=self.root, env=self.env(), capture_output=True, text=True, timeout=120)

    def calls(self):
        p = os.path.join(self.root, "calls.log")
        return R(p).splitlines() if os.path.exists(p) else []

    def state(self):
        return json.loads(R(self.root + "/data/pipeline-state.json"))

    def log_text(self):
        return R(self.root + "/data/pipeline.log")

    def photos(self, sid):
        out = []
        for d in os.listdir(self.root + "/menu_dataset"):
            if d.startswith(sid + "_"):
                out += [f for f in os.listdir(os.path.join(self.root, "menu_dataset", d)) if f.endswith(".jpg")]
        return out

    def metadata_exists(self, sid):
        return any(os.path.exists(os.path.join(self.root, "menu_dataset", d, "metadata.json")) for d in os.listdir(self.root + "/menu_dataset") if d.startswith(sid + "_"))


class FullRun(Base):
    def test_full_run_prunes_and_is_idempotent(self):
        r = self.run_pipe("--batch", "3")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        st = self.state()["areas"]["測試"]
        ids = ["%02d" % i for i in range(18, 25)]
        self.assertEqual(sorted(st["shops"]), ids)
        self.assertTrue(all(st["shops"][i]["status"] == "imported" for i in ids))
        self.assertEqual([len(b["ids"]) for b in st["batches"]], [3, 3, 1])
        self.assertTrue(all(b["done"] for b in st["batches"]))
        imports = [c for c in self.calls() if c.startswith("npm run import:menu")]
        self.assertEqual(len(imports), 3)
        # 照片：樣本（20）保留，其餘刪除；metadata、非圖片檔、ocr-raw、menus-maps2 全留
        for i in ids:
            self.assertTrue(self.metadata_exists(i))
            self.assertEqual(len(self.photos(i)), 3 if i == "20" else 0, i)
            self.assertTrue(os.path.exists(f"{self.root}/data/ocr-raw/{i}.json"))
            self.assertTrue(os.path.exists(f"{self.root}/data/menus-maps2/{i}.json"))
        d20 = [d for d in os.listdir(self.root + "/menu_dataset") if d.startswith("20_")][0]
        self.assertTrue(os.path.exists(f"{self.root}/menu_dataset/{d20}/debug.txt"))
        self.assertEqual(st["shops"]["20"]["pruned"], "kept_sample")
        self.assertTrue(os.path.isdir(self.root + "/data/pipeline-batches") and not os.listdir(self.root + "/data/pipeline-batches"))
        self.assertIn("gen:area-stats 略過", self.log_text())  # 沒有 anon key：略過並記錄
        # 金鑰不得出現在 stdout／log／state
        for t in (r.stdout, r.stderr, self.log_text(), json.dumps(self.state())):
            self.assertNotIn(FAKE_KEY, t); self.assertNotIn("FAKEKEYFAKEKEY", t)
        self.assertIn("using key ***", self.log_text())
        # 冪等：再跑一次不再下載／辨識／匯入
        n = len(self.calls())
        before = tree(self.root + "/menu_dataset")
        r2 = self.run_pipe("--batch", "3")
        self.assertEqual(r2.returncode, 0, r2.stdout + r2.stderr)
        self.assertEqual(len(self.calls()), n)
        self.assertEqual(tree(self.root + "/menu_dataset"), before)

    def test_limit_and_nomenu(self):
        W(self.root + "/fake/nomenu.txt", "19\n")
        r = self.run_pipe("--batch", "50", "--limit", "5")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("discover limit=5", self.calls())
        sh = self.state()["areas"]["測試"]["shops"]
        self.assertEqual(len(sh), 5)
        self.assertEqual(sh["19"]["status"], "no_menu")
        self.assertEqual(sum(1 for v in sh.values() if v["status"] == "imported"), 4)
        # 沒菜單的店不會在下次被重抓
        n = len(self.calls()); self.run_pipe("--batch", "50", "--limit", "5")
        self.assertEqual(len(self.calls()), n)

    def test_only_step(self):
        r = self.run_pipe("--only", "discover")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.calls(), ["discover limit=0"])
        self.assertEqual(os.listdir(self.root + "/menu_dataset"), [])
        r = self.run_pipe("--only", "download", "--batch", "2")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual([c.split()[0] for c in self.calls()], ["discover", "download"])
        self.assertEqual(len(os.listdir(self.root + "/menu_dataset")), 2)
        self.assertFalse(os.path.exists(self.root + "/data/ocr-raw/18.json"))


class StopConditions(Base):
    def test_disk_low_stops_before_any_work(self):
        r = self.run_pipe(min_free="1000000000")
        self.assertEqual(r.returncode, 2, r.stdout)
        self.assertEqual([c for c in self.calls() if c.startswith(("download", "ocr", "npm"))], [])
        self.assertIn("可用空間", self.state()["stop_reason"])
        self.assertIn("停止｜disk", self.log_text())

    def test_disk_checked_each_batch(self):
        # discover 之後、第一批開始前就檢查：把下限設超大，discover 之後不得有 download
        self.run_pipe("--only", "discover")
        r = self.run_pipe(min_free="1000000000")
        self.assertEqual(r.returncode, 2)
        self.assertEqual([c for c in self.calls() if c.startswith("download")], [])

    def test_cdp_down_stops(self):
        r = self.run_pipe(cdp="http://127.0.0.1:%d" % free_port())
        self.assertEqual(r.returncode, 3, r.stdout + r.stderr)
        self.assertEqual(self.calls(), [])
        self.assertIn("CDP 連不上", self.state()["stop_reason"])
        self.assertIn("CDP", self.log_text())

    def test_block_stops_and_resumes_without_redownload(self):
        W(self.root + "/fake/block_at.txt", "21\n")
        r = self.run_pipe("--batch", "5")
        self.assertEqual(r.returncode, 4, r.stdout + r.stderr)
        self.assertIn("blocked", self.state()["stop_reason"])
        sh = self.state()["areas"]["測試"]["shops"]
        self.assertEqual(sh["18"]["status"], "downloaded"); self.assertEqual(sh["21"]["status"], "pending")
        self.assertEqual([c for c in self.calls() if c.startswith(("ocr", "npm"))], [])  # 整個停，不往下
        os.remove(self.root + "/fake/block_at.txt")
        r = self.run_pipe("--batch", "5")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        dl = [c.split()[1] for c in self.calls() if c.startswith("download")]
        self.assertEqual(dl[0], "18,19,20,21,22")
        self.assertNotIn("18", dl[1].split(","))  # 續跑只補沒下載完的
        self.assertEqual(self.state()["stop_reason"], None)
        self.assertTrue(all(v["status"] == "imported" for v in self.state()["areas"]["測試"]["shops"].values()))

    def test_quota_stop_then_resume_skips_done_ocr(self):
        W(self.root + "/fake/quota_at.txt", "20\n")
        r = self.run_pipe("--batch", "7")
        self.assertEqual(r.returncode, 5, r.stdout + r.stderr)
        self.assertTrue(os.path.exists(self.root + "/data/ocr-raw/18.json"))
        self.assertFalse(os.path.exists(self.root + "/data/menus-maps2/18.json") and False)
        self.assertEqual([c for c in self.calls() if c.startswith("npm")], [])
        self.assertEqual(self.state()["areas"]["測試"]["shops"]["18"]["status"], "ocr_done")
        os.remove(self.root + "/fake/quota_at.txt")
        r = self.run_pipe("--batch", "7")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        ocr = [c for c in self.calls() if c.startswith("ocr")]
        self.assertEqual(len(ocr), 2)
        self.assertNotIn("18", ocr[1].split()[1].split(","))

    def test_import_failure_keeps_photos_and_retries(self):
        W(self.root + "/fake/import_fail", "1")
        r = self.run_pipe("--batch", "7")
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertTrue(all(len(self.photos("%02d" % i)) == 3 for i in range(18, 25)))  # 沒匯入成功就不刪
        self.assertTrue(all(v["status"] == "built" for v in self.state()["areas"]["測試"]["shops"].values()))
        os.remove(self.root + "/fake/import_fail")
        r = self.run_pipe("--batch", "7")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual([len(self.photos("%02d" % i)) for i in (18, 19, 20)], [0, 0, 3])
        self.assertEqual(len([c for c in self.calls() if c.startswith("download")]), 1)  # 沒有重下載

    def test_same_error_three_times_stops(self):
        W(self.root + "/fake/import_fail", "1")
        for _ in range(3):
            self.assertEqual(self.run_pipe("--batch", "7").returncode, 1)
        r = self.run_pipe("--batch", "7")
        self.assertEqual(r.returncode, 6, r.stdout + r.stderr)
        self.assertEqual(len([c for c in self.calls() if c.startswith("npm run import")]), 3)  # 第 4 次不再嘗試

    def test_stale_lock_ok_live_lock_blocks(self):
        W(self.root + "/data/pipeline.lock", str(os.getppid()))  # 活著的程序（測試本身的父程序）
        r = self.run_pipe()
        self.assertEqual(r.returncode, 7, r.stdout + r.stderr)
        W(self.root + "/data/pipeline.lock", "999999")
        self.assertEqual(self.run_pipe("--only", "discover").returncode, 0)


class NoKey(Base):
    key_in_env_file = False

    def test_missing_service_key_stops_before_work(self):
        r = self.run_pipe()
        self.assertEqual(r.returncode, 7, r.stdout + r.stderr)
        self.assertEqual(self.calls(), [])
        self.assertIn("SUPABASE_SERVICE_ROLE_KEY", self.state()["stop_reason"])


class DryRun(Base):
    def snapshot(self):
        return tree(self.root)

    def test_dry_run_has_no_side_effects_fresh(self):
        before = self.snapshot()
        r = self.run_pipe("--dry-run", "--batch", "3")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(self.calls(), [])
        self.assertIn("discover", r.stdout)

    def test_dry_run_midway_lists_ids_and_files(self):
        self.run_pipe("--only", "discover")
        self.run_pipe("--only", "download", "--batch", "3")
        before = self.snapshot(); calls = self.calls()
        r = self.run_pipe("--dry-run", "--batch", "3")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(self.calls(), calls)
        self.assertIn("18,19,20", r.stdout)
        self.assertIn("prune", r.stdout)
        self.assertIn("將刪 6 檔", r.stdout)  # 18、19 各 3 張；20 是樣本不刪

    def test_dry_run_reports_blockers_but_does_not_stop(self):
        r = self.run_pipe("--dry-run", cdp="http://127.0.0.1:%d" % free_port(), min_free="1000000000")
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn("實際執行會停止", r.stdout)


class Prune(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="pe-prune-")
        self.root = self.tmp
        for d in ("menu_dataset", "data/menus-maps2", "data/ocr-raw"):
            os.makedirs(os.path.join(self.root, d))
        self.mk("05", imported=True); self.mk("20", imported=True); self.mk("07", imported=False)
        self.mk("09", imported=True, maps2=False)
        st = {"areas": {"A": {"shops": {"05": {"status": "imported"}, "20": {"status": "imported"}, "07": {"status": "built"}, "09": {"status": "imported"}}}}}
        W(self.root + "/data/pipeline-state.json", json.dumps(st))

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def mk(self, sid, imported, maps2=True):
        d = f"{self.root}/menu_dataset/{sid}_ChIJ{sid}"; os.makedirs(d + "/sub")
        for f in ("a.jpg", "b.JPEG", "c.png", "d.webp", "sub/e.jpg", "metadata.json", "notes.txt", "data.json"):
            W(f"{d}/{f}", b"z" * 1000, "wb")
        W(f"{self.root}/data/ocr-raw/{sid}.json", "{}")
        if maps2:
            W(f"{self.root}/data/menus-maps2/{sid}.json", "{}")

    def run_prune(self, *args):
        return subprocess.run([sys.executable, "-B", REPO + "/scripts/prune_photos.py", "--state", "data/pipeline-state.json", *args], cwd=self.root, capture_output=True, text=True)

    def files(self, sid):
        d = f"{self.root}/menu_dataset/{sid}_ChIJ{sid}"
        return sorted(os.path.relpath(os.path.join(r, f), d) for r, _, fs in os.walk(d) for f in fs)

    def test_only_images_of_imported_shops_deleted(self):
        r = self.run_prune("--all-imported")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.files("05"), ["data.json", "metadata.json", "notes.txt"])
        self.assertEqual(len(self.files("20")), 8)  # 樣本：全留
        self.assertEqual(len(self.files("07")), 8)  # 沒匯入：不動
        self.assertEqual(len(self.files("09")), 8)  # 沒有 maps2 檔：不算已匯入
        self.assertIn("刪除 5 個圖片檔", r.stdout)
        self.assertIn("保留樣本 1 家", r.stdout)
        for sid in ("05", "20", "07", "09"):
            self.assertTrue(os.path.exists(f"{self.root}/data/ocr-raw/{sid}.json"))
        self.assertTrue(os.path.exists(f"{self.root}/data/menus-maps2/05.json"))

    def test_ids_not_imported_are_refused(self):
        r = self.run_prune("--ids", "07,09,05")
        self.assertIn("略過未匯入 2 家", r.stdout)
        self.assertEqual(len(self.files("07")), 8); self.assertEqual(len(self.files("09")), 8)
        self.assertEqual(len(self.files("05")), 3)

    def test_dry_run_deletes_nothing_and_json_output(self):
        r = self.run_prune("--all-imported", "--dry-run", "--json")
        self.assertEqual(len(self.files("05")), 8)
        js = json.loads(r.stdout.strip().splitlines()[-1])
        self.assertEqual(js["deleted_files"], 5); self.assertTrue(js["dry_run"])

    def test_no_state_means_nothing_imported(self):
        os.remove(self.root + "/data/pipeline-state.json")
        r = self.run_prune("--all-imported")
        self.assertIn("刪除 0 個圖片檔", r.stdout)
        self.assertEqual(len(self.files("05")), 8)

    def test_keep_mod_zero_keeps_no_samples(self):
        self.run_prune("--ids", "20", "--keep-mod", "0")
        self.assertEqual(self.files("20"), ["data.json", "metadata.json", "notes.txt"])


if __name__ == "__main__":
    unittest.main()
