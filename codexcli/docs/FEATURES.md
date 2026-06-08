# 功能清單與行為

## 完成狀態總覽

| 功能 | 狀態 | 主要檔案 |
| --- | --- | --- |
| 會員註冊、登入、profile | 已完成 | `authRoutes.js`, `auth.js`, `login.js` |
| 前台商品列表與詳情 | 已完成 | `productRoutes.js`, `index.js`, `product-detail.js` |
| 訪客/會員購物車 | 已完成 | `cartRoutes.js`, `auth.js`, `cart.js` |
| 會員結帳與訂單 | 已完成 | `orderRoutes.js`, `checkout.js`, `orders.js`, `order-detail.js` |
| ECPay 綠界付款 | 已完成 | `ecpayService.js`, `orderRoutes.js`, `ecpayRoutes.js`, `order-detail.js` |
| 開發用付款狀態切換 | 已完成，非正式金流 | `orderRoutes.js`, `order-detail.js` |
| 管理員商品管理 | 已完成 | `adminProductRoutes.js`, `admin-products.js` |
| 管理員訂單查詢 | 已完成 | `adminOrderRoutes.js`, `admin-orders.js` |
| OpenAPI 產生 | 已完成 | `swagger-config.js`, route JSDoc |

## Auth

### 行為描述

使用者可註冊、登入與取得 profile。註冊與登入成功時，後端以 `jsonwebtoken.sign()` 簽發 7 天 JWT，payload 為 `{ userId, email, role }`。前端將 token 存在 `localStorage.flower_token`，user summary 存在 `localStorage.flower_user`。

系統沒有後端 logout API，登出是前端清除 localStorage。管理員帳號由 `src/database.js` seed，email/password 由 `.env` 或預設值控制。

### 端點

| Method | Path | 認證 | 說明 |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 無 | 註冊一般會員 |
| POST | `/api/auth/login` | 無 | 登入 |
| GET | `/api/auth/profile` | Bearer JWT | 取得目前會員 |

### `POST /api/auth/register`

Request body:

| 欄位 | 必填 | 型別 | 規則 |
| --- | --- | --- | --- |
| `email` | 是 | string | 必須符合 email regex，且不可重複 |
| `password` | 是 | string | 長度至少 6 |
| `name` | 是 | string | 不可缺少 |

業務邏輯：

1. 驗證必填欄位。
2. 驗證 email 格式。
3. 驗證 password 長度。
4. 檢查 email 是否已存在。
5. bcrypt hash password。
6. 寫入 `users`，role 固定為 `user`。
7. 簽發 7 天 JWT。
8. 回傳 `{ user, token }`。

錯誤情境：

| Status | error | 情境 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 缺 email/password/name、email 格式錯、password 太短 |
| 409 | `CONFLICT` | email 已註冊 |
| 500 | `INTERNAL_ERROR` | 缺 `JWT_SECRET` 時 token 簽發失敗 |

### `POST /api/auth/login`

Request body:

| 欄位 | 必填 | 型別 |
| --- | --- | --- |
| `email` | 是 | string |
| `password` | 是 | string |

業務邏輯：查詢 user、bcrypt compare、簽發 JWT、回傳 `{ user, token }`。

錯誤情境：

| Status | error | 情境 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 缺 email 或 password |
| 401 | `UNAUTHORIZED` | user 不存在或密碼錯 |
| 500 | `INTERNAL_ERROR` | 缺 `JWT_SECRET` |

### `GET /api/auth/profile`

認證：`Authorization: Bearer <token>`。

業務邏輯：`authMiddleware` 驗證 JWT 後，依 `req.user.userId` 查詢 `users`，回傳 `id,email,name,role,created_at`。

錯誤情境：

| Status | error | 情境 |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | 缺 token、token 無效、token 過期、token user 不存在 |
| 404 | `NOT_FOUND` | middleware 通過但 profile query 查無 user |

## Products

### 行為描述

商品前台 API 不需要登入。商品列表支援分頁，預設每頁 10 筆，依 `created_at DESC` 排序。商品詳情以 ID 查詢單筆資料。購物車與訂單會引用商品價格與庫存；建立訂單時會把商品名稱與價格快照寫入 `order_items`，避免後續商品改價影響既有訂單。

### 端點

| Method | Path | 認證 | 說明 |
| --- | --- | --- | --- |
| GET | `/api/products` | 無 | 商品列表 |
| GET | `/api/products/:id` | 無 | 商品詳情 |

### `GET /api/products`

Query params:

