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
