# PriceEats 菜單 OCR 規則（agy 執行者用）

## 任務
1. 用 read_file 讀 /Users/jingjhongchen/Downloads/priceeats-mvp/data/ocr-queue.md。
2. 清單裡的路徑都是相對路徑，前面加上 /Users/jingjhongchen/Downloads/priceeats-mvp/ 成為完整路徑。每一家（## 開頭）依序處理：用 read_file 讀「照片」路徑的圖，抽出菜單，用寫檔工具寫到「輸出」路徑。
3. 一家寫完再做下一家。全部做完只回覆一行：完成 N 家：編號(道數)、編號(道數)…；失敗的寫「編號 失敗：原因」。

## 輸出檔格式（只寫 JSON，不要其他文字）
{"source_image":"google-maps-menu-photo-N","items":[{"name":"品名（份量）","price":整數,"category":"分類","confidence":0.9}]}
- source_image：用最新那張的檔名去掉 .jpg。
- category 只能是：便當、飯類、麵食、肉類、海鮮、早餐、小吃、自助餐。
- 每顆計價（鍋貼、水餃）：price 寫單顆價，加 "per_piece":true。

## 收錄規則
- 只收有明確價格的餐點。不收：飲料、甜點、加料（起司、蛋、蔥）、醬料、冷凍或外帶包裝品、家庭號。
- 同品名不同份量（小/大、迷你/中/大碗）拆成多筆，份量寫在括號。
- 套餐與單點都有時，單點寫「品名（單點）」，不要寫成「XX飯（單點）」。
- 兩張照片有同一道菜時，只留一筆，用較新照片的價格。
- 字看不清 confidence 寫 0.6 以下；看不到價格就不要收。不要用記憶補價格或品項。
- 讀不到圖：該家輸出 {"error":"錯誤訊息"}。
