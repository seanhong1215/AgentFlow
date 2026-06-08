# 功能清單

## 認證（/api/auth）

### POST /api/auth/register — 使用者註冊
- **必填欄位**：`email`（email 格式）、`password`（最少 6 字元）、`name`
- **行為**：驗證格式 → 查重複 email → bcrypt 雜湊 → 插入 users 表 → 回傳 JWT token
- **回傳**：`data.user`（id, email, name, role）+ `data.token`（JWT，7 天）
- **錯誤情境**：
  - 400 `VALIDATION_ERROR`：缺少欄位、email 格式錯誤、密碼少於 6 字元
  - 409 `CONFLICT`：email 已被註冊

### POST /api/auth/login — 使用者登入
- **必填欄位**：`email`、`password`
- **行為**：查使用者 → bcrypt 比對密碼 → 產生 JWT
- **回傳**：`data.user`（id, email, name, role）+ `data.token`
- **錯誤情境**：
  - 400 `VALIDATION_ERROR`：缺少欄位
  - 401 `UNAUTHORIZED`：帳號不存在或密碼錯誤（訊息故意相同，避免枚舉帳號）

### GET /api/auth/profile — 取得個人資料（需登入）
- **認證**：JWT（authMiddleware）
- **回傳**：`data`（id, email, name, role, created_at）
- **錯誤情境**：404 若 token 有效但 DB 中使用者不存在

---

## 商品（/api/products，公開）

### GET /api/products — 商品列表（分頁）
- **查詢參數**：
  - `page`（預設 1，最小 1）
  - `limit`（預設 10，最小 1，最大 100）
- **行為**：依 `created_at DESC` 排序，套用 LIMIT/OFFSET
- **回傳**：`data.products`（陣列）+ `data.pagination`（total, page, limit, totalPages）
- 無認證要求，任何人可存取

### GET /api/products/:id — 商品詳情
- **行為**：查單筆商品，不存在回 404
- **回傳**：`data`（id, name, description, price, stock, image_url, created_at, updated_at）

---

## 購物車（/api/cart）— 雙模式認證

> 購物車使用 `dualAuth` 自訂 middleware，同時支援**登入使用者**（JWT）和**訪客**（X-Session-Id）。

**認證邏輯**（重要，影響所有購物車 API）：
1. 請求帶 `Authorization: Bearer <token>`：強制 JWT 驗證，失敗直接 401
2. 無 Authorization header，但有 `X-Session-Id` header：以訪客 session 身份操作
3. 兩者皆無：401

**所有者識別**：
- 登入用戶：`cart_items.user_id = req.user.userId`
- 訪客：`cart_items.session_id = req.sessionId`

前端永遠同時帶兩個 header（在 `auth.js` 的 `getAuthHeaders()` 中）：
- 登入狀態：`Authorization` + `X-Session-Id`
- 未登入：只有 `X-Session-Id`

### GET /api/cart — 查看購物車
- **行為**：JOIN `products` 取得商品資訊，計算總金額
- **回傳**：`data.items`（含 product 子物件）+ `data.total`（整數，元）

### POST /api/cart — 加入購物車
- **必填**：`productId`、`quantity`（選填，預設 1）
- **行為（累加機制）**：若同商品已在購物車中，**新數量 = 現有數量 + 加入數量**（不是覆蓋）
- **庫存檢查**：加入時只檢查「累加後數量 ≤ stock」，不扣庫存
- **回傳**：`data`（id, product_id, quantity）
- **錯誤情境**：
  - 400 `VALIDATION_ERROR`：`productId` 缺失、`quantity` 非正整數
  - 400 `STOCK_INSUFFICIENT`：超過庫存
  - 404 `NOT_FOUND`：商品不存在

### PATCH /api/cart/:itemId — 更新購物車數量
- **必填**：`quantity`（正整數）
- **行為**：**直接替換**數量（不是累加）；驗證數量不超過庫存
- **隔離**：只能更新自己的購物車（同 owner 條件過濾）
- **錯誤情境**：400 `STOCK_INSUFFICIENT`、404 `NOT_FOUND`