| 參數 | 預設值 | 規則 |
| --- | --- | --- |
| `page` | 1 | `parseInt` 後最小為 1 |
| `limit` | 10 | `parseInt` 後最小為 1，最大為 100 |

Response:

- `data.products`: product array。
- `data.pagination.total`: 商品總數。
- `data.pagination.page`: 目前 page。
- `data.pagination.limit`: 目前 limit。
- `data.pagination.totalPages`: `Math.ceil(total / limit)`。

### `GET /api/products/:id`

錯誤情境：

| Status | error | 情境 |
| --- | --- | --- |
| 404 | `NOT_FOUND` | 商品 ID 不存在 |

## Cart

### 行為描述

購物車支援訪客與會員兩種 owner。訪客使用 `X-Session-Id` 對應 `cart_items.session_id`；會員使用 Bearer JWT 對應 `cart_items.user_id`。`Auth.getAuthHeaders()` 一律帶 `X-Session-Id`，登入後另外帶 `Authorization`。後端 `dualAuth` 優先使用 JWT；若 JWT header 存在但無效，直接回 401，不會退回訪客 session。

加入同一商品時不新增第二筆 cart item，而是累加數量。累加後或更新後的數量不可超過商品庫存。

### 端點

| Method | Path | 認證 | 說明 |
| --- | --- | --- | --- |
| GET | `/api/cart` | Bearer JWT 或 `X-Session-Id` | 取得購物車 |
| POST | `/api/cart` | Bearer JWT 或 `X-Session-Id` | 加入商品 |
| PATCH | `/api/cart/:itemId` | Bearer JWT 或 `X-Session-Id` | 更新數量 |
| DELETE | `/api/cart/:itemId` | Bearer JWT 或 `X-Session-Id` | 刪除品項 |

### `GET /api/cart`

業務邏輯：

1. `dualAuth` 決定 owner 欄位。
2. join `cart_items` 與 `products`。
3. 回傳每筆 cart item 與 product summary。
4. 計算 `total = sum(price * quantity)`。

錯誤情境：

| Status | error | 情境 |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | 缺 token/session、token 無效、token user 不存在 |

### `POST /api/cart`

Request body:

| 欄位 | 必填 | 型別 | 預設值 | 規則 |
| --- | --- | --- | --- | --- |
| `productId` | 是 | string | 無 | 必須存在於 products |
| `quantity` | 否 | number/string | 1 | `parseInt` 後必須是整數且 >= 1 |

業務邏輯：

1. 驗證 `productId` 與 `quantity`。
2. 查詢 product。
3. 依 owner 查詢是否已有相同 product cart item。
4. 若已存在，計算 `newQty = existing.quantity + qty`，確認不超過 stock 後更新。
5. 若不存在，確認 `qty <= stock` 後新增 cart item。

錯誤情境：

| Status | error | 情境 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 缺 productId 或 quantity 非正整數 |
| 400 | `STOCK_INSUFFICIENT` | 新增或累加後數量超過庫存 |
| 401 | `UNAUTHORIZED` | 沒有可用 owner |
| 404 | `NOT_FOUND` | productId 不存在 |

### `PATCH /api/cart/:itemId`

Request body:

| 欄位 | 必填 | 規則 |
| --- | --- | --- |
| `quantity` | 是 | `parseInt` 後必須是正整數，且不可超過 product stock |

業務邏輯：只允許更新目前 owner 的 cart item。若 item 不存在回 404；若數量超過庫存回 `STOCK_INSUFFICIENT`。

### `DELETE /api/cart/:itemId`

業務邏輯：只允許刪除目前 owner 的 cart item。刪除成功回 `data: null`。

## Orders

### 行為描述

訂單 API 僅支援會員。建立訂單只讀取 `cart_items.user_id = req.user.userId` 的購物車，不讀訪客購物車。訂單編號格式為 `ORD-YYYYMMDD-XXXXX`，訂單初始狀態為 `pending`。

建立訂單是 transaction：insert `orders`、insert 每筆 `order_items`、扣商品庫存、刪除會員購物車。若任何一步失敗，SQLite transaction 會 rollback，避免扣庫存但訂單未建立。

### 端點

| Method | Path | 認證 | 說明 |
| --- | --- | --- | --- |
| POST | `/api/orders` | Bearer JWT | 從會員購物車建立訂單 |
| GET | `/api/orders` | Bearer JWT | 會員訂單列表 |
| GET | `/api/orders/:id` | Bearer JWT | 會員訂單詳情 |
| PATCH | `/api/orders/:id/pay` | Bearer JWT | 開發用付款成功/失敗切換 |
| POST | `/api/orders/:id/ecpay/checkout` | Bearer JWT | 產生綠界 AIO 付款表單參數 |
| POST | `/api/orders/:id/ecpay/query` | Bearer JWT | 主動查詢綠界付款狀態 |
| POST | `/api/orders/:id/ecpay/fail` | Bearer JWT | 瀏覽器付款結果導回但未確認成功時，強制標記本地付款失敗 |

