# 架構說明

## 目錄結構
```
claudecli/
├── app.js                    # Express 應用組裝：middleware 掛載、路由注冊
├── server.js                 # 啟動 HTTP 伺服器，驗證必要環境變數
├── generate-openapi.js       # 輸出 openapi.json 的獨立腳本
├── swagger-config.js         # Swagger/OpenAPI 設定
├── vitest.config.js          # Vitest 測試設定
├── src/
│   ├── database.js           # DB 連線、建表、種子資料
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT 驗證，注入 req.user
│   │   ├── adminMiddleware.js    # 管理員角色檢查
│   │   ├── sessionMiddleware.js  # session / 購物車 session_id
│   │   └── errorHandler.js      # 全域錯誤處理
│   └── routes/
│       ├── authRoutes.js         # /api/auth/*
│       ├── productRoutes.js      # /api/products/*（公開）
│       ├── cartRoutes.js         # /api/cart/*（session 購物車）
│       ├── orderRoutes.js        # /api/orders/*（需登入）
│       ├── adminProductRoutes.js # /api/admin/products/*（需 admin）
│       ├── adminOrderRoutes.js   # /api/admin/orders/*（需 admin）
│       └── pageRoutes.js         # 前台 EJS 頁面路由
├── views/
│   ├── layouts/
│   │   ├── front.ejs         # 前台主版型
│   │   └── admin.ejs         # 後台主版型
│   ├── pages/                # 各頁面 body 內容
│   │   ├── admin/            # 後台頁面（orders、products）
│   │   └── ...               # 前台頁面
│   └── partials/             # 可重用片段（header、footer、head 等）
├── public/
│   ├── css/                  # Tailwind CSS（input.css → output.css）
│   └── js/
│       ├── api.js            # 封裝 fetch 的 API 呼叫工具
│       ├── auth.js           # 登入狀態管理
│       ├── notification.js   # 通知 UI
│       ├── header-init.js    # Header 初始化
│       └── pages/            # 各頁面的 Vue CDN 應用邏輯
└── tests/                    # Vitest 整合測試
```

## 資料庫結構
```
users        → 使用者帳號（id, email, password_hash, name, role）
products     → 商品（id, name, description, price, stock, image_url）
cart_items   → 購物車項目（關聯 session_id 或 user_id + product_id）
orders       → 訂單（id, order_no, user_id, 收件資訊, total_amount, status）
order_items  → 訂單明細（關聯 order_id + 商品快照）
```

FK：`cart_items.product_id → products.id`，`cart_items.user_id → users.id`，`orders.user_id → users.id`，`order_items.order_id → orders.id`

## 請求資料流

### API 請求
```
Client (fetch)
  → Express
    → sessionMiddleware（產生/讀取 session_id）
    → authMiddleware（解析 JWT → req.user）[若需要]
    → adminMiddleware（驗 role）[若需要]
    → Route Handler
      → better-sqlite3（同步 DB 查詢）
    → JSON 回應 { data, error, message }
    → errorHandler（例外攔截）
```

### 頁面請求
```
Client (瀏覽器)
  → pageRoutes.js（Express）
    → render EJS body 片段
    → render layout（front.ejs / admin.ejs）包裝 body
    → 回傳完整 HTML
      → 瀏覽器執行 public/js/pages/<page>.js（Vue CDN 掛載）
        → 呼叫 API（public/js/api.js）
```

## 模組依賴關係
```
server.js
  └── app.js
        ├── src/database.js（singleton，全域共用）
        ├── src/middleware/*
        └── src/routes/*（各自 require database.js）
```

## 環境變數
| 變數 | 必填 | 說明 |
|------|------|------|
| `JWT_SECRET` | ✅ | JWT 簽名金鑰，缺少時拒絕啟動 |
| `PORT` | 否 | 預設 3001 |
| `FRONTEND_URL` | 否 | CORS 允許來源，預設 `http://localhost:3001` |
| `ADMIN_EMAIL` | 否 | 種子管理員，預設 `admin@hexschool.com` |
| `ADMIN_PASSWORD` | 否 | 種子管理員密碼，預設 `12345678` |

## 購物車設計
- **未登入**：購物車以 `session_id`（UUID，存入 cookie）識別
- **登入後**：購物車改以 `user_id` 識別，session 購物車自動合併
- `cart_items` 同一列 `session_id` 與 `user_id` 互斥（只有一個有值）
