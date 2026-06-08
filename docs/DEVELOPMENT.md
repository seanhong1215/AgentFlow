# 開發規範

## 語系規定
- 所有 UI 文字、API 錯誤訊息、EJS 模板文字使用**繁體中文**
- Git commit message 使用繁體中文，說明「為什麼」而非「做了什麼」
- API 錯誤代碼（`error` 欄位）使用全大寫英文加底線：`VALIDATION_ERROR`、`NOT_FOUND`

## 命名規則對照表

| 情境 | 規則 | 範例 |
|------|------|------|
| JS 變數 | camelCase | `cartItems`、`adminPassword`、`totalAmount` |
| JS 函式 | camelCase，動詞開頭 | `seedAdminUser()`、`getAdminToken()`、`generateOrderNo()` |
| 路由 handler | 匿名函式，不另命名 | `router.post('/login', (req, res) => { ... })` |
| 路由檔案 | `<資源>Routes.js` | `authRoutes.js`、`cartRoutes.js` |
| Middleware 檔案 | `<功能>Middleware.js` | `authMiddleware.js`、`adminMiddleware.js` |
| 測試檔案 | `<資源>.test.js` | `auth.test.js`、`orders.test.js` |
| SQLite 欄位 | snake_case | `password_hash`、`created_at`、`order_no` |
| JS 取出 DB 欄位 | 保持原始 snake_case，不轉換 | `user.password_hash`、`order.created_at` |
| 環境變數 | 全大寫底線 | `JWT_SECRET`、`ADMIN_EMAIL` |
| localStorage key | 全小寫底線，有前綴 | `flower_token`、`flower_session_id` |

## 模組系統
使用 **CommonJS**（`require` / `module.exports`），**不用 ESM**。

```js
// 正確
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
module.exports = router;

// 禁止
import db from '../database';
export default router;
```

## API 回應格式
**所有端點**必須回傳以下統一結構：

```json
{ "data": <物件|陣列|null>, "error": "<ERROR_CODE>|null", "message": "說明文字" }
```

HTTP 狀態碼：

| 情境 | 狀態碼 | error 欄位範例 |
|------|--------|----------------|
| 成功 | 200 | null |
| 建立成功 | 201 | null |
| 驗證失敗 | 400 | `VALIDATION_ERROR` |
| 購物車為空 | 400 | `CART_EMPTY` |
| 庫存不足 | 400 | `STOCK_INSUFFICIENT` |
| 狀態不允許 | 400 | `INVALID_STATUS` |
| 訂單未發起綠界付款 | 400 | `NO_ECPAY_TRADE` |
| 未登入 | 401 | `UNAUTHORIZED` |
| 無權限 | 403 | `FORBIDDEN` |
| 找不到資源 | 404 | `NOT_FOUND` |
| 資源衝突 | 409 | `CONFLICT` |
| 伺服器錯誤 | 500 | `INTERNAL_ERROR` |
| 綠界 API 呼叫失敗 | 500 | `ECPAY_ERROR` |

## 新增 API 端點步驟

1. **確認路由位置**：查看 ARCHITECTURE.md 路由總覽表，確認要加入哪個路由檔
2. **撰寫 JSDoc**（`@openapi` 格式，讓 swagger-jsdoc 自動產出文件）：

```js
/**
 * @openapi
 * /api/resource:
 *   post:
 *     summary: 操作摘要
 *     tags: [TagName]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [field1]
 *             properties:
 *               field1:
 *                 type: string
 *     responses:
 *       201:
 *         description: 成功說明
 */
router.post('/', authMiddleware, (req, res) => {
  // 業務邏輯
  res.status(201).json({ data: result, error: null, message: '成功' });
});
```

3. **在 app.js 掛載路由**（若為新路由檔）：

```js
app.use('/api/new-resource', require('./src/routes/newResourceRoutes'));
```

4. **更新 FEATURES.md** 的功能清單與狀態

## 新增 Middleware 步驟

