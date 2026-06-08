# 架構說明

## 目錄結構

```
claudecli/
├── app.js                        # Express 應用組裝入口
│                                 #   - 載入 dotenv、cors、body-parser、sessionMiddleware
│                                 #   - 初始化 DB（require('./src/database')）
│                                 #   - 掛載所有 API 路由與 pageRoutes
│                                 #   - 404 handler（區分 API / 頁面）
│                                 #   - 全域 errorHandler
├── server.js                     # HTTP 伺服器啟動（port 3001）
│                                 #   - 驗證 JWT_SECRET 存在，否則 process.exit(1)
│                                 #   - require.main === module 保護（測試環境不啟動）
├── generate-openapi.js           # 獨立腳本：產出 openapi.json
├── swagger-config.js             # swagger-jsdoc 設定（掃描 src/routes/*.js）
├── vitest.config.js              # 測試設定（固定執行順序、禁並行）
├── src/
│   ├── database.js               # DB 連線 singleton、建表、種子資料
│   │                             #   - WAL mode、foreign_keys ON
│   │                             #   - 建立 5 張表（若不存在）
│   │                             #   - 遷移：orders 加入 ecpay_trade_no（try/catch，已存在則跳過）
│   │                             #   - seedAdminUser()、seedProducts()（已存在則跳過）
│   ├── utils/
│   │   └── ecpay.js              # 綠界 ECPay 工具函式（CMV-SHA256）
│   │                             #   - ecpayUrlEncode()：ECPay 專用 URL 編碼（.NET 字元替換）
│   │                             #   - generateCheckMacValue(params)：SHA256 CheckMacValue
│   │                             #   - verifyCheckMacValue(params)：timing-safe 驗簽
│   │                             #   - buildPaymentParams(order, items, tradeNo)：AIO 表單參數
│   │                             #   - queryEcpayTrade(tradeNo)：呼叫 QueryTradeInfo/V5
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT 強驗證：無 token → 401；token 無效 → 401
│   │   │                         #   解碼後再查 DB 確認使用者存在，注入 req.user
│   │   ├── adminMiddleware.js    # 角色檢查：req.user.role !== 'admin' → 403
│   │   ├── sessionMiddleware.js  # 讀取 X-Session-Id header → req.sessionId
│   │   └── errorHandler.js      # 全域錯誤攔截：500 一律回「伺服器內部錯誤」
│   └── routes/
│       ├── authRoutes.js         # /api/auth（register、login、profile）
│       ├── productRoutes.js      # /api/products（公開，支援分頁）
│       ├── cartRoutes.js         # /api/cart（雙模式認證 dualAuth）
│       ├── orderRoutes.js        # /api/orders（需登入）
│       ├── adminProductRoutes.js # /api/admin/products（需 admin）
│       ├── adminOrderRoutes.js   # /api/admin/orders（需 admin）
│       ├── ecpayRoutes.js        # /api/ecpay（AIO 付款發起、OrderResultURL、notify、QueryTradeInfo）
│       └── pageRoutes.js         # EJS 頁面路由（前台 + 後台）
├── views/
│   ├── layouts/
│   │   ├── front.ejs             # 前台主版型：<head>、header、footer、pageScript
│   │   └── admin.ejs             # 後台主版型：sidebar、admin-header
│   ├── pages/                    # 各頁面 body 內容（inject 進 layout）
│   │   ├── index.ejs             # 商品列表（首頁）
│   │   ├── product-detail.ejs    # 商品詳情
│   │   ├── cart.ejs              # 購物車
│   │   ├── checkout.ejs          # 結帳表單
│   │   ├── login.ejs             # 登入
│   │   ├── orders.ejs            # 我的訂單
│   │   ├── order-detail.ejs      # 訂單詳情（含付款結果顯示）
│   │   ├── 404.ejs               # 404 頁面
│   │   └── admin/
│   │       ├── products.ejs      # 後台商品管理
│   │       └── orders.ejs        # 後台訂單管理
│   └── partials/                 # 可重用片段
│       ├── head.ejs              # <meta>、CSS link
│       ├── header.ejs            # 前台導航列
│       ├── footer.ejs            # 頁尾
│       ├── admin-header.ejs      # 後台頂部導航
│       ├── admin-sidebar.ejs     # 後台側欄
│       └── notification.ejs      # 通知 UI
├── public/
│   ├── css/
│   │   ├── input.css             # Tailwind CSS 入口
│   │   └── output.css            # 建置產物（不追蹤於 git）
│   └── js/
│       ├── api.js                # 封裝 fetch → apiFetch()，自動帶 Auth headers
│       │                         #   401 自動清除 localStorage 並導向 /login
│       ├── auth.js               # Auth 物件：localStorage 管理 token/user/sessionId
│       │                         #   localStorage keys: flower_token、flower_user、flower_session_id
│       ├── notification.js       # 通知元件
│       ├── header-init.js        # Header 登入狀態初始化
│       └── pages/                # 各頁面 Vue CDN 應用邏輯
│           ├── index.js          # 首頁商品列表 Vue app
│           ├── product-detail.js # 商品詳情 + 加入購物車
│           ├── cart.js           # 購物車管理
│           ├── checkout.js       # 結帳流程
│           ├── login.js          # 登入表單
│           ├── orders.js         # 訂單列表
│           ├── order-detail.js   # 訂單詳情 + 付款模擬
│           ├── admin-products.js # 後台商品 CRUD
│           └── admin-orders.js   # 後台訂單管理
└── tests/
    ├── setup.js                  # 共用工具：getAdminToken()、registerUser()
    ├── auth.test.js
    ├── products.test.js
    ├── cart.test.js
    ├── orders.test.js
    ├── adminProducts.test.js
    └── adminOrders.test.js
```