### `POST /api/orders`

Request body:

| 欄位 | 必填 | 型別 | 規則 |
| --- | --- | --- | --- |
| `recipientName` | 是 | string | 不可缺少 |
| `recipientEmail` | 是 | string | 必須符合 email regex |
| `recipientAddress` | 是 | string | 不可缺少 |

業務邏輯：

1. 驗證收件資料。
2. 查詢登入 user 的 cart items 並 join products。
3. cart 為空時回 `CART_EMPTY`。
4. 檢查每個 item quantity 不可超過目前 product stock。
5. 計算 `totalAmount`。
6. 產生 `orderId` 與 `orderNo`。
7. transaction 內建立 `orders`、建立 `order_items`、扣庫存、清空 cart。
8. 回傳訂單摘要與 items。

錯誤情境：

| Status | error | 情境 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 收件資料缺少或 email 格式錯 |
| 400 | `CART_EMPTY` | 會員購物車沒有商品 |
| 400 | `STOCK_INSUFFICIENT` | 購物車數量超過庫存 |
| 401 | `UNAUTHORIZED` | 缺 token 或 token 無效 |

### `GET /api/orders`

回傳目前 user 的訂單列表，依 `created_at DESC` 排序。此端點目前沒有分頁。

### `GET /api/orders/:id`

只允許讀取目前 user 自己的訂單。回傳 order 加上 `items` array。

錯誤情境：

| Status | error | 情境 |
| --- | --- | --- |
| 404 | `NOT_FOUND` | 訂單不存在或不屬於目前 user |

### `PATCH /api/orders/:id/pay`

這是開發/測試用端點，不是正式金流。正式付款應使用 ECPay checkout + query。

Request body:

| 欄位 | 必填 | 可用值 |
| --- | --- | --- |
| `action` | 是 | `success`, `fail` |

業務邏輯：

1. 驗證 action。
2. 查詢目前 user 的訂單。
3. 只允許 `pending` 訂單切換。
4. `success` 改為 `paid`；`fail` 改為 `failed`。

錯誤情境：

| Status | error | 情境 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | action 不是 `success` 或 `fail` |
| 400 | `INVALID_STATUS` | 訂單不是 pending |
| 404 | `NOT_FOUND` | 訂單不存在或不屬於目前 user |

## ECPay 綠界付款

### 行為描述

綠界串接使用 AIO 跳轉模式。後端產生付款表單參數與 CheckMacValue，前端建立 hidden form 並 POST 到綠界。因 localhost 無法可靠接收綠界 Server Notify，本專案不使用 notify 更新訂單，而是在使用者按「返回商店」回到本地訂單頁後，由頁面自動觸發本地端查詢 `QueryTradeInfo`。

`ecpayService.js` 負責所有綠界細節：

- staging/production endpoint 選擇。
- `MerchantTradeNo` 產生與長度限制。
- `MerchantTradeDate` 台灣時間格式。
- `ItemName` 組合。
- CheckMacValue SHA256 產生與驗證。
- `QueryTradeInfo` POST request 與 URL-encoded response 解析。

### `POST /api/orders/:id/ecpay/checkout`

認證：Bearer JWT。

Request body：無。

業務邏輯：

1. 查詢目前 user 的訂單。
2. 只允許 `pending` 或 `failed` 訂單付款。
3. 查詢 order items，若沒有明細回錯。
4. 後端每次 checkout 都產生新的 `ecpay_merchant_trade_no`，英數且不超過 20 字元，並存回 `orders`。
5. 本地 `order_no` 不變；綠界 `MerchantTradeNo` 每次付款嘗試都換新，避免綠界回覆交易編號重複。
6. 若訂單原本是 `failed`，checkout 會把狀態重設為 `pending`，並清空舊的綠界付款資訊。
7. 後端產生 AIO 參數與 CheckMacValue，回傳 `{ action, params, order }`。
8. 前端 hidden form POST 到 `action`。

重要付款參數：

