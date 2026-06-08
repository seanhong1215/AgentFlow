# 架構文件

## 架構總覽

本專案是單一 Express app，同時提供 API、EJS page routes 與靜態資源。`server.js` 只負責檢查必要環境變數與啟動 HTTP server；`app.js` 建立 Express instance、掛載 middleware、API routes、page routes、404 handler 與 error handler。

資料層使用本地 `database.sqlite`。`src/database.js` 在被 require 時建立 SQLite connection、開啟 WAL 與 foreign keys、建立 schema、執行欄位 migration、建立 admin seed 與商品 seed。所有 route 直接透過 `db.prepare()` 使用 SQL，沒有 ORM。

前端不是前後端分離 build。頁面由 EJS render，layout 載入 Vue 3 CDN、`Auth`、`apiFetch`、`Notification` 等 browser global，再依 `pageScript` 載入每頁 script。

綠界付款採 AIO 跳轉付款。因本專案僅在 localhost 執行，Server Notify 不可作為付款最終確認；付款完成後，使用者按「返回商店」回到本地訂單頁，頁面會自動觸發後端 `QueryTradeInfo` 查詢，後端驗證 CheckMacValue、金額與交易狀態後才更新訂單。

## 目錄與檔案用途

| 檔案 / 目錄 | 用途 |
| --- | --- |
| `app.js` | 建立 Express app；設定 EJS、static files、CORS、body parser、session middleware、API routes、page routes、404 與 error handler |
| `server.js` | dev/production server entry；檢查 `JWT_SECRET`；監聽 `PORT || 3001` |
| `src/database.js` | SQLite connection、WAL、foreign keys、schema、migration、seed admin、seed products、匯出 db instance |
| `src/middleware/authMiddleware.js` | 驗證 `Authorization: Bearer <jwt>`，查詢 user 是否存在，寫入 `req.user` |
| `src/middleware/adminMiddleware.js` | 確認 `req.user.role === 'admin'`，否則回 403 |
| `src/middleware/sessionMiddleware.js` | 讀取 `X-Session-Id` header 並寫入 `req.sessionId` |
| `src/middleware/errorHandler.js` | 最後一層 error middleware，輸出一致 JSON error |
| `src/services/ecpayService.js` | 綠界 endpoint、台灣時間、交易編號、ItemName、CheckMacValue、checkout params、QueryTradeInfo |
| `src/routes/authRoutes.js` | 註冊、登入、profile API |
| `src/routes/productRoutes.js` | 前台商品列表與商品詳情 API |
| `src/routes/cartRoutes.js` | 訪客/會員雙模式購物車 API |
| `src/routes/orderRoutes.js` | 會員訂單 API、綠界 checkout/query、開發用付款狀態切換 |
| `src/routes/ecpayRoutes.js` | 綠界 ReturnURL/Notify acknowledgement，回 `1|OK` |
| `src/routes/adminProductRoutes.js` | 管理員商品 CRUD API |
| `src/routes/adminOrderRoutes.js` | 管理員訂單列表與詳情 API |
| `src/routes/pageRoutes.js` | EJS page routes，指定前台與後台頁面及 `pageScript` |
| `views/layouts/front.ejs` | 前台 layout，載入 Vue、Auth、apiFetch、Notification、header-init 與頁面 script |
| `views/layouts/admin.ejs` | 後台 layout，載入 Vue、Auth、apiFetch、Notification，並檢查 admin |
| `views/partials/*.ejs` | head、header、footer、admin sidebar、notification 等 partial |
| `views/pages/index.ejs` | 前台商品列表頁 |
| `views/pages/product-detail.ejs` | 商品詳情頁 |
| `views/pages/cart.ejs` | 購物車頁 |
| `views/pages/checkout.ejs` | 結帳頁 |
| `views/pages/login.ejs` | 登入/註冊頁 |
| `views/pages/orders.ejs` | 會員訂單列表頁 |
| `views/pages/order-detail.ejs` | 會員訂單詳情與綠界付款頁 |
| `views/pages/admin/products.ejs` | 管理員商品管理頁 |
| `views/pages/admin/orders.ejs` | 管理員訂單查詢頁 |
| `public/js/auth.js` | localStorage token/user/session 管理、auth headers、登入狀態 helper |
| `public/js/api.js` | fetch wrapper；自動加 JSON header 與 auth headers，統一處理 401 |
| `public/js/header-init.js` | 前台 header 登入狀態、會員選單、購物車 badge |
| `public/js/notification.js` | 前端通知元件 |
| `public/js/pages/index.js` | 商品列表、分頁、加入購物車 |
| `public/js/pages/product-detail.js` | 商品詳情、數量控制、加入購物車 |
| `public/js/pages/cart.js` | 購物車列表、數量更新、刪除、前往結帳 |
| `public/js/pages/checkout.js` | 收件資料表單、建立訂單 |
| `public/js/pages/login.js` | 登入/註冊 tab、token 寫入 localStorage |
| `public/js/pages/orders.js` | 會員訂單列表 |
| `public/js/pages/order-detail.js` | 訂單詳情、ECPay hidden form submit、返回商店後自動 QueryTradeInfo 查詢 |
| `public/js/pages/admin-products.js` | 管理員商品 CRUD UI |
| `public/js/pages/admin-orders.js` | 管理員訂單列表、狀態篩選、詳情 modal |
| `public/css/input.css` | Tailwind source |
| `public/css/output.css` | Tailwind output |
| `public/stylesheets/style.css` | 額外自訂 CSS |
| `swagger-config.js` | OpenAPI 基礎設定與 security schemes |
| `generate-openapi.js` | 執行 swagger-jsdoc 產生 `openapi.json` |
| `vitest.config.js` | Vitest 設定、固定測試順序、關閉檔案平行 |
| `tests/setup.js` | Supertest app、admin login helper、register helper |
| `tests/*.test.js` | API integration tests |
| `.env.example` | JWT、server、admin seed、ECPay 設定範例 |