## 啟動流程

```
node server.js
  1. 驗證 JWT_SECRET（缺少 → process.exit(1)）
  2. require('./app')
     a. dotenv.config()
     b. require('./src/database') → initializeDatabase()
        - WAL mode、foreign_keys ON
        - CREATE TABLE IF NOT EXISTS（5 張表）
        - ALTER TABLE orders ADD COLUMN ecpay_trade_no（try/catch，已存在則跳過）
        - seedAdminUser()（若不存在則插入）
        - seedProducts()（若 products 表為空則插入 8 筆）
     c. Express 中介軟體掛載（cors、json、urlencoded、sessionMiddleware）
     d. 路由掛載
  3. app.listen(3001)
```

## API 路由總覽

| 前綴 | 路由檔 | 認證 | 說明 |
|------|--------|------|------|
| `/api/auth` | authRoutes.js | 無（register/login）、JWT（profile） | 認證 |
| `/api/products` | productRoutes.js | 無 | 商品（公開） |
| `/api/cart` | cartRoutes.js | 雙模式（JWT 或 X-Session-Id） | 購物車 |
| `/api/orders` | orderRoutes.js | JWT（router.use(authMiddleware)） | 訂單 |
| `/api/admin/products` | adminProductRoutes.js | JWT + admin role | 後台商品 |
| `/api/admin/orders` | adminOrderRoutes.js | JWT + admin role | 後台訂單 |
| `/api/ecpay` | ecpayRoutes.js | 無（order-result/notify）、JWT（initiate/query） | 綠界 ECPay AIO 金流 |
| `/` | pageRoutes.js | 無（前端 JS 自行驗證） | EJS 頁面 |

## 統一 API 回應格式

所有端點固定回傳以下結構：

```json
{
  "data": <實際資料物件 | 陣列 | null>,
  "error": "<ERROR_CODE 字串> | null",
  "message": "說明文字（繁體中文）"
}
```

**分頁回應** data 結構：
```json
{
  "data": {
    "products": [...],
    "pagination": { "total": 8, "page": 1, "limit": 10, "totalPages": 1 }
  }
}
```

## 認證與授權機制

### authMiddleware（強 JWT 驗證）
1. 讀取 `Authorization: Bearer <token>` header
2. 無 header → 401 `UNAUTHORIZED`（「請先登入」）
3. `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })`
4. 驗證失敗（過期/篡改）→ 401（「Token 無效或已過期」）
5. 驗證成功後**再查 DB** 確認使用者存在，不存在 → 401
6. 成功：注入 `req.user = { userId, email, role }`