| 欄位 | 值 |
| --- | --- |
| `MerchantID` | `ECPAY_MERCHANT_ID` 或測試預設 `2000132` |
| `MerchantTradeNo` | 訂單綁定的 `ecpay_merchant_trade_no` |
| `MerchantTradeDate` | `yyyy/MM/dd HH:mm:ss` 台灣時間 |
| `PaymentType` | `aio` |
| `TotalAmount` | `orders.total_amount` |
| `TradeDesc` | 固定交易描述 |
| `ItemName` | order items 以 `#` 串接 |
| `ReturnURL` | `ECPAY_RETURN_URL` 或 `${BASE_URL}/api/ecpay/notify` |
| `OrderResultURL` | `${BASE_URL}/orders/:id?payment=result`; browser result return. The page queries ECPay first and force marks `failed` if the order is not confirmed `paid`. |
| `ClientBackURL` | `${BASE_URL}/orders/:id?payment=returned` |
| `ChoosePayment` | `ALL` |
| `EncryptType` | `1` |
| `CheckMacValue` | 後端產生，不可在前端重算 |

錯誤情境：

| Status | error | 情境 |
| --- | --- | --- |
| 400 | `INVALID_STATUS` | 訂單不是 pending 或 failed |
| 400 | `ORDER_ITEMS_EMPTY` | 訂單沒有明細 |
| 401 | `UNAUTHORIZED` | 缺 token 或 token 無效 |
| 404 | `NOT_FOUND` | 訂單不存在或不屬於目前 user |

### `POST /api/orders/:id/ecpay/query`

認證：Bearer JWT。

Request body：無。

業務邏輯：

1. 查詢目前 user 的訂單。
2. 訂單必須先建立 ECPay checkout，因為查詢需要 `ecpay_merchant_trade_no`。
3. 後端每次查詢重新產生 Unix 秒數 `TimeStamp`。
4. 呼叫綠界 `QueryTradeInfo/V5`。
5. 解析 URL-encoded response。
6. 驗證 response `CheckMacValue`。
7. 比對 `TradeAmt` 與本地 `orders.total_amount`。
8. 若 `TradeStatus === '1'`，更新 `orders.status = 'paid'`，並寫入 `ecpay_trade_no`、`ecpay_payment_type`、`ecpay_payment_date`、`ecpay_trade_status`、`ecpay_query_raw`、`payment_checked_at`。
9. 若 `TradeStatus !== '1'`，一般查詢不把訂單改為 paid，但仍保存查詢結果與查詢時間。
10. 若 request body 帶 `markFailedWhenUnpaid: true`，且 `TradeStatus !== '1'`，代表返回商店後最後一次自動確認仍未付款，後端會把訂單更新為 `failed`。

錯誤情境：

| Status | error | 情境 |
| --- | --- | --- |
| 400 | `ECPAY_TRADE_NOT_CREATED` | 尚未建立綠界付款交易 |
| 401 | `UNAUTHORIZED` | 缺 token 或 token 無效 |
| 404 | `NOT_FOUND` | 訂單不存在或不屬於目前 user |
| 409 | `ECPAY_AMOUNT_MISMATCH` | 綠界查詢金額與本地訂單金額不同 |
| 502 | `ECPAY_QUERY_FAILED` | 綠界查詢失敗、網路錯誤或 CheckMacValue 驗證失敗 |

非標準本地機制：`/api/ecpay/notify` 只回 `1|OK`，讓未來透過 tunnel 或正式網域時可符合綠界規格；目前真正更新訂單狀態的是訂單詳情頁返回後自動呼叫的 `QueryTradeInfo`。若綠界剛完成付款但查詢資料尚未同步，前端會短時間重試，並提供「重新確認付款狀態」按鈕。

失敗處理：返回商店後若自動重試到最後仍查不到付款成功，前端會要求後端用 `markFailedWhenUnpaid` 將訂單落為 `failed`。`failed` 狀態不再顯示「重新確認付款狀態」，只顯示重新前往綠界付款。

### `POST /api/orders/:id/ecpay/fail`

認證：Bearer JWT。

用途：處理綠界付款頁在選擇付款方式或送出付款後發生錯誤、但瀏覽器仍能回到本地 `OrderResultURL` 的情境。前端回到 `/orders/:id?payment=result` 後會先查詢 `QueryTradeInfo`；若查詢失敗或結果不是 `TradeStatus === '1'`，就呼叫此端點，把本地訂單強制寫入 `failed`，避免訂單停在 `pending` 並避免頁面繼續顯示「重新確認付款狀態」。

Request body:

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `reason` | 否 | 失敗原因，預設 `client_result_failed`，最多保留 80 字元 |

