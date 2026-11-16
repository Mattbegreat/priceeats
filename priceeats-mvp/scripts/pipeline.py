"""全台擴張串流流程（M11.1）。由 scripts/pipeline.sh 呼叫。

步驟（每個區域）：discover（區域級，一次）→ 每批 N 家：download → ocr → build → qa → import → prune。
- 可續跑、冪等：每步完成才寫 data/pipeline-state.json；重跑從未完成的步驟接續，已完成的店不重下載、不重匯入。
- 停止條件（整個停、寫入 state 與 data/pipeline.log、非零結束碼，不重試、不繞過）：
    2 可用空間不足｜3 Chrome CDP 連不上｜4 驗證碼／異常流量／429｜5 OCR 額度用完｜
    6 同一錯誤累計 3 次｜7 設定缺漏（缺金鑰、缺查詢檔、另一個程序在跑）｜1 某步驟失敗｜130 使用者中斷
- --dry-run：只印出每步會做什麼與影響的店號、檔案數；不寫任何檔（連 state、log 都不寫）、不下載、不呼叫 agy、不匯入、不刪檔。
- 金鑰只在 .env.local（由 npm run import:menu 自己讀）；本程式只檢查「有沒有」，不印、不傳；子程序輸出會遮蔽金鑰樣式。
"""
import argparse
import csv
import glob
import json
import math
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from datetime import datetime

STEPS = ["discover", "download", "ocr", "build", "qa", "import", "prune"]
EXIT = {"step": 1, "disk": 2, "cdp": 3, "blocked": 4, "quota": 5, "repeat": 6, "config": 7, "interrupt": 130}
TERMINAL = {"imported", "no_menu", "rejected", "qa_rejected"}
RETRYABLE = {"ocr_failed", "dl_error"}  # 不自動重試；--retry-failed 才再排
MID = {"pending", "downloaded", "ocr_done", "built"}  # dry-run 預演時視為「後面步驟會處理」
NO_MENU_STATUS = {"no_menu_tab", "no_photos_found"}
SECRET_PAT = re.compile(r"(eyJ[A-Za-z0-9_\-]{10,}(?:\.[A-Za-z0-9_\-]+){0,2}|sb_(?:secret|publishable)_[A-Za-z0-9_\-]+)")
GB = 1024 ** 3


class Stop(Exception):
    def __init__(self, kind, msg):
        super().__init__(msg)
        self.kind, self.msg = kind, msg


def now():
    return datetime.now().astimezone().isoformat(timespec="seconds")


class Ctx:
    def __init__(self, a):
        self.a = a
        self.root = os.path.abspath(a.root)
        self.dry = a.dry_run
        self.state_path = os.path.join(self.root, "data", "pipeline-state.json")
        self.log_path = os.path.join(self.root, "data", "pipeline.log")
        self.lock_path = os.path.join(self.root, "data", "pipeline.lock")
        self.secrets = []
        self.env_file = parse_env(os.path.join(self.root, ".env.local"))
        for k in ("SUPABASE_SERVICE_ROLE_KEY",):
            v = os.environ.get(k) or self.env_file.get(k)
            if v:
                self.secrets.append(v)
        self.state = self.load_state()
        self.run_info = {"imported_stores": 0, "imported_dishes": 0, "deleted_gb": 0.0, "downloaded": 0, "ocr": 0, "discovered": 0}

    # ---- 路徑 ----
    def p(self, *parts):
        return os.path.join(self.root, *parts)

    # ---- log ----
    def redact(self, s):
        for sec in self.secrets:
            s = s.replace(sec, "***")
        return SECRET_PAT.sub("***", s)

    def log(self, msg):
        line = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} {self.redact(msg)}"
        print(("[dry-run] " if self.dry else "") + self.redact(msg), flush=True)
        if not self.dry:
            os.makedirs(os.path.dirname(self.log_path), exist_ok=True)
            with open(self.log_path, "a", encoding="utf-8") as f:
                f.write(line + "\n")

    # ---- state ----
    def load_state(self):
        try:
            st = json.load(open(self.state_path, encoding="utf-8"))
        except FileNotFoundError:
            st = {}
        except Exception as e:
            raise Stop("config", f"pipeline-state.json 讀不了（{e}）；請先檢查或備份後移走，不自動覆蓋")
        st.setdefault("version", 1)
        st.setdefault("areas", {})
        st.setdefault("errors", {})
        st.setdefault("stop_reason", None)
        return st

    def save(self):
        if self.dry:
            return
        self.state["updated"] = now()
        os.makedirs(os.path.dirname(self.state_path), exist_ok=True)
        tmp = self.state_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.state, f, ensure_ascii=False, indent=1)
        os.replace(tmp, self.state_path)

    def area_state(self, area):
        return self.state["areas"].setdefault(area, {"discover": {"done": False}, "shops": {}, "batches": []})

    # ---- 子程序 ----
    def run(self, cmd, env=None, label=None):
        """執行子程序、逐行寫 log（已遮蔽金鑰）。回傳 (結束碼, 輸出文字)。"""
        self.log(f"$ {' '.join(cmd)}" if not env else f"$ {' '.join(f'{k}=…' for k in env)} {' '.join(cmd)}")
        e = dict(os.environ)
        e["PYTHONDONTWRITEBYTECODE"] = "1"
        if env:
            e.update(env)
        out = []
        pr = subprocess.Popen(cmd, cwd=self.root, env=e, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors="replace")
        for line in pr.stdout:
            line = line.rstrip("\n")
            out.append(line)
            self.log("  | " + line)
        pr.wait()
        return pr.returncode, "\n".join(out)


