# 開發規範

## 語系規定
- 所有錯誤訊息、使用者提示、UI 文字均使用**繁體中文**
- 程式碼內變數、函式名稱使用英文（camelCase）
- API 錯誤代碼（`error` 欄位）使用全大寫英文，底線分隔：`VALIDATION_ERROR`、`NOT_FOUND`、`UNAUTHORIZED`

## 命名規則

### JavaScript 變數與函式
```js
// 變數：camelCase
const cartItems = [];
const adminPassword = '...';

// 函式：camelCase 動詞開頭
function seedAdminUser() {}
function getAdminToken() {}

// 路由 handler：直接匿名函式，不另命名
router.post('/login', (req, res) => { ... });
```

### 資料庫欄位
- SQLite 欄位名稱：`snake_case`（`password_hash`、`created_at`、`order_no`）
- JS 取出後保持原始欄位名，不做轉換

### 檔案命名
- 路由檔：`<資源>Routes.js`（`authRoutes.js`、`productRoutes.js`）
- 中介軟體：`<功能>Middleware.js`（`authMiddleware.js`）
- 測試檔：`<資源>.test.js`（`auth.test.js`）

## 模組系統
使用 **CommonJS**（`require` / `module.exports`），不用 ESM import/export。

```js
// 正確
const db = require('../database');
module.exports = router;

// 不要這樣
import db from '../database';
export default router;
```

## API 回應格式
所有 API 端點必須回傳統一格式：
```json
{
  "data": <實際資料 | null>,
  "error": "<ERROR_CODE> | null",
  "message": "說明文字"
}
```

HTTP 狀態碼對應：
| 情境 | 狀態碼 |
|------|--------|
| 成功（讀取） | 200 |
| 建立成功 | 201 |
| 驗證失敗 | 400 |
| 未登入 | 401 |
| 無權限 | 403 |
| 找不到資源 | 404 |
| 資源衝突 | 409 |
| 伺服器錯誤 | 500 |

## 錯誤處理規則
1. **路由層**：只處理業務邏輯錯誤，使用 `return res.status(N).json(...)` 直接回應
2. **非預期錯誤**：`throw err` 或 `next(err)` 交由 `errorHandler` 處理，路由層不 `console.error`
3. **`errorHandler`**：統一過濾錯誤訊息，避免洩漏內部細節（500 一律回傳「伺服器內部錯誤」）
4. **`isOperational`**：可預期的業務錯誤設 `err.isOperational = true`，訊息可直接對外顯示

## 資料庫操作
使用 `better-sqlite3` 同步 API，禁止使用非同步模式：
```js
// 正確：同步
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
db.prepare('INSERT INTO users ...').run(...);

// 批次操作用 transaction
const insert = db.transaction((items) => {
  for (const item of items) insert.run(...);
});
```

## 認證流程
1. 前端每次請求帶 `Authorization: Bearer <token>` header
2. `authMiddleware` 解析 JWT，成功後將 `{ userId, email, role }` 掛到 `req.user`
3. 管理員路由再加掛 `adminMiddleware`，檢查 `req.user.role === 'admin'`

## 密碼安全
- 使用 `bcrypt`，production 環境 saltRounds = 10
- 測試環境 saltRounds = 1（加速測試）
- 透過 `process.env.NODE_ENV === 'test'` 判斷