業務邏輯：
1. 只允許訂單擁有者操作。
2. 訂單必須已建立 `ecpay_merchant_trade_no`，也就是曾經產生過綠界 checkout。
3. `paid` 訂單不可被改成 `failed`。
4. `pending` 或已是 `failed` 的綠界訂單會寫入 `status = 'failed'`、`ecpay_trade_status = reason`、`payment_checked_at = datetime('now')`，並把 client-side failure metadata 存到 `ecpay_query_raw`。

錯誤情境：

| Status | error | 說明 |
| --- | --- | --- |
| 400 | `ECPAY_TRADE_NOT_CREATED` | 訂單尚未建立綠界 checkout |
| 400 | `INVALID_STATUS` | 訂單已付款或不是可標記失敗的狀態 |
| 401 | `UNAUTHORIZED` | 缺少 token 或 token 無效 |
| 404 | `NOT_FOUND` | 訂單不存在或不屬於目前使用者 |

## Admin Products

### 行為描述

管理員商品 API 需要 Bearer JWT 且 role 必須是 `admin`。前端後台頁面也會呼叫 `Auth.requireAdmin()`，但真正權限判斷以 API middleware 為準。

刪除商品時，系統會先檢查該商品是否被 pending 訂單引用。若有 pending order item，回 409；若只有 paid/failed 訂單引用，目前 schema 沒有 `ON DELETE` 規則，SQLite foreign key 仍可能阻止刪除，因此後續若要允許封存商品，應改為 soft delete。

### 端點

| Method | Path | 認證 | 說明 |
| --- | --- | --- | --- |
| GET | `/api/admin/products` | Bearer JWT + admin | 商品列表 |
| POST | `/api/admin/products` | Bearer JWT + admin | 新增商品 |
| PUT | `/api/admin/products/:id` | Bearer JWT + admin | 更新商品 |
| DELETE | `/api/admin/products/:id` | Bearer JWT + admin | 刪除商品 |

### `GET /api/admin/products`

Query params:

| 參數 | 預設值 | 規則 |
| --- | --- | --- |
| `page` | 1 | 最小 1 |
| `limit` | 10 | 最小 1，最大 100 |

### `POST /api/admin/products`

Request body:

| 欄位 | 必填 | 型別 | 規則 |
| --- | --- | --- | --- |
| `name` | 是 | string | 不可缺少 |
| `description` | 否 | string | 缺少時存 `null` |
| `price` | 是 | integer | 必須是 JSON number 且 > 0 |
| `stock` | 是 | integer | 必須是 JSON number 且 >= 0 |
| `image_url` | 否 | string | 缺少時存 `null` |

錯誤情境：

| Status | error | 情境 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | name 缺少、price 非正整數、stock 非非負整數 |
| 401 | `UNAUTHORIZED` | 缺 token 或 token 無效 |
| 403 | `FORBIDDEN` | 不是 admin user |

### `PUT /api/admin/products/:id`

Request body 欄位皆選填；有提供才更新。`name` 不可為空字串，`price` 必須 > 0，`stock` 必須 >= 0。更新時同步設定 `updated_at = datetime('now')`。

### `DELETE /api/admin/products/:id`

業務邏輯：

1. 查詢 product 是否存在。
2. 檢查是否存在 pending 訂單明細引用此 product。
3. 若有 pending order，回 409。
4. 若沒有 pending order，嘗試刪除 product。

## Admin Orders

### 行為描述

管理員可查詢所有訂單，並用 status 篩選。訂單詳情會包含 order items 與 user summary。此模組目前只提供查詢，不提供狀態修改；前台 ECPay query 或開發用 pay endpoint 才會更新 order status。

### 端點

| Method | Path | 認證 | 說明 |
| --- | --- | --- | --- |
| GET | `/api/admin/orders` | Bearer JWT + admin | 全站訂單列表 |
| GET | `/api/admin/orders/:id` | Bearer JWT + admin | 單筆訂單詳情 |

### `GET /api/admin/orders`

Query params:

| 參數 | 預設值 | 規則 |
| --- | --- | --- |
| `page` | 1 | 最小 1 |
| `limit` | 10 | 最小 1，最大 100 |
| `status` | 無 | 只有 `pending`、`paid`、`failed` 會套用篩選；其他值會被忽略 |

Response:

- `data.orders`: 訂單 array。
- `data.pagination.total`
- `data.pagination.page`
- `data.pagination.limit`
- `data.pagination.totalPages`

### `GET /api/admin/orders/:id`

Response 包含 order、`items` array、`user` summary。若 user 已不存在，`user` 回 `null`。

錯誤情境：

| Status | error | 情境 |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | 缺 token 或 token 無效 |
| 403 | `FORBIDDEN` | 不是 admin user |
| 404 | `NOT_FOUND` | 訂單不存在 |