## 啟動流程

1. `server.js` require `./app`。
2. `app.js` 執行 `require('dotenv').config()` 載入 `.env`。
3. `app.js` require `src/database.js`，初始化 SQLite。
4. `src/database.js` 建立 `database.sqlite` connection，設定 `journal_mode = WAL` 與 `foreign_keys = ON`。
5. `initializeDatabase()` 建立 `users`、`products`、`cart_items`、`orders`、`order_items`。
6. `migrateDatabase()` 用 `PRAGMA table_info` 補上綠界相關欄位，並建立 `idx_orders_ecpay_merchant_trade_no` partial unique index。
7. `seedAdminUser()` 使用 `ADMIN_EMAIL`、`ADMIN_PASSWORD` 建立 admin；`NODE_ENV=test` 時 bcrypt rounds 為 1，其餘為 10。
8. `seedProducts()` 在 products 為空時建立預設商品。
9. `app.js` 設定 EJS views、static middleware、CORS、JSON/urlencoded parser、session middleware。
10. API routes 依序掛載 auth、admin products、admin orders、products、cart、orders、ecpay。
11. Page routes 掛載於 `/`。
12. API 404 回 JSON；非 API 404 render `pages/404`。
13. `errorHandler` 作為最後 middleware。
14. `server.js` 檢查 `JWT_SECRET`，若缺少則輸出 fatal 並 `process.exit(1)`；否則 listen。

## API 路由總覽