### DELETE /api/cart/:itemId — 移除購物車項目
- **行為**：驗證項目屬於本 owner 後刪除
- **回傳**：`data: null`

---

## 訂單（/api/orders）— 需登入（authMiddleware）

> 訂單路由對整個 router 套用 `authMiddleware`，所有端點都需要 JWT。

### POST /api/orders — 建立訂單
- **必填**：`recipientName`、`recipientEmail`（email 格式）、`recipientAddress`
- **行為（Transaction 保護）**：
  1. 取得使用者的購物車（只取 `user_id` 的，不含 session）
  2. 驗證購物車不為空
  3. 批次檢查庫存（全部通過才繼續）
  4. 計算總金額
  5. SQLite Transaction 內：
     - INSERT orders
     - INSERT order_items（每筆含商品名稱/價格快照）
     - UPDATE products SET stock = stock - quantity（逐一扣庫存）
     - DELETE cart_items WHERE user_id（清空購物車）
- **訂單號格式**：`ORD-YYYYMMDD-XXXXX`（XXXXX 為 UUID 前 5 碼大寫）
- **初始狀態**：`pending`
- **回傳**：`data`（id, order_no, total_amount, status, items, created_at）
- **錯誤情境**：
  - 400 `VALIDATION_ERROR`：缺少收件欄位
  - 400 `CART_EMPTY`：購物車為空
  - 400 `STOCK_INSUFFICIENT`：列出庫存不足的商品名稱

### GET /api/orders — 我的訂單列表
- **行為**：只回傳登入使用者自己的訂單，依 `created_at DESC` 排序
- **回傳**：`data.orders`（id, order_no, total_amount, status, created_at）

### GET /api/orders/:id — 訂單詳情
- **行為**：驗證 order.user_id === 當前使用者（防止查看他人訂單）
- **回傳**：`data`（完整訂單 + items 陣列）

### PATCH /api/orders/:id/pay — 模擬付款
- **必填**：`action`（`success` | `fail`）
- **行為**：驗證訂單屬於本人且狀態為 `pending`；success → `paid`，fail → `failed`
- **錯誤情境**：
  - 400 `VALIDATION_ERROR`：action 非 success/fail
  - 400 `INVALID_STATUS`：訂單已非 pending 狀態

---

## 管理員商品（/api/admin/products）— 需 admin 角色

> 整個 router 套用 `authMiddleware + adminMiddleware`。

### GET /api/admin/products — 後台商品列表
- 與公開商品列表相同邏輯，但需 admin 認證
- 支援 `page`、`limit` 分頁參數

### POST /api/admin/products — 新增商品
- **必填**：`name`、`price`（正整數）、`stock`（非負整數）
- **選填**：`description`、`image_url`（null 存 DB）
- **回傳**：201 + 完整商品物件

### PUT /api/admin/products/:id — 更新商品
- **部分更新**：只更新有提供的欄位（未提供的保留現有值）
- **驗證**：`name` 不可為空字串；`price` 若提供須為正整數；`stock` 若提供須為非負整數
- **自動更新** `updated_at = datetime('now')`

### DELETE /api/admin/products/:id — 刪除商品
- **刪除守衛**：若商品存在於任何 `status = 'pending'` 的訂單中 → 409 `CONFLICT`
- 已完成（paid/failed）的訂單不影響刪除

---

## 管理員訂單（/api/admin/orders）— 需 admin 角色

### GET /api/admin/orders — 後台訂單列表
- **查詢參數**：
  - `page`（預設 1）
  - `limit`（預設 10，最大 100）
  - `status`（選填，僅接受 `pending` | `paid` | `failed`，其他值忽略不過濾）
- **行為**：可按狀態過濾，依 `created_at DESC` 排序
- **回傳**：`data.orders`（含所有欄位，不含 items）+ `data.pagination`

### GET /api/admin/orders/:id — 後台訂單詳情
- **回傳**：`data`（完整訂單 + items 陣列 + user 子物件（name, email））
- 若使用者已被刪除，`user` 欄位為 null

---

## 前台頁面（EJS）

