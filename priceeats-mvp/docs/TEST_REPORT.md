# TEST REPORT

以下輸出皆為實際執行指令後的結果（容器：Linux、Node 22、chromium 預裝）。執行日期 2026-10-30。

## 總表

| 項目 | 指令 | 結果 |
|---|---|---|
| 型別檢查 | `npx tsc --noEmit` | 0 錯誤 |
| Lint | `npx next lint` | 0 警告、0 錯誤 |
| 單元測試 | `npx vitest run` | 49／49 通過（4 檔） |
| E2E | `npm run test:e2e` | 14／14 通過 |
| API smoke | `npm run test:api` | 4／4 通過 |
| 一般建置 | `npm run build` | 成功 |
| Demo 建置 | `npm run build:demo` | 成功 |
| 截圖 | `npm run screenshots` | 10 張（見 docs/screenshots/） |

## 規格測試對照

| # | 規格項目 | 測試位置 | 結果 |
|---|---|---|---|
| 1 | 預算 100 → 全部 <= 100，且有 100 元整 | tests/search.test.ts | 通過 |
| 2 | 預算 150 結果數 > 100 | tests/search.test.ts | 通過 |
| 3 | 便當 → 主分類全為便當 | tests/search.test.ts | 通過 |
| 4 | 肉類 → 主分類或標籤含肉類 | tests/search.test.ts | 通過 |
| 5–7 | 三種排序與次排序 | tests/search.test.ts（真實資料逐筆比對＋固定同值案例） | 通過 |
| 8 | 半徑 2km >= 1km，5km >= 2km | tests/search.test.ts | 通過 |
| 9 | Haversine 台北車站→西門 1.0–1.4 km | tests/search.test.ts | 通過 |
| 10 | 新鮮度 30／31／90／91 天 | tests/pricing.test.ts | 通過 |
| 11 | 預算驗證 0、-1、2001、非整數被拒 | tests/pricing.test.ts | 通過 |
| 12 | Migration＋seed 在 PGlite | tests/db.test.ts | 通過（10 項，含 RLS 行為） |
| 13 | 拒絕 GPS 仍能搜尋並出現提示 | e2e/app.e2e.mjs | 通過 |
| 14 | 無環境變數用模擬資料 | e2e/app.e2e.mjs ＋ tests/services.test.ts | 通過 |
| 15 | 收藏後重新整理仍在收藏頁 | e2e/app.e2e.mjs | 通過 |
| 16 | 預算 30／500m／4.5 Empty State，放寬後有結果 | e2e/app.e2e.mjs ＋ tests/search.test.ts | 通過 |
| 17 | 首頁→肉類→搜尋→詳情 ≤ 3 次點擊、< 10 秒 | e2e/app.e2e.mjs | 通過（3 次點擊） |
| 18 | 圖片失效顯示 fallback、不破圖 | e2e/app.e2e.mjs | 通過 |

額外加測：URL 還原狀態、即時篩選、價格回報（不改 foods.price）、地圖標記與圖磚失敗、上傳驗證與 OCR 未設定、localStorage 不可用、375／1440 寬無橫向捲動、Supabase 請求格式（假 fetch）、API route。

## tsc

```
$ npx tsc --noEmit
exit=0
```

## next lint

```
$ npx next lint
✔ No ESLint warnings or errors
exit=0
```

## Vitest (verbose)