| 前綴 | 檔案 | 認證 | 說明 |
| --- | --- | --- | --- |
| `/api/auth` | `src/routes/authRoutes.js` | register/login 無；profile Bearer JWT | 註冊、登入、會員資料 |
| `/api/products` | `src/routes/productRoutes.js` | 無 | 前台商品列表與詳情 |
| `/api/cart` | `src/routes/cartRoutes.js` | Bearer JWT 或 `X-Session-Id` | 訪客/會員購物車 |
| `/api/orders` | `src/routes/orderRoutes.js` | Bearer JWT | 建立訂單、查詢訂單、開發用付款狀態切換 |
| `/api/orders/:id/ecpay` | `src/routes/orderRoutes.js` | Bearer JWT | 產生綠界付款表單參數、主動查詢付款結果 |
| `/api/ecpay` | `src/routes/ecpayRoutes.js` | 無 | 綠界 ReturnURL acknowledgement，回 `1|OK` |
| `/api/admin/products` | `src/routes/adminProductRoutes.js` | Bearer JWT + admin role | 管理員商品 CRUD |
| `/api/admin/orders` | `src/routes/adminOrderRoutes.js` | Bearer JWT + admin role | 管理員訂單列表與詳情 |
| `/` | `src/routes/pageRoutes.js` | 頁面本身不認證；前端 script 自行檢查 | EJS 頁面 |

## 統一回應格式

成功：

```json
{
  "data": {
    "id": "uuid",
    "status": "pending"
  },
  "error": null,
  "message": "成功訊息"
}
```

失敗：

```json
{
  "data": null,
  "error": "VALIDATION_ERROR",
  "message": "可安全顯示給使用者的錯誤訊息"
}
```

列表 API 通常使用 `data.<resource>` 與 `data.pagination`：

```json
{
  "data": {
    "products": [],
    "pagination": {
      "total": 0,
      "page": 1,
      "limit": 10,
      "totalPages": 0
    }
  },
  "error": null,
  "message": "成功訊息"
}
```

## 認證與授權

### JWT

| 參數 | 值 |
| --- | --- |
| Algorithm | HS256 |
| Secret | `process.env.JWT_SECRET` |
| Payload | `{ userId, email, role }` |
| expiresIn | `7d` |
| Header | `Authorization: Bearer <token>` |

`authMiddleware` 行為：

1. 檢查 `Authorization` header 是否存在且以 `Bearer ` 開頭。
2. 使用 `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })` 驗證。
3. 依 decoded `userId` 查詢 `users`。
4. user 存在時寫入 `req.user = { userId, email, role }`。
5. token 缺失、格式錯誤、過期、簽章錯誤或 user 不存在時回 401。

### 管理員授權

`adminMiddleware` 必須接在 `authMiddleware` 後方。若 `req.user` 不存在或 `role !== 'admin'`，回 403 `FORBIDDEN`。`/api/admin/products` 與 `/api/admin/orders` 在 router level 使用 `router.use(authMiddleware, adminMiddleware)`。

### 購物車雙模式認證

`cartRoutes.js` 內部定義 `dualAuth`：

1. 若有 Bearer token，優先驗證 JWT。
2. JWT 有效時使用 `req.user.userId`，owner 欄位為 `user_id`。
3. JWT header 存在但 token 無效時直接回 401，不 fallback 到 session。
4. 若沒有 Bearer token，檢查 `sessionMiddleware` 寫入的 `req.sessionId`。
5. 有 `req.sessionId` 時，owner 欄位為 `session_id`。
6. 兩者皆無時回 401。

## 資料庫 Schema

### `users`

| 欄位 | 型別 | 約束 | 說明 |
| --- | --- | --- | --- |
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `email` | TEXT | UNIQUE NOT NULL | 登入 email |
| `password_hash` | TEXT | NOT NULL | bcrypt hash |
| `name` | TEXT | NOT NULL | 使用者名稱 |
| `role` | TEXT | NOT NULL DEFAULT `'user'`, CHECK `role IN ('user', 'admin')` | 權限角色 |
| `created_at` | TEXT | NOT NULL DEFAULT `datetime('now')` | 建立時間 |

### `products`

