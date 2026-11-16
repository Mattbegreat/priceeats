# M11.0 容量量測（2026-11-17）

範圍：Supabase 用量與免費上限、OCR 單位時間、每 1,000 家店的占用與可容納店數。不改程式、不寫 Supabase。數字由 `scripts/capacity.py` 與 PostgREST 查詢算出；「估算」「假設」都有標明；查不到的寫「待確認」或留空欄位給 Matt 填。

## 1. 各表列數（正式 Supabase，anon key 讀取，2026-11-17）

方法：`Prefer: count=exact`、`Range: 0-0`，讀 `Content-Range` 的總數。

| 表 | 列數 | 說明 |
| --- | --- | --- |
| restaurants | 2,413 | 加 `is_test_data=eq.false` 也是 2,413，即全部為正式資料 |
| foods | 87,201 | 此表沒有 `is_test_data` 欄，無法單獨篩正式；與 11/17 匯入餐點數 87,201 一致，視為全為正式 |
| food_tags | 371 | 同上，沒有 `is_test_data` 欄 |
| price_verifications | 87,201 | anon 只讀得到 `verification_status <> 'pending'` 的列（RLS）；使用者回報的 pending 列讀不到，實際列數 ≥ 此值 |
| menu_images | 讀不到 | anon 無 SELECT 權限（HTTP 401，permission denied）；列數請 Matt 在後台讀（見 §3） |

每 1,000 家店對應列數（程式算，以 2,413 家為分母）：restaurants 1,000；foods 36,138；food_tags 154；price_verifications 36,138。每家平均 36.1 道餐點。

## 2. Supabase 免費方案上限與付費方案

查詢日期：2026-11-17。來源：
- 定價頁 https://supabase.com/pricing （以 https://supabase.com/pricing.md 讀取）
- 計費說明 https://supabase.com/docs/guides/platform/billing-on-supabase
- 磁碟說明 https://supabase.com/docs/guides/platform/manage-your-usage/disk-size
- 資料庫大小說明 https://supabase.com/docs/guides/platform/database-size

| 項目 | Free | Pro（最低付費方案） | 來源 |
| --- | --- | --- | --- |
| 月費 | 0 | 起價 US$25／月 | 定價頁（寫「From $25/month」） |
| 資料庫大小 | 500 MB／專案 | 磁碟 8 GB／專案（含） | 定價頁、計費說明（兩處一致） |
| 超量價（資料庫磁碟） | — | US$0.125／GB／月（gp3） | 磁碟說明 |
| 檔案儲存 | 1 GB | 100 GB | 定價頁、計費說明（一致） |
| 流量（egress） | 5 GB（另有 5 GB cached egress） | 250 GB；超量 US$0.09／GB | 定價頁；cached egress 只出現在定價頁 |
| 專案數 | 2 個 active | 見定價頁 | 定價頁 |
| 閒置 | 閒置一週會被暫停（paused） | — | 定價頁 |

其他說明：
- Free 專案的磁碟固定 2 GB；「500 MB」是計費配額，不會觸發唯讀。磁碟用量達 95% 才進入唯讀（磁碟說明、資料庫大小說明）。**超過 500 MB 配額時 Free 方案實際會怎樣（限制、停權或要求升級）：待確認**，這兩頁沒有寫，升級決策前請 Matt 在後台或官方客服確認。
- 「閒置一週暫停」：站上有流量就不算閒置；若某段時間完全沒人用，專案可能被暫停，要在後台手動恢復。風險評估：待 Matt 決定。
- Pro 實際帳單可能含運算（compute）額度與其他項目，本檔只列定價頁明列的數字；實際月費：待確認（M11.4 升級前再查）。

## 3. 資料庫實際大小：請 Matt 在後台讀取（anon 無法取得）

位置（依官方文件）：
1. 專案後台 → **Database → Reports**（文件「database-size」寫「Database Reports page」），看 Database size。
2. 組織層級用量：`https://supabase.com/dashboard/org/_/usage`（磁碟說明寫「You can view Disk size usage on the organization's usage page」），看 Database size、Egress、Storage 的本月與上月數字。
3. 或在 SQL Editor 執行（只讀）：

```sql
select pg_size_pretty(pg_database_size(current_database()));
select relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) as total_size
from pg_stat_user_tables order by pg_total_relation_size(relid) desc;
```

請 Matt 填入（2026-11-17 當下或最近一次）：

| 欄位 | 數字 | 讀取日期 |
| --- | --- | --- |
| 資料庫大小（MB） | ＿＿＿ | ＿＿＿ |
| restaurants 含索引（MB） | ＿＿＿ | |
| foods 含索引（MB） | ＿＿＿ | |
| price_verifications 含索引（MB） | ＿＿＿ | |
| food_tags 含索引（MB） | ＿＿＿ | |
| menu_images 列數 | ＿＿＿ | |
| 本月 egress（GB）／上限 5 GB | ＿＿＿ | |
| 檔案儲存用量（GB）／上限 1 GB | ＿＿＿ | |

填完後用 `python3 scripts/capacity.py estimate --stores 2413 --foods 87201 --tags 371 --verifs 87201 --measured-mb <資料庫大小>` 重算「每 1,000 家占用」，取代下面的估算。

### 估算（假設，非量測）

每列估計位元組（含 tuple 標頭 24 B、對齊、索引項；中文一字約 3 B）：

