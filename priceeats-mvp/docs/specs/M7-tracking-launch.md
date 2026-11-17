# M7 追蹤與上線

## 前置（Matt）
- 追蹤工具帳號（先確認免費條款）、網域。未提供前只做 2–5。

## 要做
1. 事件追蹤：search（預算、類型、距離、區域）、open_food、navigate、share、report、upload；另記錄進站 ref 參數。不記錄精確座標，只記最近區域名稱。
2. 回饋入口：每頁頁尾「回報問題」連到 /about/report。
3. 錯誤狀態：Supabase 逾時或失敗顯示可重試訊息；離線顯示提示。各加 e2e。
4. 網域：Cloudflare Pages 自訂網域設定步驟寫進 README（Matt 買好後由子代理操作）。
5. 上線檢查清單 docs/launch-checklist.md：M2–M6 驗收結果、7 情境重跑、Lighthouse 手機分數（效能、無障礙各 ≥ 85）、說明頁聯絡方式已填。

## 不能碰
- 追蹤腳本若需新增套件或外部 script，先在 README 寫理由並回報 Matt。
- 不收集個人資料。

## 驗收
- 測試全過。
- 追蹤後台可看到 6 種事件與 ref 分布（Matt 或 Muse 實測各觸發一次）。
- launch-checklist 全部打勾才通知 Muse 進入公開首波。

## 停止條件
同一錯誤修 3 次失敗就停，回報。

## 11/16 追加
- 追蹤工具候選：GA4（免費、支援自訂事件；Matt 待確認）。GoatCounter 免費版限非商業用途，不適用；Cloudflare Web Analytics 不支援自訂事件與網址參數，不適用。
- GA4 作法：Measurement ID 放環境變數 NEXT_PUBLIC_GA_ID（公開值），未設定時不載入任何追蹤程式；gtag 以 <script async> 載入，不新增 npm 套件；/about/privacy 要寫明使用 Google Analytics 與收集項目。事件名：search、open_food、navigate、share、report、upload；進站 ref 以事件參數 ref 記錄。

## 11/17 實作（事件追蹤、隱私頁、檢查清單；網域與回饋入口未做）
- 追蹤工具：GA4，評估 ID `G-NNCJKE0X94`（`src/lib/site.ts` 的 `GA_ID`，可用 `NEXT_PUBLIC_GA_ID` 覆寫，空字串停用）。
- 載入條件（全部成立才載入與送事件）：正式資料模式（`IS_REAL_DATA`）、ID 非空、`location.hostname` 等於 `SITE_URL` 主機名（預設 priceeats.pages.dev）。localhost、測試、e2e、預覽網域不載入。
- 以 `<script async>` 動態插入，全站（含 /about/*、/area/*）。不新增 npm 套件。`send_page_view` 關閉，page_view 由程式手動送。
- 實作：`src/lib/analytics.ts`（`track()` 與各事件函式）、`src/components/Analytics.tsx`（全站載入、非首頁 page_view）。
- 11/17 與原規劃差異：事件名改為下表；原規劃的 upload 事件未做。

### 事件
| 事件 | 觸發 | 參數 |
| --- | --- | --- |
| page_view | 載入頁面；首頁內 view 切換（home、results、map、upload、favorites） | page_path（首頁為 `/?view=…`，說明頁與入口頁為路徑）、ref |
| search | 按搜尋或條件變更後結果出現（結果頁與地圖頁；資料載入完、停 300 毫秒才送，拖曳預算不連發；同條件不重送） | ref、budget、area、cat、dist、results |
| found_meal | 在結果頁或地圖頁點開一道餐點（method=open_food），或在餐點頁按「導航過去」（method=navigate），各算一次 | ref、budget、area、method |
| share_click | 按分享按鈕 | ref、location（results 或 food） |
| report_submit | 價格回報送出成功 | ref、area |

找到一餐只在「結果頁或地圖頁」才算；首頁範例收據、收藏頁、直接開啟含 food 的網址不算。

### 參數
| 參數 | 定義 |
| --- | --- |
| ref | 進站網址 `?ref=` 的值；第一次看到存 sessionStorage（鍵 pe_ref），同一工作階段之後都帶同一個值；沒有送 `none`；保留原字串（可含中文，如 fb-南港），最長 40 字。分享按鈕產生的連結為 `ref=share` |
| budget | 數字（元） |
| area | 搜尋中心距 8 區（南港車站、內湖科技園區、市政府站、松山車站、汐止車站、東湖站、忠孝復興站、民生社區）中心 ≤ 3 公里時取最近一區的名稱，否則 `other` |
| cat | 餐點類型（不限、便當、飯類、麵食、肉類、海鮮、早餐、小吃、自助餐） |
| dist | 搜尋半徑（公尺：500、1000、2000、5000） |
| results | 結果筆數 |
| method | open_food 或 navigate |
| location | results 或 food |

不送：經緯度、餐點 id、店名。page_location 也只含路徑與 view（不含 lat、lng、food）。

### 行銷端使用
- 自訂連結用 `?ref=來源-內容`，例如 `?ref=fb-南港`。
- GA4 要先在 管理 > 自訂定義 建立事件範圍維度（ref、budget、area、cat、dist、method、location）才能在報表切分。
- 驗證步驟見 docs/launch-checklist.md。