| 欄位 | 型別 | 約束 | 說明 |
| --- | --- | --- | --- |
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `name` | TEXT | NOT NULL | 商品名稱 |
| `description` | TEXT | nullable | 商品描述 |
| `price` | INTEGER | NOT NULL, CHECK `price > 0` | 新台幣金額 |
| `stock` | INTEGER | NOT NULL DEFAULT 0, CHECK `stock >= 0` | 庫存 |
| `image_url` | TEXT | nullable | 商品圖片 URL |
| `created_at` | TEXT | NOT NULL DEFAULT `datetime('now')` | 建立時間 |
| `updated_at` | TEXT | NOT NULL DEFAULT `datetime('now')` | 更新時間 |

### `cart_items`

| 欄位 | 型別 | 約束 | 說明 |
| --- | --- | --- | --- |
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `session_id` | TEXT | nullable | 訪客購物車 owner |
| `user_id` | TEXT | nullable, FK `users(id)` | 會員購物車 owner |
| `product_id` | TEXT | NOT NULL, FK `products(id)` | 商品 ID |
| `quantity` | INTEGER | NOT NULL DEFAULT 1, CHECK `quantity > 0` | 數量 |

注意：schema 未強制 `session_id` 與 `user_id` 二選一，也未建立 `(owner, product_id)` unique constraint；累加購物車品項的邏輯在 `cartRoutes.js` 中處理。

### `orders`

| 欄位 | 型別 | 約束 | 說明 |
| --- | --- | --- | --- |
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `order_no` | TEXT | UNIQUE NOT NULL | 格式 `ORD-YYYYMMDD-XXXXX` |
| `user_id` | TEXT | NOT NULL, FK `users(id)` | 下單會員 |
| `recipient_name` | TEXT | NOT NULL | 收件人 |
| `recipient_email` | TEXT | NOT NULL | 收件 email |
| `recipient_address` | TEXT | NOT NULL | 收件地址 |
| `total_amount` | INTEGER | NOT NULL | 訂單總額 |
| `status` | TEXT | NOT NULL DEFAULT `'pending'`, CHECK `status IN ('pending', 'paid', 'failed')` | 付款狀態 |
| `created_at` | TEXT | NOT NULL DEFAULT `datetime('now')` | 建立時間 |
| `ecpay_merchant_trade_no` | TEXT | nullable, partial UNIQUE index | 綠界特店交易編號，英數且不超過 20 字元 |
| `ecpay_trade_no` | TEXT | nullable | 綠界交易編號 |
| `ecpay_payment_type` | TEXT | nullable | 綠界回傳付款方式 |
| `ecpay_payment_date` | TEXT | nullable | 綠界回傳付款時間 |
| `ecpay_trade_status` | TEXT | nullable | `QueryTradeInfo` 回傳交易狀態 |
| `ecpay_query_raw` | TEXT | nullable | 最近一次查詢結果 JSON 字串 |
| `payment_checked_at` | TEXT | nullable | 最近一次主動查詢時間 |

### `order_items`

| 欄位 | 型別 | 約束 | 說明 |
| --- | --- | --- | --- |
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `order_id` | TEXT | NOT NULL, FK `orders(id)` | 所屬訂單 |
| `product_id` | TEXT | NOT NULL, FK `products(id)` | 商品 ID |
| `product_name` | TEXT | NOT NULL | 下單當下商品名稱快照 |
| `product_price` | INTEGER | NOT NULL | 下單當下商品價格快照 |
| `quantity` | INTEGER | NOT NULL | 下單數量 |

## 主要資料流

### 註冊 / 登入

前端送出 email/password/name 或 email/password。後端驗證必填、email 格式與密碼長度，註冊時檢查 email 是否已存在，使用 bcrypt hash 密碼後建立 user。登入時使用 bcrypt compare。成功後簽發 7 天 JWT，前端 `Auth.login()` 將 token 與 user summary 存入 localStorage。

### 商品與購物車

商品列表與詳情為公開 API。加入購物車可使用訪客 session 或會員 token。若同一 owner 已有同一商品，`POST /api/cart` 會累加數量，且確認累加後不可超過庫存；若不存在則新增 cart item。購物車總額由後端以商品目前價格與 cart quantity 計算。

### 結帳建立訂單