def parse_env(path):
    d = {}
    try:
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            d[k.strip()] = v.strip().strip('"').strip("'")
    except OSError:
        pass
    return d


# ---------- 資料讀取 ----------
def read_shops(ctx):
    try:
        return list(csv.DictReader(open(ctx.p("data", "shops.csv"), encoding="utf-8-sig")))
    except FileNotFoundError:
        return []


def read_idset(path):
    try:
        return {l.strip() for l in open(path, encoding="utf-8") if l.strip() and not l.startswith("#")}
    except OSError:
        return set()


def area_info(ctx, area):
    try:
        areas = json.load(open(ctx.p("data", "areas.json"), encoding="utf-8"))
    except Exception as e:
        raise Stop("config", f"data/areas.json 讀不了：{e}")
    if area not in areas:
        raise Stop("config", f"data/areas.json 沒有區域「{area}」（現有：{'、'.join(areas)}）")
    return areas[area]


def query_file(ctx, area, info):
    rel = ctx.a.queries or info.get("queries") or (f"data/queries/area-{info['slug']}.txt" if info.get("slug") else None)
    return rel, (rel and os.path.isfile(ctx.p(rel)))


def dist_km(la, ln, c):
    return math.hypot((la - c["lat"]) * 111, (ln - c["lng"]) * 111 * math.cos(math.radians(25)))


def area_shop_ids(ctx, info):
    out = []
    for r in read_shops(ctx):
        try:
            if dist_km(float(r["lat"]), float(r["lng"]), info) <= ctx.a.radius:
                out.append(r["id"])
        except (ValueError, KeyError):
            continue
    return sorted(out, key=lambda x: (len(x), x))


def meta_status(ctx, sid):
    for d in glob.glob(ctx.p("menu_dataset", f"{sid}_*")):
        try:
            return json.load(open(os.path.join(d, "metadata.json"), encoding="utf-8")).get("status")
        except Exception:
            return "error"
    return None


def legacy_done(ctx, sid):
    """不在 state 裡、但早就處理過的店：已有 maps2 檔，或下載確定沒菜單。"""
    if os.path.isfile(ctx.p("data", "menus-maps2", f"{sid}.json")):
        return True
    return meta_status(ctx, sid) in NO_MENU_STATUS