1. 在 `src/middleware/` 建立 `<功能>Middleware.js`
2. Export 單一函式 `(req, res, next) => {}`
3. 在路由檔用 `router.use(middleware)` 或 `router.get('/', middleware, handler)` 套用

## 新增資料庫表步驟

1. 在 `src/database.js` 的 `initializeDatabase()` 的 `db.exec()` 中加入 `CREATE TABLE IF NOT EXISTS`
2. 更新 ARCHITECTURE.md 的 DB Schema 區段
3. 若需要種子資料，新增 `seed<TableName>()` 函式並在 `initializeDatabase()` 末尾呼叫

## 資料庫操作規範
使用 `better-sqlite3` 同步 API，**禁止 async/await**：

```js
// 查詢單筆
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

// 查詢多筆
const products = db.prepare('SELECT * FROM products LIMIT ? OFFSET ?').all(limit, offset);

// 插入
db.prepare('INSERT INTO users (id, email, ...) VALUES (?, ?, ...)').run(id, email, ...);

// 批次操作必須用 transaction（不可裸跑多個 prepare）
const createOrder = db.transaction(() => {
  db.prepare('INSERT INTO orders ...').run(...);
  db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(qty, productId);
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
});
createOrder(); // 執行 transaction
```

## 錯誤處理規範

1. **路由層**：直接 `return res.status(N).json({ data: null, error: 'CODE', message: '...' })`
2. **非預期錯誤**：`next(err)` 交給 `errorHandler`（或 `throw` 在 transaction 中）
3. **不在路由層** `console.error`（`errorHandler` 會處理）
4. **`errorHandler`** 過濾邏輯：
   - `statusCode === 500`：固定回「伺服器內部錯誤」
   - `err.isOperational === true`：回傳 `err.message`
   - 其他 4xx：回 `SAFE_MESSAGES[statusCode]`

## 環境變數表

| 變數 | 必要性 | 預設值 | 說明 |
|------|--------|--------|------|
| `JWT_SECRET` | **必填** | 無（缺少則拒絕啟動） | JWT 簽名金鑰 |
| `PORT` | 選填 | `3001` | HTTP 伺服器埠號 |
| `FRONTEND_URL` | 選填 | `http://localhost:3001` | CORS 允許來源 |
| `BASE_URL` | 選填 | `http://localhost:3001` | 基底 URL（OpenAPI server） |
| `ADMIN_EMAIL` | 選填 | `admin@hexschool.com` | 種子管理員 email |
| `ADMIN_PASSWORD` | 選填 | `12345678` | 種子管理員密碼 |
| `NODE_ENV` | 選填 | — | `test` 時 bcrypt saltRounds 降為 1 |
| `ECPAY_MERCHANT_ID` | 選填 | `3002607` | 綠界商店代號（測試環境） |
| `ECPAY_HASH_KEY` | 選填 | 見 .env.example | CheckMacValue HashKey |
| `ECPAY_HASH_IV` | 選填 | 見 .env.example | CheckMacValue HashIV |
| `ECPAY_ENV` | 選填 | `staging` | `staging` 或 `production`（控制 ECPay API 端點） |

## 計畫歸檔流程

### 開始新功能前
1. 在 `docs/plans/` 建立計畫檔案，命名格式：`YYYY-MM-DD-<feature-name>.md`
2. 計畫文件結構：

```markdown
# 計畫：<功能名稱>

## User Story
身為 <角色>，我想要 <行為>，以便 <目的>

## Spec（技術規格）
- API 端點：...
- DB 異動：...
- 影響模組：...

## Tasks
- [ ] 任務一
- [ ] 任務二
- [ ] 更新 FEATURES.md
- [ ] 更新 CHANGELOG.md
```

### 功能完成後
1. 勾選所有 Tasks
2. 將計畫檔案移至 `docs/plans/archive/`
3. 更新 `docs/FEATURES.md`（功能狀態改為 ✅）
4. 更新 `docs/CHANGELOG.md`（新增版本條目）
