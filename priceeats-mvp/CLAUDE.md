# PriceEats — 給 AI 的專案說明（每次開工先讀這份，不要整個 repo 掃一遍）

產品：以預算找附近「餐點」的手機 Web App。結果以餐點為單位、只用店內價、測試資料必須標示。
語言：UI 與文件一律繁體中文台灣用語。

## 架構地圖
- 單一路由 `/`：`src/components/App.tsx` 用 URL query（view, budget, cat, dist, sort, minRating, lat, lng, food）切換畫面
- 畫面：HomeView / ResultsView / MapView / UploadView / FavoritesView / FoodDetailSheet
- 搜尋邏輯：`src/lib/search/`（filter.ts 篩選排序、params.ts URL 參數、relax.ts 放寬建議）
- 距離：`src/lib/geo/`（haversine、定位 fallback 台北車站）
- 價格新鮮度與驗證：`src/lib/pricing/`（30／90 天分級；回報只寫 pending，不改 foods.price）
- 資料層：`src/repositories/`（types.ts 介面；mock.ts 預設；supabase.ts 用 fetch 打 PostgREST，兩個 NEXT_PUBLIC_SUPABASE_* 都設才啟用；local.ts 是 localStorage）
- 伺服器邏輯：`src/server/handlers.ts`；`src/app/api/*` 只是薄包裝（build:demo 時暫時移出）
- 外部服務：`src/services/ocr`（預設 not_configured）、`src/services/adapters`（Google Places stub）
- 資料：`src/data/seed`（固定種子測試資料）→ `npm run gen:seed` 產生 `supabase/seed.sql`
- DB：`supabase/migrations/0001_init.sql`（RLS：anon 只能讀、只能新增 pending）、`0002_production.sql`（正式分類、google_maps_url／source、restaurants name+address 唯一鍵）
- 正式資料匯入：`npm run import:menu -- [--dry-run] <json檔或資料夾>`（`scripts/import-menu.ts`；驗證與座標解析 `src/lib/import/menu.ts`、PostgREST 寫入 `src/lib/import/writer.ts`；需本機環境變數 `SUPABASE_SERVICE_ROLE_KEY`，絕不進前端或 Netlify）
- 正式模式（Supabase 啟用）：`SupabaseRepository.load` 只載入 `is_test_data=false`；正式資料不顯示評分，詳情頁改「在 Google Maps 看評價」連結（`src/lib/geo/maps-url.ts`）

## 指令
- `npm run dev`／`npm run build`／`npm run build:demo`（靜態匯出到 out/，資產相對路徑）
- 驗收順序：`npm run typecheck && npm run lint && npm test && npm run test:e2e`
- E2E 用預裝 playwright＋chromium，不要執行 playwright install

## 規則
- 只改任務要求的檔案；新增相依套件要在 README 寫理由
- 改 DB 一律新增 migration（0002_…），不改 0001
- 金鑰只放環境變數；`NEXT_PUBLIC_` 只能放 Supabase anon key
- 數字（價格、距離、筆數）用程式算，不讓模型自報
- 同一錯誤修 3 次失敗就停，記錄後回報
- 完成回報：做了什麼、測試通過數、已知問題；附實際指令輸出