結帳頁需登入。`POST /api/orders` 只讀取 `cart_items.user_id = req.user.userId` 的購物車，不會讀訪客 session cart。建立訂單前驗證收件資料與 email，確認購物車非空，並逐項檢查 quantity 不超過商品 stock。transaction 內依序 insert `orders`、insert `order_items`、扣 `products.stock`、刪除會員 `cart_items`。

### 綠界付款流程

`.env.example` 有 ECPay 設定：`ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`、`ECPAY_ENV`、`ECPAY_RETURN_URL`。付款使用 AIO hidden form 全頁跳轉。

流程：

1. 使用者完成結帳，建立 `pending` 訂單。
2. 訂單詳情頁呼叫 `POST /api/orders/:id/ecpay/checkout`。
3. 後端確認訂單屬於目前會員且狀態為 `pending`。
4. 後端每次 checkout 都產生新的 `ecpay_merchant_trade_no` 並存回 `orders`；本地 `order_no` 不變。這避免綠界因 `MerchantTradeNo` 重複而拒絕重新付款。
5. 若訂單狀態是 `failed`，checkout 會將本地訂單狀態重設為 `pending`，並清空舊的綠界付款資訊，讓使用者可以重新付款。
6. `ecpayService.buildCheckoutParams()` 組 AIO 參數，包含 `PaymentType=aio`、`ChoosePayment=ALL`、`EncryptType=1`、`ReturnURL`、`OrderResultURL`、`ClientBackURL` 與 CheckMacValue。
7. 前端建立 hidden form，POST 到 `https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5` 或正式 endpoint。
8. 使用者付款後可透過 `ClientBackURL` 回到 `/orders/:id?payment=returned`；若綠界付款頁有瀏覽器結果導回，會導到 `OrderResultURL`：`/orders/:id?payment=result`。
9. 訂單詳情頁偵測 `payment=returned` 後自動呼叫 `POST /api/orders/:id/ecpay/query`；若綠界資料尚未同步，前端會短時間重試。
10. 訂單詳情頁偵測 `payment=result` 或 `payment=failed` 時，會先呼叫 `POST /api/orders/:id/ecpay/query`；若無法確認 `paid`，再呼叫 `POST /api/orders/:id/ecpay/fail` 將本地訂單強制寫入 `failed`，避免停留在 `pending` 且不再顯示重新確認付款按鈕。
11. 後端每次查詢產生新的 Unix `TimeStamp`，送到 `QueryTradeInfo/V5`。
11. 後端解析 URL-encoded response，驗證 response CheckMacValue。
12. 後端比對 `TradeAmt` 與本地 `orders.total_amount`。
13. 只有 `TradeStatus === '1'` 才把 `orders.status` 更新為 `paid`。
14. 一般查詢遇到 `TradeStatus !== '1'` 會保持原狀；但返回商店後最後一次自動確認會帶 `markFailedWhenUnpaid=true`，若仍未付款則更新為 `failed`。
15. `failed` 訂單不顯示「重新確認付款狀態」，只保留重新付款入口。
16. 頁面顯示 `ecpay_trade_no`、付款方式、綠界付款時間與最近確認時間。

`PATCH /api/orders/:id/pay` 仍保留為開發/測試用模擬端點，正式付款流程應使用 ECPay checkout + query。

## 第三方整合

| 整合 | 狀態 | 設定 | 說明 |
| --- | --- | --- | --- |
| Unsplash images | 靜態 URL | 商品 seed data 的 `image_url` | 不需 API key |
| Vue CDN | 已接入 | `https://unpkg.com/vue@3/dist/vue.global.prod.js` | layout 載入 global `Vue` |
| ECPay | 已接入 AIO + QueryTradeInfo | `.env.example` 有 merchant/hash/env/ReturnURL | 本地端不依賴 Server Notify；使用者回到訂單頁後自動查詢確認 |
| Swagger/OpenAPI | 已接入 | `swagger-config.js`、route JSDoc | 執行 `npm run openapi` 產生 `openapi.json` |
