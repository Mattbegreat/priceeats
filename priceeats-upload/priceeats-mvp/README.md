# PriceEats

> 你的預算，決定今天吃什麼。 / Find food within your budget.

以「餐點價格」為核心的在地美食搜尋 MVP：預算 → 類型 → 距離 → 列出附近符合預算的「餐點」。

三條原則：
1. 結果以**餐點**為單位，同店不同餐點分別出現。
2. 價格一律是**店內價格**；不儲存、不顯示外送平台價格。
3. 測試資料一律標示「測試資料」，不偽裝成 Google Maps 資料。

> 目前內建的 39 家餐廳、213 道餐點全是**虛構的測試資料**（店名帶「（測試）」，評分顯示「評分 4.3（測試資料）」），不是真實店家。

## 功能

| 代號 | 功能 |
|---|---|
| A | 首頁：預算滑桿（30–500，步進 10）、快速按鈕 $50/$100/$150/$200/自訂（1–2000 整數驗證）、類型、距離、定位狀態列、搜尋。預設 100 元／不限／1 公里／價格最低 |
| B | 結果：餐點卡片（圖、名稱＋價格、店名、距離、評分、驗證徽章、更新日期）；頂部即時調整預算／類型／距離／最低評分／排序；Empty State 提供「預算 +50」「距離擴大一級」並顯示放寬後筆數 |
| C | 詳情（底部 Sheet）：大圖、價格、店家、地址、距離、評分、菜單照片、價格來源與驗證、價格歷史、Google 地圖導航、收藏、價格回報（寫入 pending，不改 foods.price） |
| D | 價格地圖：Leaflet＋OpenStreetMap，搜尋中心、半徑圓、店家標記（顯示該店符合條件的最低價）、點標記看餐點清單、圖磚失敗提示、清單模式 |
| E | 菜單上傳：格式與 8MB 驗證、預覽、店名必填、選現有店家或地圖點選新位置、OCR 未設定時切換人工輸入表格、送出為「待確認」 |
| F | 收藏頁（localStorage，重新整理保留） |
| G | 手機底部導覽、Loading／Empty／Error、GPS 拒絕／逾時 8 秒／不支援時退回台北車站並提示、PWA manifest＋icon＋theme-color |

單一路由 `/`，用 client 狀態＋URL query（`view, budget, cat, dist, sort, minRating, lat, lng, food`）切換畫面，所以重新整理與分享網址可還原狀態，也能靜態匯出成單一 `index.html`。

## 技術與相依套件