```
$ npx vitest run --reporter=verbose
 ✓ tests/db.test.ts > 12. Migration＋seed 在 PGlite 成功 > seed.sql 與 src/data/seed 產生結果一致
 ✓ tests/db.test.ts > 12. Migration＋seed 在 PGlite 成功 > 筆數正確
 ✓ tests/db.test.ts > 12. Migration＋seed 在 PGlite 成功 > 價格範圍與店內價格唯一來源 (foods 無 dine_in_price 欄位)
 ✓ tests/db.test.ts > 12. Migration＋seed 在 PGlite 成功 > 索引存在
 ✓ tests/db.test.ts > 12. Migration＋seed 在 PGlite 成功 > 六張表都啟用 RLS，且 policy 存在
 ✓ tests/db.test.ts > 12. Migration＋seed 在 PGlite 成功 > updated_at trigger 會更新時間
 ✓ tests/db.test.ts > RLS 行為 (set role anon) > anon 可讀公開資料
 ✓ tests/db.test.ts > RLS 行為 (set role anon) > anon 只能新增 pending 的回報，且 pending 讀不到
 ✓ tests/db.test.ts > RLS 行為 (set role anon) > anon 不可 UPDATE／DELETE
 ✓ tests/db.test.ts > RLS 行為 (set role anon) > anon 可新增 ocr_status=pending 的 menu_images，其他狀態被拒
 ✓ tests/search.test.ts > 模擬資料規格 > 30 家以上餐廳、150 筆以上餐點、每家 3–8 道
 ✓ tests/search.test.ts > 模擬資料規格 > 每次載入結果相同 (固定種子)
 ✓ tests/search.test.ts > 模擬資料規格 > 新鮮度涵蓋三種分級，且店家皆標示測試資料
 ✓ tests/search.test.ts > 模擬資料規格 > 價格合理：滷肉飯 35–60、雞腿便當 95–140、牛肉麵 150–280
 ✓ tests/search.test.ts > 模擬資料規格 > 首頁預設值 (100 元／不限／1 公里／價格最低) 直接有結果
 ✓ tests/search.test.ts > 1. 預算是硬上限 > 預算 100 → 所有結果 price <= 100，且 100 元整的餐點會出現
 ✓ tests/search.test.ts > 2. 預算放寬結果變多 > 預算 150 的結果數 > 預算 100
 ✓ tests/search.test.ts > 3–4. 分類篩選 > 便當 → 結果主分類全為便當
 ✓ tests/search.test.ts > 3–4. 分類篩選 > 肉類 → 主分類或標籤含肉類，且包含「主分類不是肉類、靠標籤命中」的餐點
 ✓ tests/search.test.ts > 3–4. 分類篩選 > 雞腿便當＝主分類便當、標籤肉類
 ✓ tests/search.test.ts > 5–7. 排序 (含次排序) > 價格最低：價格→距離→評分(高到低)
 ✓ tests/search.test.ts > 5–7. 排序 (含次排序) > 距離最近：距離→價格
 ✓ tests/search.test.ts > 5–7. 排序 (含次排序) > 評價最高：評分(高到低)→價格
 ✓ tests/search.test.ts > 5–7. 排序 (含次排序) > 次排序 (固定資料，明確同值情境)
 ✓ tests/search.test.ts > 8. 半徑與其他篩選 > 半徑 2km >= 1km，5km >= 2km，且 500m <= 1km
 ✓ tests/search.test.ts > 8. 半徑與其他篩選 > 半徑邊界含等號
 ✓ tests/search.test.ts > 8. 半徑與其他篩選 > 最低評分只留下評分達標的店
 ✓ tests/search.test.ts > 8. 半徑與其他篩選 > 停售餐點不出現
 ✓ tests/search.test.ts > 8. 半徑與其他篩選 > 桃園車站為中心時只看到桃園的店
 ✓ tests/search.test.ts > Empty State 放寬建議 > 預算 30、500m、評分 4.5 沒結果；建議的筆數與實際套用後一致且至少一項有結果
 ✓ tests/search.test.ts > 9. Haversine > 台北車站→西門距離約 1.0–1.4 km
 ✓ tests/search.test.ts > 9. Haversine > 同點為 0，且對稱
 ✓ tests/services.test.ts > 服務與資料層選擇 > 14. 沒有任何環境變數 → MockRepository
 ✓ tests/services.test.ts > 服務與資料層選擇 > 只設一個變數仍用 Mock；兩個都設 → SupabaseRepository
 ✓ tests/services.test.ts > 服務與資料層選擇 > SupabaseRepository 以 anon key 讀取，回報強制 pending
 ✓ tests/services.test.ts > 服務與資料層選擇 > MenuOCRService 預設回 not_configured，不假裝辨識成功
 ✓ tests/services.test.ts > 服務與資料層選擇 > provider 丟出例外 → status error
 ✓ tests/services.test.ts > 服務與資料層選擇 > GooglePlacesAdapter stub 回 not_configured
 ✓ tests/pricing.test.ts > 10. 新鮮度分級邊界 > 30 天＝近期、31 天＝可能需要確認、90 天＝可能需要確認、91 天＝舊資料
 ✓ tests/pricing.test.ts > 10. 新鮮度分級邊界 > 天數計算與純數字分級
 ✓ tests/pricing.test.ts > 10. 新鮮度分級邊界 > 未來日期視為 0 天
 ✓ tests/pricing.test.ts > 驗證狀態：最新一筆非 pending > 略過較新的 pending
 ✓ tests/pricing.test.ts > 驗證狀態：最新一筆非 pending > 全部 pending 或空陣列 → null
 ✓ tests/pricing.test.ts > 11. 預算輸入驗證 > 0、-1、2001、非整數被拒
 ✓ tests/pricing.test.ts > 11. 預算輸入驗證 > 1、100、2000 通過
 ✓ tests/pricing.test.ts > 價格回報驗證 > 調漲需高於現價、調降需低於現價
 ✓ tests/pricing.test.ts > 價格回報驗證 > 停售不需價格；資訊錯誤需說明；價格範圍 1–5000
 ✓ tests/pricing.test.ts > URL query 還原狀態 > 預設值不寫入網址；往返一致
 ✓ tests/pricing.test.ts > URL query 還原狀態 > 非法參數退回預設
 Test Files  4 passed (4)
      Tests  49 passed (49)
exit=0
```

