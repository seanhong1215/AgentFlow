# 更新日誌

## 2026-05-30

### Changed

- 訂單詳情頁改為在綠界「返回商店」後自動查詢付款狀態，成功時立即更新訂單付款資訊。
- 綠界付款送出前會驗證 checkout action 必須是綠界 HTTPS AIO endpoint，並使用一次性 hidden form 降低重複送出或轉址錯誤機率。
- 訂單詳情頁新增顯示綠界交易編號、付款方式、付款時間與最近確認時間。
- 綠界 checkout 改為每次付款嘗試產生新的 `MerchantTradeNo`，failed 訂單可重新付款且本地 `order_no` 保持不變。
- 返回商店後若自動確認仍未付款，訂單會更新為 `failed`；`failed` 訂單不再顯示「重新確認付款狀態」按鈕。
- 綠界 AIO checkout 新增 `OrderResultURL=/orders/:id?payment=result`，處理付款頁選擇付款方式或立即付款後發生錯誤仍導回本地的流程。
- 訂單詳情頁在 `payment=result` 導回時會先查詢 `QueryTradeInfo`；若無法確認已付款，會呼叫 `/api/orders/:id/ecpay/fail` 強制寫入 `failed`。

### Verified

- 已以 `$env:JWT_SECRET='test-secret'; npm test` 驗證完整測試。
- 已以 `.\node_modules\.bin\vitest.cmd run tests\ecpay.test.js` 驗證綠界付款測試，12 個 tests 通過。

### Added

- 新增 `AGENTS.md`，整理專案概述、常用指令、關鍵開發規則與詳細文件索引。
- 新增 `docs/README.md`，整理項目介紹、技術棧、快速開始、常用指令與文件索引。
- 新增 `docs/ARCHITECTURE.md`，記錄 Express/EJS/Vue/SQLite 架構、目錄檔案用途、啟動流程、API 路由、統一回應格式、JWT/admin/cart dual-mode auth、資料庫 schema 與第三方整合。
- 新增 `docs/DEVELOPMENT.md`，記錄命名規則、CommonJS/browser global 模組規則、新增 API/middleware/DB 流程、環境變數、OpenAPI JSDoc 格式與計畫歸檔流程。
- 新增 `docs/FEATURES.md`，依功能區塊記錄 Auth、Products、Cart、Orders、ECPay、Admin Products、Admin Orders 的完成狀態、行為、參數、錯誤碼與非標準機制。
- 新增 `docs/TESTING.md`，整理測試策略、執行方式、測試檔案表、helper 說明、撰寫新測試步驟與常見陷阱。
- 新增 `docs/plans/` 與 `docs/plans/archive/`，作為開發計畫與完成計畫歸檔目錄。
- 新增 `docs/plans/2026-05-30-ecpay-payment-integration.md`，記錄綠界付款串接的 User Story、Spec 與 Tasks。
- 新增 `src/services/ecpayService.js`，集中處理綠界 AIO endpoint、台灣時間格式、`MerchantTradeNo`、`ItemName`、CheckMacValue、checkout params 與 `QueryTradeInfo` 查詢。
- 新增 `POST /api/orders/:id/ecpay/checkout`，為會員訂單產生綠界 AIO hidden form 參數。
- 新增 `POST /api/orders/:id/ecpay/query`，由本地後端主動呼叫綠界 `QueryTradeInfo` 驗證付款結果。
- 新增 `POST /api/orders/:id/ecpay/fail`，讓瀏覽器結果導回但未付款成功時可由本地端落實付款失敗狀態，且禁止覆寫已付款訂單。
- 新增 `POST /api/ecpay/notify`，在本地端可被打到時回應綠界 AIO 所需的 `1|OK` acknowledgement。
- 新增 `tests/ecpay.test.js`，覆蓋 CheckMacValue、checkout params、paid/unpaid 查詢、金額不一致與查詢失敗。

### Changed

- `orders` 資料表新增綠界欄位：`ecpay_merchant_trade_no`、`ecpay_trade_no`、`ecpay_payment_type`、`ecpay_payment_date`、`ecpay_trade_status`、`ecpay_query_raw`、`payment_checked_at`。
- `src/database.js` 新增 migration helper，讓既有本機 `database.sqlite` 可自動補上新欄位與 index。
- 訂單詳情頁移除主要的付款模擬操作，改為「前往綠界付款」與返回商店後自動確認付款狀態。
- `.env.example` 補上 `ECPAY_RETURN_URL`。
- `vitest.config.js` 加入 `tests/ecpay.test.js` 的固定執行順序。
- 文件全面同步本地端綠界架構：localhost 無法依賴 Server Notify，付款結果以主動查詢 `QueryTradeInfo` 為準。

### Verified

- 已執行 `npm install`。
- 已以 PowerShell 指令 `$env:JWT_SECRET='test-secret'; npm test` 驗證完整測試。
- 先前完整 suite 結果：7 個 test files 通過，39 個 tests 通過。
- 綠界付款狀態修正後，目標測試 `tests/ecpay.test.js` 結果：12 個 tests 通過。

### Notes

- 綠界測試環境預設使用官方測試特店 `2000132`、HashKey `5294y06JbISpM5x9`、HashIV `v77hoKGq4kWxNNIS`。
- 測試付款可使用信用卡 `4311-9522-2222-2222`、任意三碼 CVV、3D 驗證碼 `1234`。
- 本專案仍保留舊的 `PATCH /api/orders/:id/pay` 端點作為開發/測試用付款狀態切換，但正式付款流程應使用 ECPay checkout + query。