| 套件 | 用途 |
|---|---|
| Next.js 15（App Router）、React 19、TypeScript strict | 框架（規格指定） |
| Tailwind CSS 3 ＋ postcss、autoprefixer | 樣式（Tailwind 必要的建置相依） |
| lucide-react | 圖示（規格指定） |
| zod 4 | 表單與資料驗證（規格指定） |
| leaflet、react-leaflet 5 | 地圖，OpenStreetMap 圖磚（規格指定） |
| vitest | 單元測試（規格指定） |
| playwright 1.63.0（devDependency） | E2E。版本與環境預裝的 playwright 相同；瀏覽器用預裝的 chromium，**沒有**執行 `playwright install` |
| @electric-sql/pglite（devDependency） | 測試時在記憶體內執行 migration＋seed（規格指定） |
| tsx（devDependency） | 執行 TypeScript 腳本（產生 seed.sql） |
| eslint 8、eslint-config-next、@types/* | `next lint` 與型別 |

沒有使用 `@supabase/supabase-js`：SupabaseRepository 直接呼叫 PostgREST（`fetch`），少一個相依，行為也都在 `src/repositories/supabase.ts` 看得到。

## 架構（文字圖）

```
瀏覽器
 └─ src/app/page.tsx ──► components/App.tsx（狀態＋URL query 同步）
        │
        ├─ 畫面：HomeView / ResultsView / MapView / UploadView / FavoritesView / FoodDetailSheet
        │
        ├─ lib/search  ：buildIndex → search(篩選、排序) → relaxSuggestions(放寬建議)；params.ts(URL 與驗證)
        ├─ lib/geo     ：haversine、locate(GPS 8 秒逾時)
        ├─ lib/pricing ：freshness(新鮮度)、verification(最新非 pending)、report(回報驗證)
        ├─ lib/storage ：localStorage 安全讀寫 (全部 try/catch)
        │
        └─ repositories/index.ts  ── createRepository()
               ├─ MockRepository      (預設：資料 = data/seed，回報/上傳 = localStorage)
               └─ SupabaseRepository  (設定 NEXT_PUBLIC_SUPABASE_URL + ANON_KEY 時啟用，走 PostgREST + RLS)

services/ocr       MenuOCRService.recognize → 預設 not_configured
services/adapters  GooglePlacesAdapter 介面 + not_configured stub
server/handlers.ts + app/api/*   薄包裝的 route handler (只在 npm run build 存在，demo 建置時排除)
```

資料流：`repo.load(today)` 取回整包資料 → `buildIndex(data, today)` 攤平並算新鮮度 → `search(index, params)` 以搜尋中心算距離、過濾、排序。所有搜尋函式都是純函式，「今天」由參數注入，所以測試可用固定日期。

## 資料夾結構

```
priceeats/
├─ src/
│  ├─ app/                 layout、page、globals.css、api/ (health, reports, menu-submissions)
│  ├─ components/          UI 元件
│  ├─ lib/{search,geo,pricing,storage,import}/
│  ├─ services/{ocr,adapters}/
│  ├─ repositories/        types、mock、supabase、local、index
│  ├─ server/handlers.ts   route handler 的實際邏輯
│  ├─ data/                categories、centers、photo-credits、seed/(dishes、restaurants、index、sql、random)
│  └─ types/
├─ supabase/               migrations/0001_init.sql、0002_production.sql、seed.sql (由 script 產生)
├─ scripts/                build-demo.mjs、gen-seed-sql.ts、smoke-api.mjs、import-menu.ts
├─ tests/                  Vitest：search、pricing、services、db(PGlite)、import、migration-0002、production-mode；fixtures/sample-store.json
├─ e2e/                    Playwright：server.mjs、app.e2e.mjs、run.mjs、screenshots.mjs
├─ docs/                   TEST_REPORT.md、screenshots/
├─ public/                 manifest、icon
└─ .env.example
```

## 本機啟動

```bash
npm install
npm run dev            # http://localhost:3000，沒有任何環境變數就是模擬資料
```

## 資料來源與模擬資料

- 沒有環境變數 → `MockRepository`，資料由 `src/data/seed` 以**固定亂數種子**（mulberry32）產生，每次載入相同。
- 30 家以上餐廳：35 家在台北車站周邊 0–5 公里、4 家在桃園車站周邊；餐點 213 道，每家 3–8 道；價格 35–325 元，各類餐點落在規格的合理區間。
- 驗證日期以「今天往前推 N 天」產生：目前 106 道在 30 天內、78 道在 31–90 天、29 道超過 90 天。
- 預算 30 元一定查無結果（最低價 35 元），這是刻意的，用來呈現 Empty State。

## Supabase 設定（選用）

1. 建立 Supabase 專案。
2. SQL Editor 依序執行 `supabase/migrations/0001_init.sql`、`supabase/migrations/0002_production.sql`；要用測試資料再執行 `supabase/seed.sql`（seed 全是測試資料）。
   改過 `src/data/seed` 後用 `npm run gen:seed` 重新產生 `seed.sql`。
   **正式模式**：兩個 `NEXT_PUBLIC_SUPABASE_*` 都設定時，畫面只載入 `is_test_data = false` 的店家（含其餐點、標籤、驗證紀錄），即使資料庫裡留著 seed 測試資料也不會出現；「測試資料」標記與「評分 x.x（測試資料）」只會在未設定 Supabase 的 mock 模式出現。正式資料不顯示評分數字（`google_rating` 欄位保留不使用），詳情頁改為「在 Google Maps 看評價」連結（以店名＋地址搜尋）。
3. 複製 `.env.example` 為 `.env.local`，填入：
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
   ```
   兩個都填才會切換到 SupabaseRepository。anon key 本來就是公開用的，權限由 RLS 控制；**service_role key 絕對不要放進前端或 `NEXT_PUBLIC_` 變數**。
4. RLS 重點：anon 可讀 restaurants／categories／foods／food_tags 與 `verification_status <> 'pending'` 的 price_verifications；只能新增 `pending` 的回報與 `pending` 的 menu_images；不能 UPDATE／DELETE。

> SupabaseRepository 與匯入工具只用假的 fetch 測過請求格式，SQL 用 PGlite 驗證；尚未對真實 Supabase 專案實測（第一次匯入請先用單一店家檔試跑，再到網站確認）。

## 正式資料匯入

把菜單照片整理成 JSON（一店一檔），用本機腳本寫進 Supabase，網站就會讀到真實餐點。

**一次性準備**

1. 在 Supabase SQL Editor 執行 `supabase/migrations/0002_production.sql`（可重複執行；會加欄位、正式分類與 `name+address` 唯一鍵）。
2. 取得 service role key（Supabase 專案 → Project Settings → API，標示為 `service_role`／secret 的那把）。只放在**本機**：
   ```bash
   export SUPABASE_SERVICE_ROLE_KEY='貼上金鑰'      # 或寫進 .env.local（已在 .gitignore）
   export SUPABASE_URL='https://xxxx.supabase.co'    # 省略時沿用 NEXT_PUBLIC_SUPABASE_URL
   ```
   這把金鑰擁有完整資料庫權限：**不要貼進對話、程式、文件或 commit，不要設到 Netlify 或任何 `NEXT_PUBLIC_` 變數**；外洩就到 Supabase 重新產生。

**輸入格式**（一店一檔）

```json
{
  "restaurant": {
    "name": "店名",
    "address": "地址",
    "lat": 25.0478,
    "lng": 121.5170,
    "google_maps_url": "https://www.google.com/maps/place/.../@25.0478,121.5170,17z"
  },
  "source_date": "2026-10-30",
  "source_image": "menu-001.jpg",
  "items": [
    { "name": "排骨便當", "price": 95, "category": "便當", "tags": ["肉類"], "confidence": 0.95 }
  ]
}
```

**指令**

```bash
npm run import:menu -- --dry-run tests/fixtures/sample-store.json   # 只驗證、印報告，不連線、不需金鑰
npm run import:menu -- ./menus/                                      # 資料夾：讀其中所有 .json
npm run import:menu -- ./menus/store-a.json ./menus/store-b.json     # 或指定多個檔
```

**規則**

| 項目 | 規則 |
|---|---|
| 座標 | JSON 有 `lat`＋`lng` 就用；缺少時從 `google_maps_url` 解析：`!3d緯度!4d經度`（地點頁，最精確）→ `q=`／`query=`／`ll=` 後接 `緯度,經度` → `@緯度,經度`。短網址（maps.app.goo.gl）與只有店名的搜尋網址無法離線解析；仍缺座標就跳過該店並列在報告 |
| 驗證（zod） | `price` 整數 1–5000；`category` 與 `tags` 必須在分類表（便當、飯類、麵食、肉類、海鮮、早餐、小吃、自助餐）；`confidence` 0–1；`source_date` 為 `YYYY-MM-DD` |
| 低信心 | `confidence < 0.8` 的品項不寫入，列在報告 |
| 同名品項 | 同一檔內重複品名只留最後一筆，其餘列在報告 |
| 店家 | 以 `name + address` upsert；`is_test_data` 一律寫 `false`（0001 的預設值是 `true`），`source` 寫 `menu_photo` |
| 餐點 | 以 `restaurant_id + name` upsert（價格以最新檔案為準） |
| 價格紀錄 | 每筆價格新增一筆 `price_verifications`（`source_type = verification_status = 'menu_photo'`，`verified_at = source_date`）；同餐點、同日、同價已存在就略過，所以重跑同一個檔不會重複堆疊 |
| 報告 | 新增店數、新增／更新餐點數、價格紀錄筆數、跳過的店與品項（附原因）。數字都由程式計算；有任何一家寫入失敗時結束代碼為 1 |

`tests/fixtures/sample-store.json` 只是驗證用的樣本檔（含低信心、非法價格、不存在分類的品項），**請勿用正式模式匯入**。

## 部署

### Netlify 部署（正式站：連 GitHub，push main 自動部署）

Netlify 原生支援 Next.js，**不需要另裝 plugin、不需要 `netlify.toml`**；只有建置失敗時才再評估 `@netlify/plugin-nextjs`。

1. Netlify → Add new site → Import an existing project → 選 GitHub 的 `priceeats`，Branch 選 `main`。
2. Build settings（實測可用的靜態輸出）：Base directory `priceeats-mvp`、Build command `npm run build:demo`、Publish directory `out`。伺服器模式（`npm run build`）在 Netlify 上實測一直回 404，所以正式站改用靜態輸出；靜態輸出沒有 `/api/*`，網站直接在瀏覽器連 Supabase。
3. Site configuration → Environment variables 設兩個：
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
   ```
   `NEXT_PUBLIC_` 變數是**建置時**內嵌進前端的，新增或修改後要重新部署（Deploys → Trigger deploy）才會生效。**不要在 Netlify 設 `SUPABASE_SERVICE_ROLE_KEY`**——它只給本機匯入工具用。
4. 之後每次 push `main` 自動建置並部署；其他分支與 PR 會產生預覽網址。
5. 驗收：手機開首頁，預設中心為南港車站（正式模式）、預算 100 元搜尋，結果只會是匯入工具寫進 Supabase 的餐點，且沒有「測試資料」標記。預設只看主餐，勾選「含單點小菜、湯品」才會顯示滷蛋、湯品、小菜。
6. 資料庫要先執行 `0001_init.sql`、`0002_production.sql`（見上方「Supabase 設定」），並用「正式資料匯入」寫入至少一家店；沒有任何正式資料時，網站會顯示查無結果，這是正常的。

### 取得菜單照片（Google 地圖）

`scripts/download_menus.py` 讀 `data/shops.csv`，下載各店 Google 地圖「菜單」分頁的照片到 `menu_dataset/`（已在 .gitignore）。需要已登入 Google 的 Chrome，否則看不到菜單分頁：

```
chrome.exe --remote-debugging-port=9222 --user-data-dir=C:\chrome-menu
python scripts\download_menus.py --cdp http://localhost:9222 [--only 12]
```

照片辨識後寫成 `data/menus/<店名>.json`，信心低於 0.8 的品項匯入時會略過。新增相依：Python `playwright`（只在本機下載菜單時使用，不進網站）。

### Vercel（一般建置，含 API 路由）

1. 把專案推到 Git，在 Vercel 匯入。Framework 自動偵測為 Next.js，建置指令 `npm run build`。
2. 要用 Supabase 才需要在 Project Settings → Environment Variables 設 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`；不設就是測試資料。
3. 第二階段的 `GOOGLE_PLACES_API_KEY`、`GEMINI_API_KEY` 只能設為一般（伺服器端）變數，不可加 `NEXT_PUBLIC_`。

### Netlify／任何靜態空間（示範版 out/）

```bash
npm run build:demo     # 產生 out/，資產路徑為 ./_next/...，可放在任何子路徑
```
- Netlify：拖曳 `out/` 資料夾到 Netlify Drop，或設定 Build command `npm run build:demo`、Publish directory `out`。
- `build:demo` 會暫時把 `src/app/api` 移出（route handler 不能 `output: 'export'`），建置完成（或失敗）後一定還原。示範版的回報與上傳都存在瀏覽器 localStorage。
- 本機預覽：`node -e "import('./e2e/server.mjs').then(async m=>{const s=await m.startServer();console.log(s.url)})"`，或任何靜態伺服器指向 `out/`。

> 沒有 Vercel／Netlify 帳號，**尚未實際部署**；兩種 build 皆已在本機成功。

## 測試指令

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # next lint
npm test               # Vitest：75 項（含匯入工具、migration 0002）
npm run import:menu -- --dry-run <json檔或資料夾>   # 正式資料匯入驗證，見「正式資料匯入」
npm run build          # 一般建置（含 API 路由）
npm run test:api       # 需先 build；起 next start 打 API 後關閉
npm run build:demo     # 靜態匯出 out/
npm run test:e2e       # Playwright，對 out/ 起靜態伺服器；需先 build:demo
npm run screenshots    # 產生 docs/screenshots/ 10 張圖
```

最新一次實際結果（詳見 `docs/TEST_REPORT.md`）：

| 項目 | 結果 |
|---|---|
| `tsc --noEmit` | 0 錯誤 |
| `next lint` | 0 警告、0 錯誤 |
| Vitest | 75／75 通過（7 個檔案） |
| Playwright E2E（390×844） | 14／14 通過 |
| API smoke | 4／4 通過 |
| `npm run build` | 成功 |
| `npm run build:demo` | 成功，out/ 約 1.3 MB |

## 圖片

規格要求優先使用 Wikimedia Commons 可熱連結的照片，且網址、授權、作者都要先確認。這次執行環境連不到 commons.wikimedia.org（WebFetch 回傳 url_not_found，WebSearch 只能拿到檔案頁標題、讀不到授權與作者），依規格「不要自創或猜圖片網址」，所以**Commons 照片 0 張，8 個分類全部使用 SVG 插圖**。

- 所有圖片位置（卡片、詳情、地圖清單）都經 `FoodImage`：沒有網址或載入失敗就換成 SVG 插圖，不會破圖。
- 日後加照片：在 `src/data/photo-credits.ts` 登錄（餐點名稱 → 網址、授權、作者、檔案頁），重新 `npm run gen:seed`；詳情頁會自動標示授權。

## 尚未實作／已知限制

- 沒有部署到 Vercel／Netlify（沒有帳號）。
- SupabaseRepository 未對真實 Supabase 專案實測。
- Supabase 模式下菜單照片沒有上傳到 Storage：菜單投稿仍只存在本機待審草稿；`menu_images` 資料表與 RLS 已備好。
- Supabase 模式下 anon 讀不到 pending，所以重新載入後，自己的待確認回報不會出現在價格歷史（mock 模式會出現）。
- OCR 只有介面與 `not_configured` provider；Google Places 只有介面與 stub。
- GPS 成功路徑沒有自動化測試（只測了拒絕路徑）；Playwright 的 geolocation 成功情境未寫。
- 沒有 service worker（規格為可選）。
- `next lint` 在 Next 15 已標示為棄用（Next 16 移除），目前可正常執行。
- OSM 官方圖磚有使用政策，示範用量沒問題，正式上線請改用自有圖磚服務。
- 正式資料沒有評分：結果頁的「最低評分」篩選與「評分」排序在正式模式下沒有意義（評分都是空的，設定最低評分會濾掉全部餐點）；目前未隱藏這兩個控制項。
- 測試縫隙：`window.__PRICEEATS_TEST_IMAGE_URL`（只有 E2E 測試會設定，用來驗證圖片失效 fallback），正式使用不會設定。

## 第二階段建議

1. 接 Google Places（伺服器端 route，API Key 只放伺服器；遵守 Google Maps Platform 條款：不爬蟲、不永久儲存 Places 照片、標示歸屬），填入 `google_place_id`、`google_rating`。
2. OCR：伺服器端 route 呼叫 Gemini（免費額度），結果一律先進人工確認表格，再成為 pending 資料。
3. Supabase Storage 儲存菜單照片；加入後台／腳本審核 pending 回報（本階段不做後台）。
4. 補上 GPS 成功路徑的 E2E、無障礙自動掃描（axe）。
5. 找到可用的 Commons 照片後逐道登錄 `photo-credits.ts`。