| 頁面 | 路徑 | pageScript | 說明 |
|------|------|------------|------|
| 首頁 | `/` | `index` | 商品列表，分頁 |
| 商品詳情 | `/products/:id` | `product-detail` | 商品資訊 + 加入購物車；productId 由 EJS 注入 |
| 購物車 | `/cart` | `cart` | 購物車管理 |
| 結帳 | `/checkout` | `checkout` | 填收件資訊、送出訂單 |
| 登入 | `/login` | `login` | 登入表單；支援 `?redirect=` 導回原頁 |
| 我的訂單 | `/orders` | `orders` | 需前端 Auth.requireAuth() 驗證 |
| 訂單詳情 | `/orders/:id` | `order-detail` | orderId 和 paymentResult 由 EJS 注入 |

## 後台頁面（EJS）

| 頁面 | 路徑 | pageScript | 說明 |
|------|------|------------|------|
| 商品管理 | `/admin/products` | `admin-products` | CRUD，需前端 Auth.requireAdmin() |
| 訂單管理 | `/admin/orders` | `admin-orders` | 訂單列表與狀態篩選 |

## 綠界金流（/api/ecpay）

> 串接綠界 ECPay AIO（全方位金流），採 CMV-SHA256 協議。本機開發無法接收 ReturnURL（Server-to-Server），改以 `OrderResultURL`（瀏覽器 POST 重導）更新付款狀態；另提供 `QueryTradeInfo` 主動查詢作為備援。

### POST /api/ecpay/initiate — 發起 ECPay 付款（需登入）
- **必填**：`orderId`
- **行為**：驗證訂單屬於本人且狀態為 `pending` → 產生 `MerchantTradeNo`（`EC` + 13 位 Unix ms）→ 寫入 `orders.ecpay_trade_no` → 計算 CheckMacValue → 回傳表單參數
- **回傳**：`data.endpoint`（ECPay 收款 URL）+ `data.params`（所有表單欄位含 CheckMacValue）
- **前端行為**：動態建立 `<form>`，設定 action/inputs，呼叫 `form.submit()` 導向綠界頁面

### POST /api/ecpay/order-result — 付款後瀏覽器重導（OrderResultURL）
- **無需認證**：由綠界透過瀏覽器 Form POST 呼叫
- **行為**：驗證 CheckMacValue → 查 `orders.ecpay_trade_no` → 若 `RtnCode=1` 更新狀態為 `paid`，否則 `failed` → 重導至 `/orders/:id?payment=success|failed`
- **本機可用**：此端點是瀏覽器發起的 POST（非 Server-to-Server），本機開發亦可正常運作

### POST /api/ecpay/notify — 伺服器端付款通知（ReturnURL）
- **無需認證**：由綠界伺服器發起（本機開發不會觸發）
- **行為**：驗證 CheckMacValue → 更新訂單狀態 → 回應 `1|OK`
- **冪等設計**：若訂單已非 pending，跳過更新直接回應

### GET /api/ecpay/query/:orderId — 主動查詢付款狀態（需登入）
- **行為**：呼叫綠界 `QueryTradeInfo/V5` API → 若 `TradeStatus=1` 且訂單為 pending，更新為 paid
- **用途**：備援機制，當 OrderResultURL 未觸發時可手動查詢
- **錯誤情境**：400 `NO_ECPAY_TRADE`（尚未發起付款）

**MerchantTradeNo 格式**：`EC` + Unix ms timestamp（最多 15 字元，純英數字）
**測試環境端點**：`https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5`
**EncryptType**：`1`（SHA256）

---

## 完成狀態彙整

| 模組 | 狀態 |
|------|------|
| 認證（register / login / profile） | ✅ 完成 |
| 商品（列表 / 詳情） | ✅ 完成 |
| 購物車（CRUD，雙模式） | ✅ 完成 |
| 訂單（建立 / 列表 / 詳情 / 模擬付款） | ✅ 完成 |
| 管理員商品（CRUD） | ✅ 完成 |
| 管理員訂單（列表 / 詳情） | ✅ 完成 |
| 前台 EJS 頁面 | ✅ 完成 |
| 後台 EJS 頁面 | ✅ 完成 |
| OpenAPI 文件生成 | ✅ 完成 |
| 綠界金流整合（ECPay AIO + QueryTradeInfo） | ✅ 完成 |
