# M6 內容與說明頁

## 要做
1. 靜態頁（Next.js app 路由，靜態匯出）：/about/source（資料來源與更新方式、價格可能有誤差、以店內為準）、/about/privacy（不收帳號、定位只在瀏覽器使用、回報內容）、/about/report（如何回報錯誤、店家要求下架的聯絡方式——聯絡方式待 Matt 提供，先留「待確認」）。
2. 24 個入口頁：8 區 × 3 預算（50、100、150），路徑 /area/<區域代碼>/<預算>。每頁獨立 title、description、H1，內容是一段說明＋「開始搜尋」按鈕（連到帶 lat、lng、budget 的結果頁）。頁內的店數、餐點數在 build 時由腳本從 Supabase 查出寫入，不讓模型自報；查不到就不顯示數字。
3. sitemap.xml、robots.txt。
4. 上傳菜單入口說明：UploadView 上方加一段「為什麼上傳、上傳後會怎樣」。
5. 頁尾加三個說明頁連結。

## 不能碰
- SUPABASE_SERVICE_ROLE_KEY 不進前端與 Cloudflare；build 用 anon key 讀取。
- 不新增套件。

## 驗收
- `npm run build:demo` 後 out/ 內有 24 個入口頁與 3 個說明頁，各頁 title 不重複（腳本檢查）。
- 測試全過。
- 線上 sitemap.xml 回 200，列出 27＋1 個網址。

## 停止條件
同一錯誤修 3 次失敗就停，回報。

## 11/16 追加（Matt 提供）
- CONTACT_EMAIL = priceeat.tw@gmail.com（Matt 同意公開，用於 /about/report 的聯絡與店家更正／下架）。