def pending_ids(ctx, area, info):
    st = ctx.area_state(area)
    excluded = read_idset(ctx.p("data", "ocr-reject.txt")) | read_idset(ctx.p("data", "ocr-skip.txt"))
    handled_batch_ids = {i for b in st["batches"] for i in b["ids"]}
    out = []
    for sid in area_shop_ids(ctx, info):
        rec = st["shops"].get(sid)
        if sid in excluded:
            continue
        if sid in handled_batch_ids and not (ctx.a.retry_failed and rec and rec["status"] in RETRYABLE):
            continue
        if rec is None and legacy_done(ctx, sid):
            continue
        out.append(sid)
    if ctx.a.limit and not ctx.a.retry_failed:
        out = out[: max(0, ctx.a.limit - len(handled_batch_ids))]
    return out


# ---------- 檢查 ----------
def free_gb(ctx):
    return shutil.disk_usage(ctx.root).free / GB


def check_disk(ctx):
    f = free_gb(ctx)
    if f < ctx.a.min_free_gb:
        raise Stop("disk", f"可用空間 {f:.2f} GB 低於下限 {ctx.a.min_free_gb:g} GB")
    return f


def cdp_ok(ctx):
    try:
        with urllib.request.urlopen(ctx.a.cdp.rstrip("/") + "/json/version", timeout=3) as r:
            return r.status == 200
    except Exception:
        return False


def check_cdp(ctx):
    if not cdp_ok(ctx):
        raise Stop("cdp", f"Chrome CDP 連不上（{ctx.a.cdp}）：請以 --remote-debugging-port=9222 開啟已登入 Google 的 Chrome；本程式不會嘗試登入")


def has_service_key(ctx):
    return bool(os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ctx.env_file.get("SUPABASE_SERVICE_ROLE_KEY"))


def fail_step(ctx, step, msg):
    e = ctx.state["errors"].get(step)
    key = msg.splitlines()[0][:120]
    if e and e["msg"] == key:
        e["count"] += 1
    else:
        ctx.state["errors"][step] = e = {"msg": key, "count": 1}
    ctx.save()
    raise Stop("step", f"{step} 失敗：{key}（同一錯誤第 {e['count']} 次）")


def guard_repeat(ctx, step):
    e = ctx.state["errors"].get(step)
    if e and e["count"] >= 3 and not ctx.a.clear_errors:
        raise Stop("repeat", f"{step} 同一錯誤已累計 {e['count']} 次（{e['msg']}）；處理後以 --clear-errors 重跑")


def ok_step(ctx, step):
    ctx.state["errors"].pop(step, None)


# ---------- 批次 ----------
def get_batch(ctx, area, info):
    st = ctx.area_state(area)
    for b in st["batches"]:
        if not b.get("done"):
            return b, False
    ids = pending_ids(ctx, area, info)[: ctx.a.batch]
    if not ids:
        return None, False
    for i in ids:
        if i in st["shops"] and st["shops"][i]["status"] in RETRYABLE:
            st["shops"][i]["status"] = "pending"
    b = {"n": len(st["batches"]) + 1, "ids": ids, "steps": {}, "done": False, "created": now(), "stats": {}}
    return b, True


def step_done(b, step):
    return step in b["steps"]


def mark(ctx, b, step, **info):
    b["steps"][step] = {"at": now(), **info}
    ctx.save()


def shop_rec(ctx, area, sid):
    return ctx.area_state(area)["shops"].setdefault(sid, {"status": "pending"})


def set_status(ctx, area, sid, status, b=None):
    r = shop_rec(ctx, area, sid)
    r["status"] = status
    if b is not None:
        r["batch"] = b["n"]


def sel(ctx, area, b, *statuses):
    """本批中狀態在 statuses 內的店號；dry-run 預演時，還沒跑到的中間狀態也算（因為前面的步驟在預演中不會真的做）。"""
    want = set(statuses) | (MID if ctx.dry else set())
    return [i for i in b["ids"] if shop_rec(ctx, area, i)["status"] in want]


def plan(ctx, text, ids=None, files=None):
    n = f"（{len(ids)} 家：{','.join(ids[:12])}{'…' if len(ids) > 12 else ''}）" if ids is not None else ""
    f = f"；約影響 {files} 個檔" if files is not None else ""
    ctx.log(f"  步驟：{text}{n}{f}")


