# PriceEats 路線圖（2026-11-01）

原則：先把南港資料收完整，再做 App；數字一律程式算；能交 agy 就交 agy。

## 階段 1　南港收齊（11/1–11/9）
| 步驟 | 誰 | 指令／產出 | 完成標準 |
|---|---|---|---|
| OCR 跑完 | Mac 本機 agy | caffeinate -i bash scripts/run_ocr.sh 2 | ocr-queue 剩 0 |
| 品質檢查 | Claude | python3 scripts/qa_check.py → data/qa-report.md | 飲料／加料／重複清零或確認 |
| 匯入 | Claude | npm run import:menu -- data/menus-maps2 | 跳過品項 < 1% |
| 第 4 輪補洞 | Matt | bash scripts/collect.sh --query-file data/queries/round4.txt | 新店 < 本輪搜尋結果 10% 即視為飽和 |
| 進度盤點 | 任何人 | python3 scripts/coverage.py | 2 km 內「待辨識」= 0 |

## 階段 1.5　擴區（Matt 11/1 決定優先於補舊）
- 內湖科技園區、信義（市政府站）、松山（松山車站）：data/areas.json、data/queries/area-*.txt
- 網站地點選單：正式模式只列南港、內湖科技園區、市政府站、松山車站

## 階段 2　補舊、補缺（擴區後）
- 照片早於 12 個月：python3 scripts/refresh_stale.py 印出重抓指令（目前約 114 家）
- 沒菜單分頁（13 家）：下載器加「一般相片找價目表」備援，agy 判斷是否為菜單
- 連鎖店：同品牌多分店共用最新價目（需 Matt 決定是否允許）

## 階段 3　維運自動化（11 月底）
- 發布：scripts/publish.sh 取代網頁拖放（一次性 gh auth login）
- 每月 1 日：refresh_stale → run_ocr → qa_check → import（Mac launchd 排程，Chrome 需登入）
- 交接文件每批更新

## 階段 4　App 整理（資料完整後）
- 小菜判斷：分類＋名稱＋價格綜合規則，主餐預設不出現 30–40 元小菜
- 新鮮度：菜單照改 6／12 個月分級，取代 30／90 天「舊資料」
- 搜尋：依餐點名稱、份量（小／大）合併顯示
- 評價：Google 地圖連結保留，不自建評分

## 階段 5　擴區（南港飽和後再決定）
- 候選：內湖科技園區、汐止、信義；discover/coverage 的中心座標改為參數