| 表 | 每列（低–高） | 假設 |
| --- | --- | --- |
| restaurants | 450–700 B | 店名、地址、Google Maps 連結文字；2 個 double；uuid；2 個 timestamptz；索引：pkey、(lat,lng)、unique(name,address) |
| foods | 300–450 B | 3 個 uuid、品名約 25 字、description 空字串、price、2 個 timestamptz；索引：pkey、unique(restaurant_id,name)、price、category、restaurant |
| food_tags | 100–150 B | 2 個 uuid；複合 pkey、category 索引 |
| price_verifications | 150–250 B | 2 個 uuid、短文字、numeric、2 個 timestamptz；pkey、(food_id, verified_at) |

結果（`scripts/capacity.py estimate`）：
- 每 1,000 家店估計 **16.7–26.0 MB**（foods 10.8–16.3、price_verifications 5.4–9.0、restaurants 0.5–0.7、food_tags 0.02）。
- 目前 2,413 家估計 40–63 MB，約為免費 500 MB 的 8–13%。
- 系統基底（Postgres 目錄、Supabase 內建 schema、extension）未知，下表假設 0／50／100 MB 三種；以免費上限 500 MB 推估可容納店數（含現有 2,413 家）：

| 系統基底（假設） | 可容納店數（估算） |
| --- | --- |
| 0 MB | 約 19,200–29,900 家 |
| 50 MB | 約 17,300–26,900 家 |
| 100 MB | 約 15,400–23,900 家 |

- M11.4 規定「用量達免費上限 70%」前提出升級方案：以 350 MB、基底 50 MB 估，約在 **11,500–17,900 家**時到達；實測大小填入後請重算。
- 此估算只含資料列與索引，不含 WAL、pending 使用者回報、未來新增的索引（M11.4 若新增 migration 要重估）。若實測每家占用高於上表，以實測為準。

## 4. 流量（egress）參考

一次冷載入的實測（2026-11-17，用 `src/repositories/supabase.ts` 同樣的查詢：500 m＋150 m 緩衝、restaurants 方框、foods 內嵌 food_tags 與 price_verifications；不含 categories、menu_images）：

| 區域 | 店數 | 餐點數 | 傳輸量（gzip） | 解壓後 |
| --- | --- | --- | --- | --- |
| 南港 | 117 | 1,713 | 約 146 KB | 約 1.4 MB |
| 信義 | 119 | 1,673 | 約 145 KB | 約 1.3 MB |

估算：Free 5 GB／約 145 KB ≈ 3.5 萬次冷載入／月（未計 cached egress、前端記憶體快取、其他請求與標頭）。單次載入量跟 500 m 內店數有關，與全台總店數無關；密集區（店數多）每次會更大。實際本月 egress 請 Matt 填 §3 表格。

## 5. OCR 單位時間（`data/ocr-run.log`，Mac，程式算）

log 每行只有 `HH:MM <店號> ok|失敗`，**沒有日期、沒有同時家數**，所以「場次」是依時間倒退或間隔 > 90 分鐘推測切開（9 場）；同時家數以 `run_ocr.sh` 預設 2 推算。

| 項目 | 數字 |
| --- | --- |
| log 行數 | 3,216 |
| 記錄的成功辨識 | 2,521 家 |
| 記錄的失敗 | 687 行（其中 653 行集中在場次 2；該場次成功 518） |
| 額度用完訊息 | 4 場各 2 行（場次 4、6、7、8） |
| 整體每家平均（無失敗、≥ 20 家的場次） | **12.3 秒／家**（同時 2 家 → 單家約 25 秒） |
| 各場次範圍 | 8.6–22.7 秒／家（最快場次 9：224 家 32 分；最慢場次 4：149 家 56 分，含額度停止） |
| 700 家需時 | 約 2.4 小時（700 × 12.3 秒） |
| 3,070 家全跑需時 | 約 10.5 小時（算術值，不含額度中斷） |

每日完成數：log 沒有日期，改用 `data/ocr-raw/*.json` 的檔案修改日期（UTC+8）計數（共 2,735 檔；假設檔案之後沒被重寫或搬移）：

| 日期 | 完成數 |
| --- | --- |
| 10-31 | 212 |
| 11-01 | 223 |
| 11-02 | 764 |
| 11-03 | 408 |
| 11-04 | 301 |
| 11-05 | 11 |
| 11-07 | 592 |
| 11-15 | 224 |

有紀錄的 8 天平均 342 家／天，最大單日 764。M11 規格寫的「約 700 家／天」只在 11/02（764）與 11/07（592）接近，其餘日子是自己停手或遇額度。結論：以 700 家／天為上限規劃，實際每晚跑多少要看額度何時用完（`run_ocr.sh` 遇 429 自動停）。

未量測：下載每家秒數（`download_menus.py` 內建每家 5–9 秒休息加頁面載入，估計遠慢於 OCR）與 discover 秒數。試跑「台北車站」20 家時，`data/pipeline.log` 的時間戳可直接算；請把結果回填這裡。

## 6. 結論與待辦

- 資料庫在免費 500 MB 內可撐到約 1.5–2.7 萬家（估算，基底 50 MB 假設）；全台擴張的第 1 圈到第 1c 圈（雙北）遠低於此。實測資料庫大小填入後重算；達 350 MB（70%）時依 M11.4 提升級方案。
- 瓶頸不是資料庫，而是 OCR 額度（約 700 家／天，實際日完成數 11–764）與 Google 地圖下載速度（未量測）。
- Free 方案「閒置一週暫停」與「超過 500 MB 配額的實際行為」待確認。
- 待 Matt 補：§3 表格（資料庫實際大小、各表大小、menu_images 列數、本月 egress、儲存用量）。
