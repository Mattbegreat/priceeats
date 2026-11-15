# M1 只載入搜尋中心附近的資料（規格書，執行者：Sonnet 子代理）

規劃：Opus｜日期：2026-11-14｜藍圖：7 天計畫第 1 天

## 為什麼
正式資料庫有 1,432 家店、51,000 道餐點（之後會到 3,000 家）。現在 `SupabaseRepository.load()` 每次開站把 foods、food_tags、price_verifications 整張表分頁抓完，手機很慢，也耗 Supabase 免費流量。

## 起始狀態
- `src/repositories/supabase.ts`：`load()` 無參數，全表下載後在前端用 restaurant_id 過濾。
- `src/repositories/types.ts`：`Repository.load(today: Date)`。
- `src/components/App.tsx` 第 64 行附近呼叫 `load(new Date())` 一次，之後篩選都在前端（`src/lib/search/filter.ts`）。
- 距離篩選選項：500m、1km、2km、5km（URL 參數 `dist`，見 `src/lib/search/params.ts`）。
- 資料表與外鍵：看 `supabase/migrations/0001_init.sql`、`0002_production.sql`。restaurants 有 latitude、longitude。
- 測試：`tests/production-mode.test.ts`、`tests/services.test.ts` 用假的 fetch 模擬 PostgREST。

## 目標狀態
1. 正式模式（Supabase）只下載「搜尋中心 ± 目前距離篩選」範圍內的店，以及這些店的餐點、標籤、價格紀錄、菜單圖。
2. 使用者改變搜尋中心，或把距離放大到超出已載入範圍時，自動再載入；縮小距離或改預算、分類、排序時不重新下載。
3. 同一範圍在同一次瀏覽中不重複下載（記憶體快取即可，key 用四捨五入後的中心與半徑）。
4. Mock 模式行為不變。
5. 載入中、載入失敗各有畫面狀態；失敗時顯示可重試的訊息，不白屏。

## 做法限制
- 用經緯度方框查 restaurants（`latitude=gte.…&latitude=lte.…&longitude=gte.…&longitude=lte.…`），方框由中心與半徑公里數換算，再由既有的 haversine 在前端精確過濾。換算函式放 `src/lib/geo/`，要有單元測試。
- 餐點等子表用 PostgREST 內嵌關聯（`select=*,foods(*,…)`）或 `restaurant_id=in.(…)` 分批查詢，二選一；選 `in` 時每批 id 數量要有上限，避免網址過長（每批 ≤ 100 個）。
- 保留既有的 1000 筆分頁邏輯（content-range）。
- 不新增相依套件。不改資料庫結構；如果你判斷非改不可（例如需要 RPC），停下來回報，不要自己寫 migration。
- 金鑰：前端只用 anon key。不要讀取或輸出任何 .env 檔內容。

## 可以改的檔案
`src/repositories/*`、`src/components/App.tsx`、`src/lib/geo/*`、`src/types/index.ts`（僅在介面需要時）、`tests/*`、`e2e/*`、`README.md`（只加一小段說明）。其他檔案不要動；特別是 `scripts/`、`data/`、`supabase/`、`src/data/centers.ts`。

## 驗收（全部要附實際指令輸出）
1. `npm run typecheck && npm run lint && npm test` 全過；e2e 用 `npm run test:e2e`（不要執行 playwright install；若環境跑不起來，回報原因即可）。
2. 新測試至少涵蓋：
   - 方框換算：給定中心與 2 km，方框四邊正確（誤差 < 1%）。
   - 只查範圍內：假 fetch 收到的 restaurants 請求帶四個經緯度條件；foods 請求不再是無條件全表。
   - 快取：同一中心與半徑呼叫兩次，網路請求次數不增加。
   - 放大範圍：半徑 1 km → 5 km 會再查一次；5 km → 1 km 不會。
   - 超過 1000 筆仍能分頁抓完（既有測試不可刪）。
3. 用程式算出並回報：假資料 3,000 店、每店 35 道的情境下，改版前後的請求數與下載筆數對照。

## 停止條件
- 同一個錯誤修 3 次仍失敗：停，回報錯誤訊息與已試過的做法。
- 需要改資料庫、加套件、或動到「可以改的檔案」以外：停，回報。

## 回報格式（繁體中文、台灣用語）
1. 做了什麼（3–6 點）
2. 改了哪些檔案（清單）
3. 測試通過數與指令輸出
4. 請求數與筆數對照表
5. 已知問題與你做的假設
