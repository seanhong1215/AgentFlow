# 綠界 ECPay 金流整合

**狀態**：✅ 完成（2026-06-08）

## User Story

身為使用者，我希望可以在訂單詳情頁透過綠界 ECPay 信用卡完成真實付款，而不只是模擬付款。

## 技術約束

- 本專案僅運行於本地端（localhost），無法接收綠界的 Server-to-Server ReturnURL 回呼
- 改用 `OrderResultURL`（瀏覽器 Form POST）接收付款結果，本機可正常運作
- 另提供 `QueryTradeInfo` API 主動查詢作為備援

## Spec

- 協議：AIO CMV-SHA256（全方位金流）
- 付款方式：信用卡（`ChoosePayment=Credit`）
- 測試帳號：MerchantID=3002607，HashKey=pwFHCqoQZGmho4w6，HashIV=EkRm7iFT261dpevs
- `MerchantTradeNo` 格式：`EC` + 13 位 Unix ms timestamp（最多 15 字元）

## 實作任務

- [x] `src/utils/ecpay.js` — CheckMacValue、buildPaymentParams、queryEcpayTrade
- [x] `src/database.js` — ALTER TABLE orders ADD COLUMN ecpay_trade_no TEXT
- [x] `src/routes/ecpayRoutes.js` — 4 個端點
- [x] `app.js` — 掛載 /api/ecpay 路由
- [x] `views/pages/order-detail.ejs` — 加入 ECPay 付款主按鈕
- [x] `public/js/pages/order-detail.js` — payWithEcpay 函式
- [x] `docs/FEATURES.md` — 新增 ECPay 章節
- [x] `docs/CHANGELOG.md` — 記錄 v1.1.0
