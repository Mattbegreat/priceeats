"""偵測 Google 驗證碼／異常流量／429。只偵測、不繞過：偵測到就印出 BLOCKED:<原因> 並以結束碼 75 結束。

由 download_menus.py、discover_shops.py 的 --stop-on-block 使用；pipeline.py 看到結束碼 75 就整個停。
"""
import re
import sys

EXIT_BLOCKED = 75
TEXT = re.compile(
    r"(unusual traffic|異常流量|異常的流量|我們的系統偵測到|Our systems have detected|I'm not a robot|我不是機器人"
    r"|帳戶.{0,12}(警告|暫停|停用)|帳號.{0,12}(警告|暫停|停用)|account.{0,24}(suspended|disabled|warning))",
    re.I,
)


class _Watch:
    def __init__(self):
        self.status_429 = None


def attach(page):
    """監聽回應，遇到 Google 網域的 429 就記下（之後 check 會回報）。"""
    w = _Watch()

    def on_response(resp):
        try:
            if resp.status == 429 and "google" in resp.url:
                w.status_429 = resp.url[:120]
        except Exception:
            pass

    try:
        page.on("response", on_response)
    except Exception:
        pass
    page._pe_watch = w
    return w


def check(page):
    """回傳封鎖原因字串；沒事回傳 None。"""
    w = getattr(page, "_pe_watch", None)
    if w is not None and w.status_429:
        return "HTTP 429：" + w.status_429
    try:
        url = page.url or ""
        if "/sorry/" in url or "sorry/index" in url:
            return "Google 驗證頁（sorry）"
        if page.locator("form#captcha-form").count() > 0 or page.locator("iframe[src*='recaptcha']").count() > 0:
            return "Google 驗證碼"
        body = page.inner_text("body", timeout=3000)[:4000]
        m = TEXT.search(body)
        if m:
            return "頁面出現：" + m.group(0)[:40]
    except Exception:
        pass
    return None


def exit_blocked(reason):
    print("BLOCKED:" + reason, flush=True)
    sys.exit(EXIT_BLOCKED)


def stop_if_blocked(page):
    reason = check(page)
    if reason:
        exit_blocked(reason)