# ---------- 各步 ----------
def do_discover(ctx, area, info):
    st = ctx.area_state(area)
    qf, exists = query_file(ctx, area, info)
    if st["discover"].get("done") and not ctx.a.rediscover:
        ctx.log(f"discover：已完成（{st['discover'].get('at')}，新增 {st['discover'].get('added', 0)} 家），略過")
        return
    if not exists:
        if area_shop_ids(ctx, info):
            ctx.log("discover：區域沒有查詢檔（data/areas.json 的 queries 或 --queries），但 shops.csv 已有此區店家，略過")
            if not ctx.dry:
                st["discover"] = {"done": True, "at": now(), "added": 0, "note": "no query file"}
                ctx.save()
            return
        raise Stop("config", f"找不到查詢檔 {qf}，且 shops.csv 沒有此區店家")
    cmd = ["python3", "scripts/discover_shops.py", "--cdp", ctx.a.cdp, "--area", area, "--query-file", qf,
           "--radius", str(ctx.a.radius), "--stop-on-block"]
    if ctx.a.limit:
        cmd += ["--limit", str(ctx.a.limit)]
    if ctx.dry:
        plan(ctx, "discover → " + " ".join(cmd))
        return
    check_disk(ctx)
    check_cdp(ctx)
    guard_repeat(ctx, "discover")
    before = len(read_shops(ctx))
    rc, out = ctx.run(cmd)
    if rc == 75:
        raise Stop("blocked", "Google 封鎖偵測：" + (re.findall(r"BLOCKED:(.*)", out) or ["不明"])[-1])
    if rc != 0:
        fail_step(ctx, "discover", f"discover_shops.py 結束碼 {rc}")
    added = len(read_shops(ctx)) - before
    ok_step(ctx, "discover")
    st["discover"] = {"done": True, "at": now(), "added": added}
    ctx.run_info["discovered"] += added
    ctx.save()


def do_download(ctx, area, b):
    ids = [i for i in b["ids"] if meta_status(ctx, i) != "ok" and meta_status(ctx, i) not in NO_MENU_STATUS]
    if ctx.dry:
        plan(ctx, "download：python3 scripts/download_menus.py --cdp … --only <店號> --stop-on-block", ids, len(ids) * 3)
        return
    if ids:
        check_disk(ctx)
        check_cdp(ctx)
        guard_repeat(ctx, "download")
        rc, out = ctx.run(["python3", "scripts/download_menus.py", "--cdp", ctx.a.cdp, "--only", ",".join(ids), "--stop-on-block"])
        # 先把已完成的店記起來，再判斷停止
        _sync_download(ctx, area, b)
        if rc == 75:
            ctx.save()
            raise Stop("blocked", "Google 封鎖偵測：" + (re.findall(r"BLOCKED:(.*)", out) or ["不明"])[-1])
        if rc != 0:
            fail_step(ctx, "download", f"download_menus.py 結束碼 {rc}")
        ok_step(ctx, "download")
    _sync_download(ctx, area, b)
    ctx.run_info["downloaded"] += sum(1 for i in b["ids"] if shop_rec(ctx, area, i)["status"] == "downloaded")
    mark(ctx, b, "download", ok=sum(1 for i in b["ids"] if shop_rec(ctx, area, i)["status"] == "downloaded"))


def _sync_download(ctx, area, b):
    for sid in b["ids"]:
        s = meta_status(ctx, sid)
        r = shop_rec(ctx, area, sid)
        if r["status"] in ("imported",):
            continue
        if s == "ok":
            if r["status"] in ("pending", "dl_error"):
                set_status(ctx, area, sid, "downloaded", b)
        elif s in NO_MENU_STATUS:
            set_status(ctx, area, sid, "no_menu", b)
        elif s is not None:
            set_status(ctx, area, sid, "dl_error", b)
    ctx.save()


