# 更新日誌

格式依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，版本號遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

---

## [1.1.0] — 2026-06-08

### 新增
- 綠界 ECPay AIO 金流整合（CMV-SHA256，信用卡付款）
  - `POST /api/ecpay/initiate`：產生付款表單參數（含 CheckMacValue）
  - `POST /api/ecpay/order-result`：接收綠界瀏覽器重導，驗簽後更新訂單狀態
  - `POST /api/ecpay/notify`：接收綠界 Server-to-Server 通知（部署後使用）
  - `GET /api/ecpay/query/:orderId`：主動呼叫 QueryTradeInfo 查詢付款結果（本機備援）
- `orders.ecpay_trade_no` 欄位（自動 ALTER TABLE 遷移，不影響現有資料）
- `src/utils/ecpay.js`：`ecpayUrlEncode`、`generateCheckMacValue`、`verifyCheckMacValue`、`buildPaymentParams`、`queryEcpayTrade`
- 訂單詳情頁新增「使用綠界付款（信用卡）」主按鈕；原模擬按鈕降為次要（測試用）

### 架構說明
- 本機開發無法接收 ReturnURL（S2S），改以 `OrderResultURL`（瀏覽器 POST）更新付款結果
- 測試環境 MerchantID: 3002607，設定於 `.env.example`

---

## [1.0.0] — 2026-06-08

### 新增
- Express + EJS 花卉電商平台初始架構
- 使用者認證：註冊、登入、個人資料（JWT，HS256，7 天）
- 商品管理：公開列表（分頁）與詳情
- 購物車：雙模式認證（JWT + X-Session-Id 訪客模式），累加邏輯
- 訂單系統：建立訂單（Transaction 保護，扣庫存 + 清購物車），列表、詳情、模擬付款
- 管理員後台：商品 CRUD（含刪除守衛）、訂單列表（狀態篩選）+ 詳情
- 前台 EJS 頁面：首頁、商品詳情、購物車、結帳、登入、訂單列表、訂單詳情
- 後台 EJS 頁面：商品管理、訂單管理
- Vue CDN 前端互動（各頁面獨立 JS）
- Tailwind CSS 4 樣式
- Vitest + Supertest 整合測試（6 個測試檔）
- swagger-jsdoc OpenAPI 3.0 文件生成
- SQLite 種子資料（8 種花卉商品 + 管理員帳號）
- `.claude/` 專案設定集（settings.json、rules）
- `docs/` 完整專案文件（README、ARCHITECTURE、DEVELOPMENT、FEATURES、TESTING、CHANGELOG）