## Playwright E2E (對 build:demo 的 out/)

```
$ npm run test:e2e
  ✔ 13. 拒絕 GPS 權限仍能搜尋並出現結果與提示文字 (669.286015ms)
  ✔ 14. 沒有任何環境變數時正常使用模擬資料 (標示測試資料、不連 Supabase) (389.497049ms)
  ✔ 15. 收藏後重新整理仍在收藏頁 (710.713049ms)
  ✔ 16. 條件極嚴 (預算 30、500m、評分 4.5) 顯示 Empty State，點放寬按鈕後有結果 (487.002325ms)
    -> 點擊 3 次，從開啟頁面到詳情 432 ms
  ✔ 17. 成功標準流程：首頁→選肉類→搜尋→開詳情，≤ 3 次點擊，全程 < 10 秒 (442.501411ms)
  ✔ 17b. 首頁預設值 (100 元／不限／1 公里) 直接按搜尋即有結果，價格皆 <= 100 (422.510819ms)
  ✔ 18. 圖片網址失效時顯示 fallback，不出現破圖；圖片有效時正常顯示 (1765.673028ms)
  ✔ 19. 網址還原狀態：重新整理後篩選條件與開啟的詳情都還在 (671.392313ms)
  ✔ 20. 結果頁調整篩選即時更新 (不需再按搜尋)；詳情有導航連結與菜單照片空狀態 (526.264374ms)
  ✔ 21. 價格回報：寫入待確認，不改餐點價格 (597.322458ms)
  ✔ 22. 地圖：標記顯示最低價、點標記開店內清單→詳情；圖磚失敗有提示且清單模式可用 (887.608022ms)
  ✔ 23. 上傳：檔案驗證、OCR 未設定時切到人工輸入、不顯示辨識成功、送出為待確認 (2216.328683ms)
  ✔ 24. localStorage 不可用時頁面仍正常 (收藏降級、搜尋照常) (619.589356ms)
  ✔ 25. 1440 與 375 寬無橫向捲動 (636.126328ms)
✔ E2E (build:demo 的 out/，chromium 390x844) (11199.24787ms)
ℹ tests 14
ℹ pass 14
ℹ fail 0
exit=0
```

## API smoke

```
$ npm run build && npm run test:api
GET  /api/health -> {"ok":true,"repository":"mock"}
POST /api/reports (mock 模式) -> 501
POST /api/menu-submissions (mock 模式) -> 501
GET  / -> 200
API smoke test 通過 (4/4)
exit=0
```

## 建置

```
$ npm run build
Route (app)                                 Size  First Load JS
┌ ○ /                                    49.2 kB         153 kB
├ ○ /_not-found                            993 B         104 kB
├ ƒ /api/health                            130 B         103 kB
├ ƒ /api/menu-submissions                  130 B         103 kB
└ ƒ /api/reports                           130 B         103 kB
  ├ chunks/255-b1e2483a7e02feee.js       46.6 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js  54.2 kB
  └ other shared chunks (total)           2.5 kB
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
exit=0

$ npm run build:demo
Route (app)                                 Size  First Load JS
┌ ○ /                                    49.2 kB         153 kB
└ ○ /_not-found                            993 B         104 kB
  ├ chunks/255-2005b055456c798b.js       46.7 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js  54.2 kB
  └ other shared chunks (total)          2.49 kB
○  (Static)  prerendered as static content
exit=0
```

out/ 目錄大小：1.3M；index.html 內資產路徑：

```
"./_next/static/css/5e06d21f9615206e.css
"./_next/static/chunks/webpack-daec9c749efd4f8b.js
"./_next/static/chunks/4bd1b696-c023c6e3521b1417.js
```

## 截圖

- docs/screenshots/1440-1-home.png
- docs/screenshots/1440-2-results.png
- docs/screenshots/1440-3-detail.png
- docs/screenshots/1440-4-map.png
- docs/screenshots/1440-5-upload.png
- docs/screenshots/390-1-home.png
- docs/screenshots/390-2-results.png
- docs/screenshots/390-3-detail.png
- docs/screenshots/390-4-map.png
- docs/screenshots/390-5-upload.png

截圖時瀏覽器可連到 OpenStreetMap，所以地圖圖磚為真實圖磚；餐點圖為 SVG 插圖（Commons 照片 0 張，原因見 README「圖片」）。

## 未驗證項目（不自報）

- GPS 成功定位路徑（只測拒絕）。
- 真實 Supabase 專案連線。
- Vercel／Netlify 實際部署。
- 螢幕閱讀器實測與自動化無障礙掃描；僅在程式中設定 aria-label、44px 觸控目標，色彩以人工檢視。