def do_ocr(ctx, area, b):
    ids = [i for i in sel(ctx, area, b, "downloaded")
           if not os.path.isfile(ctx.p("data", "ocr-raw", f"{i}.json")) and not os.path.isfile(ctx.p("data", "menus-maps2", f"{i}.json"))]
    if ctx.dry:
        plan(ctx, "ocr：OCR_ONLY=<店號> bash scripts/run_ocr.sh %d（本機 agy；dry-run 不呼叫）" % ctx.a.jobs, ids)
        return
    if ids:
        check_disk(ctx)
        guard_repeat(ctx, "ocr")
        quota = ctx.p("data", ".quota-stop")
        rc, out = ctx.run(["bash", "scripts/run_ocr.sh", str(ctx.a.jobs)], env={"OCR_ONLY": ",".join(ids)})
        done = [i for i in ids if os.path.isfile(ctx.p("data", "ocr-raw", f"{i}.json"))]
        for i in done:
            set_status(ctx, area, i, "ocr_done", b)
        ctx.save()
        if os.path.exists(quota):
            raise Stop("quota", "OCR 額度用完（429）：" + open(quota, encoding="utf-8", errors="replace").read().strip()[:100])
        if rc != 0:
            fail_step(ctx, "ocr", f"run_ocr.sh 結束碼 {rc}")
        if not done:
            fail_step(ctx, "ocr", "本批 OCR 全數失敗（agy 不可用？看 data/ocr-run.err）")
        ok_step(ctx, "ocr")
    for i in b["ids"]:
        r = shop_rec(ctx, area, i)
        if r["status"] == "downloaded":
            set_status(ctx, area, i, "ocr_failed", b)  # 沒有辨識檔：agy 失敗或最新照片早於 2025，不自動重試
    ctx.run_info["ocr"] += len(ids)
    mark(ctx, b, "ocr", ok=sum(1 for i in b["ids"] if shop_rec(ctx, area, i)["status"] == "ocr_done"))


def do_build(ctx, area, b):
    ids = sel(ctx, area, b, "ocr_done", "built")
    if ctx.dry:
        plan(ctx, "build：python3 scripts/build_from_ocr.py → data/menus-maps2/<店號>.json", ids)
        return
    if ids:
        guard_repeat(ctx, "build")
        rc, out = ctx.run(["python3", "scripts/build_from_ocr.py"])
        if rc != 0:
            fail_step(ctx, "build", f"build_from_ocr.py 結束碼 {rc}")
        ok_step(ctx, "build")
    for i in ids:
        set_status(ctx, area, i, "built" if os.path.isfile(ctx.p("data", "menus-maps2", f"{i}.json")) else "rejected", b)
    mark(ctx, b, "build", ok=sum(1 for i in ids if shop_rec(ctx, area, i)["status"] == "built"))


def stage_dir(ctx, area, b):
    return ctx.p("data", "pipeline-batches", f"{area.replace('/', '_')}-{b['n']}")


def valid_store(path):
    try:
        d = json.load(open(path, encoding="utf-8"))
        name = str(d["restaurant"]["name"]).strip()
        n = len(d.get("items", []))
    except Exception as e:
        return False, f"JSON/欄位錯誤：{e}", 0
    if not name:
        return False, "店名空白", 0
    if n < 1:
        return False, "沒有任何餐點", 0
    return True, "", n


def do_qa(ctx, area, b):
    ids = sel(ctx, area, b, "built")
    if ctx.dry:
        plan(ctx, "qa：複製到 data/pipeline-batches/…/ 後跑自訂檢查與 python3 scripts/qa_check.py（報告另存，不覆蓋 data/qa-report.md）", ids)
        return
    sd = stage_dir(ctx, area, b)
    if os.path.isdir(sd):
        shutil.rmtree(sd)
    os.makedirs(sd)
    good, items = [], 0
    for i in ids:
        src = ctx.p("data", "menus-maps2", f"{i}.json")
        ok, why, n = valid_store(src)
        if not ok:
            ctx.log(f"  QA 剔除 {i}：{why}")
            set_status(ctx, area, i, "qa_rejected", b)
            continue
        if n < 3:
            ctx.log(f"  QA 提醒 {i}：只有 {n} 道")
        shutil.copy2(src, os.path.join(sd, f"{i}.json"))
        good.append(i)
        items += n
    if good:
        guard_repeat(ctx, "qa")
        rc, out = ctx.run(["python3", "scripts/qa_check.py", os.path.relpath(sd, ctx.root), "--out", os.path.relpath(sd, ctx.root) + ".qa.md"])
        if rc != 0:
            fail_step(ctx, "qa", f"qa_check.py 結束碼 {rc}")
        ok_step(ctx, "qa")
    mark(ctx, b, "qa", ok=len(good), dishes=items)
    b["stats"]["staged_dishes"] = items


