# 上線檢查清單 (11/17 更新)

狀態：已驗＝本機自動測試已過（vitest 與 Playwright）／待 Matt 實機／待部署後驗（需正式網址）。
11/17 自動測試：typecheck、lint 0 警告；Vitest 323 項；E2E 45 項；GA 事件 E2E（`npm run test:e2e:ga`）5 項。

| 里程碑 | 驗收項 | 狀態 |
| --- | --- | --- |
| M2 | 新增測試涵蓋新鮮度分級、隱藏評分篩選與排序、meta description | 已驗 |
| M2 | 結果頁 DOM 無「最低評分」「評價最高」（正式模式） | 已驗（單元測試）；待部署後驗（線上 DOM） |
| M2 | 線上南港車站 100 元 500m「舊資料」比例 < 30% | 待部署後驗 |
| M3 | side-dish 正反例 ≥ 20 個 | 已驗 |
| M3 | 7 情境前 30 筆 ≥ 10 家店、前 20 筆小菜 ≤ 2（見 docs/specs/acceptance-1116.md） | 11/16 已跑；部署後重跑 |
| M4 | 首頁 1 秒內可點、結果頁第一屏 ≥ 3 張卡、無橫向捲動、觸控目標 ≥ 44px（375 與 320 寬） | 已驗 |
| M4 | iPhone、Android 實機：定位授權、加到主畫面 | 待 Matt 實機 |
| M5 | 最近區域計算、分享連結組成單元測試 | 已驗 |
| M5 | 線上 lat=25.0143&lng=121.4627 顯示最近區域按鈕且有結果 | 待部署後驗 |
| M5 | 首頁 HTML 含 og:image，圖片網址回 200 | 待部署後驗 |
| M5 | LINE 貼連結出現標題與圖 | 待 Matt 實機 |
| M6 | out/ 有 24 個入口頁與 3 個說明頁、title 不重複（`npm run check:out`） | 已驗 |
| M6 | 線上 sitemap.xml 回 200、列 28 個網址 | 待部署後驗 |
| M6 | 說明頁聯絡 Email 已填（priceeat.tw@gmail.com） | 已驗 |
| M7 | 事件追蹤 (search、found_meal、share_click、report_submit、page_view)，測試環境不載入 | 已驗 |
| M7 | 隱私頁「使用統計」段與第三方服務清單 | 已驗 |
| M7 | GA4 後台看到各事件與 ref 分布 | 待部署後驗（步驟見下） |
| M7 | 回饋入口（頁尾「回報問題」）、錯誤狀態與離線提示、網域設定 | 本輪未做 |
| M7 | Lighthouse 手機分數（效能、無障礙各 ≥ 85） | 待部署後驗 |
| M7 | 7 情境在正式網址重跑 | 待部署後驗 |

## 部署前
1. Cloudflare Pages 建置變數：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`（正式資料模式）。`NEXT_PUBLIC_GA_ID` 不設即用預設評估 ID；設空字串可停用。
2. `NEXT_PUBLIC_SITE_URL` 要與實際網域一致：gtag 只在「主機名等於 SITE_URL 主機名」時載入。換自訂網域時同步改這個變數，否則追蹤不會啟動。
3. 預覽網域（xxxx.priceeats.pages.dev）與 localhost 不載入追蹤，這是預期行為。

## 部署後驗證 GA4
1. 開正式網址 `?ref=check-1117`，DevTools Network 篩 `googletagmanager`：應有一支 gtag/js 請求（預覽網域與 localhost 不應有）。
2. GA4 後台 > 管理 > DebugView：瀏覽器安裝 Google Analytics Debugger 擴充功能後重新整理，DebugView 應出現 page_view。
3. 在網站依序操作：按搜尋 → 點開一道餐點 → 按導航過去 → 按分享（結果頁與餐點頁各一次）→ 送出一筆價格回報（會寫入待確認資料，測完請通知 Matt 清除）。
4. DebugView 對照：search、found_meal(method=open_food)、found_meal(method=navigate)、share_click(location=results、food)、report_submit，每個事件的 ref 都是 check-1117。
5. GA4 > 報表 > 即時：確認事件數出現（約 1 分鐘內）。
6. 事件參數要在報表使用，需到 管理 > 自訂定義 建立「事件範圍」自訂維度：ref、budget、area、cat、dist、method、location；results 建為自訂指標。建立後約 24 小時才有資料。
7. 檢查事件參數：任一事件都不應有 lat、lng、餐點 id、店名。
8. 將 `check-1117` 測試流量在 GA4 資料篩選器排除，或首波前記下測試時間。