### adminMiddleware
- 依賴 authMiddleware 先執行（路由層用 `router.use(authMiddleware, adminMiddleware)`）
- `req.user.role !== 'admin'` → 403 `FORBIDDEN`

### dualAuth（購物車專用雙模式）
購物車路由使用自訂 `dualAuth` middleware：
1. **有 `Authorization` header**：強制走 JWT 驗證（失敗直接 401，不 fallback）
2. **無 Authorization 但有 `req.sessionId`**（來自 `X-Session-Id` header）：以訪客 session 身份繼續
3. 兩者皆無 → 401

前端行為（`public/js/auth.js`）：**每次請求都同時帶 JWT token（若登入）和 `X-Session-Id`**（永遠帶，值存在 localStorage）。

### JWT 參數
- 演算法：HS256
- Payload：`{ userId, email, role }`
- 有效期：7 天（`expiresIn: '7d'`）
- 金鑰：`process.env.JWT_SECRET`

## 資料庫 Schema

### users
| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID） |
| email | TEXT | UNIQUE NOT NULL |
| password_hash | TEXT | NOT NULL |
| name | TEXT | NOT NULL |
| role | TEXT | NOT NULL, DEFAULT 'user', CHECK IN ('user', 'admin') |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') |

### products
| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID） |
| name | TEXT | NOT NULL |
| description | TEXT | — |
| price | INTEGER | NOT NULL, CHECK(price > 0) |
| stock | INTEGER | NOT NULL, DEFAULT 0, CHECK(stock >= 0) |
| image_url | TEXT | — |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') |
| updated_at | TEXT | NOT NULL, DEFAULT datetime('now') |

注意：`updated_at` 僅在 PUT `/api/admin/products/:id` 時手動更新（`datetime('now')`），SQLite 無觸發器自動更新。

### cart_items
| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID） |
| session_id | TEXT | — （訪客模式使用） |
| user_id | TEXT | FK → users.id（登入模式使用） |
| product_id | TEXT | NOT NULL, FK → products.id |
| quantity | INTEGER | NOT NULL, DEFAULT 1, CHECK(quantity > 0) |

`session_id` 和 `user_id` 互斥（只有一個有值）。

### orders
| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID） |
| order_no | TEXT | UNIQUE NOT NULL（格式：ORD-YYYYMMDD-XXXXX） |
| user_id | TEXT | NOT NULL, FK → users.id |
| recipient_name | TEXT | NOT NULL |
| recipient_email | TEXT | NOT NULL |
| recipient_address | TEXT | NOT NULL |
| total_amount | INTEGER | NOT NULL |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('pending', 'paid', 'failed') |
| ecpay_trade_no | TEXT | — （ECPay MerchantTradeNo；付款發起時寫入，用於 OrderResultURL 反查訂單） |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') |

### order_items
| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID） |
| order_id | TEXT | NOT NULL, FK → orders.id |
| product_id | TEXT | NOT NULL（未設 FK，允許商品被刪後訂單仍保留記錄） |
| product_name | TEXT | NOT NULL（快照，記錄下單時的商品名稱） |
| product_price | INTEGER | NOT NULL（快照，記錄下單時的價格） |
| quantity | INTEGER | NOT NULL |

## 頁面渲染流程

```
瀏覽器請求 /products/:id
  → pageRoutes.js renderFront(res, 'product-detail', { productId })
    → res.render('pages/product-detail', ...) → body 字串
    → res.render('layouts/front', { body, title, pageScript }) → 完整 HTML
      → 瀏覽器執行 public/js/pages/product-detail.js（Vue CDN）
        → apiFetch('/api/products/' + productId)
          → 自動帶 Authorization + X-Session-Id header
```

## 前端 localStorage 結構

| Key | 說明 |
|-----|------|
| `flower_token` | JWT Token |
| `flower_user` | 使用者資訊（JSON 字串） |
| `flower_session_id` | 訪客 Session UUID（首次訪問時由 `crypto.randomUUID()` 生成） |