def do_import(ctx, area, b):
    sd = stage_dir(ctx, area, b)
    ids = sel(ctx, area, b, "built")
    if ctx.dry:
        plan(ctx, "import：npm run import:menu -- " + os.path.relpath(sd, ctx.root) + "（金鑰只從 .env.local 讀）", ids)
        return
    if not ids:
        mark(ctx, b, "import", stores=0, dishes=0)
        return
    if not has_service_key(ctx):
        raise Stop("config", "缺 SUPABASE_SERVICE_ROLE_KEY（.env.local 或環境變數）；匯入前停止")
    if not os.path.isdir(sd):
        raise Stop("config", f"找不到暫存資料夾 {sd}（qa 步驟未完成？）")
    guard_repeat(ctx, "import")
    rc, out = ctx.run(["npm", "run", "import:menu", "--", os.path.relpath(sd, ctx.root)])
    if rc != 0:
        fail_step(ctx, "import", f"import:menu 結束碼 {rc}（部分店可能已寫入；重跑是冪等的）")
    ok_step(ctx, "import")
    dishes = 0
    for i in ids:
        dishes += valid_store(os.path.join(sd, f"{i}.json"))[2]
        set_status(ctx, area, i, "imported", b)
        shop_rec(ctx, area, i)["imported_at"] = now()
    b["stats"].update(imported_stores=len(ids), imported_dishes=dishes)
    ctx.run_info["imported_stores"] += len(ids)
    ctx.run_info["imported_dishes"] += dishes
    mark(ctx, b, "import", stores=len(ids), dishes=dishes)
    shutil.rmtree(sd, ignore_errors=True)  # 只刪 pipeline 自己建的暫存副本
    try:
        os.remove(sd + ".qa.md")
    except OSError:
        pass


def do_prune(ctx, area, b):
    ids = sel(ctx, area, b, "imported")
    if ctx.dry:
        import prune_photos
        r = prune_photos.prune(ids, ctx.state_path, ctx.p("menu_dataset"), ctx.p("data", "menus-maps2"), 20, True, True)
        plan(ctx, f"prune：python3 scripts/prune_photos.py --ids …（保留店號 %20==0 樣本與 metadata.json）→ 將刪 {r['deleted_files']} 檔 {r['deleted_gb']:.2f} GB，保留樣本 {len(r['kept_sample_shops'])} 家",
             ids)
        return
    if ids:
        rc, out = ctx.run(["python3", "-B", "scripts/prune_photos.py", "--ids", ",".join(ids), "--json"])
        if rc != 0:
            fail_step(ctx, "prune", f"prune_photos.py 結束碼 {rc}")
        js = [l for l in out.splitlines() if l.startswith("{")]
        r = json.loads(js[-1]) if js else {}
        for i in r.get("shops", []):
            shop_rec(ctx, area, i)["pruned"] = True
        for i in r.get("kept_sample_shops", []):
            shop_rec(ctx, area, i)["pruned"] = "kept_sample"
        b["stats"]["deleted_files"] = r.get("deleted_files", 0)
        b["stats"]["deleted_gb"] = r.get("deleted_gb", 0.0)
        ctx.run_info["deleted_gb"] += r.get("deleted_gb", 0.0)
    mark(ctx, b, "prune", gb=b["stats"].get("deleted_gb", 0.0))


STEP_FN = {"download": do_download, "ocr": do_ocr, "build": do_build, "qa": do_qa, "import": do_import, "prune": do_prune}


def run_gen_stats(ctx):
    """匯入後重跑 npm run gen:area-stats（需要公開的 anon key；沒有就略過並記錄，不算失敗）。"""
    env = ctx.env_file
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or env.get("SUPABASE_URL")
    anon = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not (url and anon):
        ctx.log("gen:area-stats 略過：缺 NEXT_PUBLIC_SUPABASE_ANON_KEY（公開金鑰，可放 .env.local 或環境變數）；請之後手動執行")
        ctx.state["gen_area_stats"] = {"at": now(), "status": "skipped"}
        ctx.save()
        return
    rc, _ = ctx.run(["npm", "run", "gen:area-stats"], env={"NEXT_PUBLIC_SUPABASE_URL": url, "NEXT_PUBLIC_SUPABASE_ANON_KEY": anon})
    ctx.state["gen_area_stats"] = {"at": now(), "status": "ok" if rc == 0 else f"failed({rc})"}
    if rc != 0:
        ctx.log("gen:area-stats 失敗（不影響已匯入資料；請手動重跑）")
    ctx.save()


# ---------- 主流程 ----------
def run_area(ctx, area):
    info = area_info(ctx, area)
    only = ctx.a.only
    st = ctx.area_state(area)
    ctx.log(f"=== 區域 {area}（{info.get('label', '')}）｜批次大小 {ctx.a.batch}" + (f"｜上限 {ctx.a.limit} 家" if ctx.a.limit else "") + (f"｜只跑 {only}" if only else ""))
    if only in (None, "discover"):
        do_discover(ctx, area, info)
        if only == "discover":
            return
    nb = 0
    while True:
        b, new = get_batch(ctx, area, info)
        if b is None:
            ctx.log(f"區域 {area}：沒有待處理店家（已處理 {len(st['shops'])} 家）")
            break
        if new:
            if not ctx.dry:
                st["batches"].append(b)
                for i in b["ids"]:
                    shop_rec(ctx, area, i)
                ctx.save()
        ctx.log(f"--- 批次 {b['n']}（{'新' if new else '續跑'}）：{len(b['ids'])} 家 {','.join(b['ids'][:10])}{'…' if len(b['ids']) > 10 else ''}｜已完成步驟：{','.join(b['steps']) or '無'}")
        pending_steps = [s for s in STEPS[1:] if not step_done(b, s) and (only is None or only == s)]
        if pending_steps and not ctx.dry:
            check_disk(ctx)  # 每批開始前
        for s in pending_steps:
            STEP_FN[s](ctx, area, b)
        if not ctx.dry and all(step_done(b, s) for s in STEPS[1:]):
            b["done"] = True
            b["finished"] = now()
            ctx.save()
        nb += 1
        if ctx.dry:
            rest = len(pending_ids(ctx, area, info)) - (len(b["ids"]) if new else 0)
            ctx.log(f"（dry-run 只預演第一批；之後約還有 {max(rest, 0)} 家待處理）")
            break
        if only or (ctx.a.max_batches and nb >= ctx.a.max_batches):
            break


def summary(ctx, areas, stop):
    ri = ctx.run_info
    f = free_gb(ctx)
    ctx.log("【本次回報】區域：" + "、".join(areas) +
            f"｜發現 {ri['discovered']} 家｜下載 {ri['downloaded']} 家｜辨識 {ri['ocr']} 家｜匯入 {ri['imported_stores']} 店／{ri['imported_dishes']} 道"
            f"｜刪除照片 {ri['deleted_gb']:.2f} GB｜磁碟剩餘 {f:.1f} GB｜停止原因：{stop or '無'}")


def parse_args(argv):
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description="全台擴張串流流程（見檔案開頭說明）")
    ap.add_argument("areas", nargs="+", help="data/areas.json 的區域名稱（可多個，依序跑）")
    ap.add_argument("--batch", type=int, default=50, help="每批幾家（預設 50）")
    ap.add_argument("--limit", type=int, default=0, help="此區域最多處理幾家（0 = 不限；試跑用 20）")
    ap.add_argument("--only", choices=STEPS, help="只跑單一步驟")
    ap.add_argument("--dry-run", action="store_true", help="只印計畫，不寫任何檔、不下載、不呼叫 agy、不匯入、不刪檔")
    ap.add_argument("--cdp", default="http://localhost:9222")
    ap.add_argument("--min-free-gb", type=float, default=3.0, help="每批開始前可用空間下限（預設 3）")
    ap.add_argument("--max-batches", type=int, default=0, help="一次最多跑幾批（0 = 跑到沒有待處理）")
    ap.add_argument("--radius", type=float, default=2.5, help="區域半徑公里（與 discover_shops.py 一致）")
    ap.add_argument("--queries", help="查詢檔（預設用 areas.json 該區的 queries 欄位）")
    ap.add_argument("--jobs", type=int, default=2, help="run_ocr.sh 同時幾家")
    ap.add_argument("--rediscover", action="store_true", help="已 discover 過也重跑")
    ap.add_argument("--retry-failed", action="store_true", help="重試 ocr_failed／dl_error 的店")
    ap.add_argument("--clear-errors", action="store_true", help="清除「同一錯誤 3 次」計數後再跑")
    ap.add_argument("--root", default=os.path.dirname(here), help=argparse.SUPPRESS)
    return ap.parse_args(argv)


def main(argv=None):
    a = parse_args(argv)
    sys.path.insert(0, os.path.join(os.path.abspath(a.root), "scripts"))
    ctx = None
    stop = None
    code = 0
    lock = None
    try:
        ctx = Ctx(a)
        if a.clear_errors and not ctx.dry:
            ctx.state["errors"] = {}
        if not ctx.dry:
            lock = ctx.lock_path
            os.makedirs(os.path.dirname(lock), exist_ok=True)
            if os.path.exists(lock):
                try:
                    pid = int(open(lock).read().strip())
                    os.kill(pid, 0)
                    raise Stop("config", f"另一個 pipeline 正在執行（pid {pid}）")
                except (ValueError, ProcessLookupError, PermissionError):
                    pass
            open(lock, "w").write(str(os.getpid()))
            ctx.state["stop_reason"] = None
            ctx.state["last_run"] = {"started": now(), "areas": a.areas, "only": a.only}
            ctx.save()
        f = free_gb(ctx)
        ctx.log(f"開始：區域 {a.areas}｜可用空間 {f:.1f} GB｜CDP {a.cdp}：{'可連' if cdp_ok(ctx) else '連不上'}" + ("｜.env.local 金鑰：" + ("有" if has_service_key(ctx) else "沒有")))
        if ctx.dry:
            if f < a.min_free_gb:
                ctx.log(f"警告：可用空間低於 {a.min_free_gb:g} GB，實際執行會停止")
            if not cdp_ok(ctx):
                ctx.log("警告：Chrome CDP 連不上，實際執行會在 discover／download 前停止")
            if not has_service_key(ctx):
                ctx.log("警告：缺 SUPABASE_SERVICE_ROLE_KEY，實際執行會在 import 前停止")
        elif (a.only in (None, "import")) and not has_service_key(ctx):
            raise Stop("config", "缺 SUPABASE_SERVICE_ROLE_KEY（.env.local 或環境變數）；為避免白跑 OCR，開跑前就停")
        for area in a.areas:
            run_area(ctx, area)
        if not ctx.dry and ctx.run_info["imported_stores"] and a.only in (None, "import"):
            run_gen_stats(ctx)
    except Stop as s:
        stop, code = f"{s.kind}：{s.msg}", EXIT[s.kind]
        if ctx is None:
            print("停止｜" + stop, file=sys.stderr)
    except KeyboardInterrupt:
        stop, code = "interrupt：使用者中斷", EXIT["interrupt"]
    finally:
        if ctx is not None:
            if stop:
                ctx.log("停止｜" + stop)
            if not ctx.dry:
                ctx.state["stop_reason"] = stop
                ctx.state.setdefault("last_run", {}).update({"ended": now(), "exit_code": code, "summary": ctx.run_info})
                ctx.save()
            summary(ctx, a.areas, stop)
        if lock and os.path.exists(lock):
            try:
                if open(lock).read().strip() == str(os.getpid()):
                    os.remove(lock)
            except OSError:
                pass
    return code


if __name__ == "__main__":
    sys.exit(main())
