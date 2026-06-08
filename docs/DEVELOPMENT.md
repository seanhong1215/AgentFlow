# 開發規範

## 專案開發原則

本專案是教學型全端電商系統，架構刻意維持簡潔：後端使用 Express + CommonJS，資料庫使用 `better-sqlite3`，前端頁面使用 EJS layout 搭配每頁獨立的 Vue CDN script。開發時應優先沿用既有模式，避免導入額外 build pipeline、ORM 或前端框架，除非功能需求已明確超出目前架構能力。

影響跨模組整合的核心規則如下：

- API 回應一律使用 `{ data, error, message }` 結構。
- 會員 API 使用 Bearer JWT，由 `authMiddleware` 寫入 `req.user`。
- 管理員 API 使用 `authMiddleware` 加 `adminMiddleware`，以 `req.user.role === 'admin'` 判斷權限。
- 購物車支援訪客與會員雙模式，使用 `dualAuth` 同時處理 JWT 與 `X-Session-Id`。
- 建立訂單、扣庫存、清空購物車等跨表操作必須使用 `db.transaction()`。
- 綠界付款狀態不得只相信前端回來的網址參數；本地端需主動呼叫綠界 `QueryTradeInfo` 驗證。

## 命名規則對照表

| 類型 | 規則 | 範例 | 說明 |
| --- | --- | --- | --- |
| Route file | lower camel + `Routes.js` | `adminProductRoutes.js` | 放在 `src/routes/` |
| Middleware file | lower camel + `Middleware.js` | `authMiddleware.js` | 放在 `src/middleware/` |
| Service file | lower camel + `Service.js` | `ecpayService.js` | 放在 `src/services/`，封裝第三方 API 或共享商業邏輯 |
| EJS page | kebab-case | `product-detail.ejs` | 放在 `views/pages/` |
| Admin EJS page | plural noun | `products.ejs` | 放在 `views/pages/admin/` |
| Page script | kebab-case | `order-detail.js` | 由 `pageScript` 注入 layout |
| API route param | path id + camelCase body | `:itemId`, `recipientName` | URL 參數用 id 類型名稱，JSON body 用 camelCase |
| DB table | snake_case plural | `cart_items`, `order_items` | SQLite schema |
| DB column | snake_case | `order_no`, `created_at` | SQL 與 API 目前多直接回傳 snake_case |
| JWT payload | camelCase | `userId`, `role` | token payload 與 JS 變數一致 |
| Error code | UPPER_SNAKE_CASE | `VALIDATION_ERROR` | API `error.code` |
| localStorage key | lower snake with domain prefix | `flower_token` | 定義於 `public/js/auth.js` |
| Test file | feature + `.test.js` | `ecpay.test.js` | 放在 `tests/`，並加入 `vitest.config.js` sequence |
| Plan file | `YYYY-MM-DD-<feature-name>.md` | `2026-05-30-ecpay-payment-integration.md` | 放在 `docs/plans/` |

## 模組系統說明

後端應使用 CommonJS：

```js
const express = require('express');

const router = express.Router();

module.exports = router;
```

`vitest.config.js` 是例外，使用 ESM `import { defineConfig } from 'vitest/config'`，因為 Vitest 設定檔本身支援 ESM。不要把後端 route、middleware、service 混成 ESM，否則 `require()` 載入方式會不一致。

前端每頁 script 應使用 browser global：

- `Vue` 由 CDN 提供。
- `Auth` 由 `/js/auth.js` 提供。
- `apiFetch` 由 `/js/api.js` 提供。
- `Notification` 由 `/js/notification.js` 提供。

每頁 script 不應使用 `import/export`，因為目前頁面沒有 bundler。

## 新增 API 的步驟

1. 在 `src/routes/` 建立或修改對應 router。
2. 判斷認證模式：
   - 公開 API 不掛 middleware。
   - 會員 API 使用 `authMiddleware`。
   - 管理員 API 使用 `authMiddleware, adminMiddleware`。
   - 同時支援訪客與會員的 API 使用 `dualAuth`，並明確定義 owner 條件。
3. 驗證 request body、query params 與 path params；驗證失敗回 `400` + `VALIDATION_ERROR` 或更明確錯誤碼。
4. SQL 必須使用 prepared statement：`db.prepare(sql).get/all/run(...)`。
5. 跨表寫入或需要一致性的流程使用 `db.transaction()`。
6. 回應格式固定為 `{ data, error, message }`。
7. 新增或更新 OpenAPI JSDoc。
8. 若新增頁面，更新 `src/routes/pageRoutes.js`、EJS page 與 page script。
9. 新增或更新測試。
10. 更新 `docs/FEATURES.md`、`docs/ARCHITECTURE.md`、`docs/CHANGELOG.md`。

## 新增 Middleware 的步驟

1. 在 `src/middleware/` 建立 `xxxMiddleware.js`。
2. 一般 middleware 使用 `(req, res, next)`；error handler 才使用 `(err, req, res, next)`。
3. middleware 應回傳一致 JSON 錯誤格式，不要直接回 HTML。
4. 若 middleware 寫入 request state，需明確命名，例如 `req.user`、`req.sessionId`。
5. 在 `app.js` 或 router 中以最小需要範圍套用。
6. 新增測試覆蓋未登入、權限不足、正常通過三種情境。

## 新增或修改 DB Schema 的步驟

目前 schema 集中於 `src/database.js`。`CREATE TABLE IF NOT EXISTS` 只能建立新資料庫時生效；既有本機 `database.sqlite` 不會自動套用新欄位，因此修改 schema 時需同步 migration。

1. 修改 `src/database.js` 中的 schema。
2. 若是既有資料表新增欄位，使用 `ensureColumn()` 類型的 migration，以 `PRAGMA table_info(table)` 判斷欄位是否存在，再執行 `ALTER TABLE`。
3. 新增 index 時使用 `CREATE INDEX IF NOT EXISTS` 或 `CREATE UNIQUE INDEX IF NOT EXISTS`。
4. 需要一致性的資料異動使用 `db.transaction()`。
5. 更新 `docs/ARCHITECTURE.md` 的 schema 表格。
6. 更新測試，避免依賴既有 `database.sqlite` 的狀態。

## 環境變數

| 變數 | 用途 | 必要性 | 預設值 / 行為 |
| --- | --- | --- | --- |
| `JWT_SECRET` | JWT 簽章 secret | 必要 | 測試與登入流程需要；缺少時 `jwt.sign()` 會失敗 |
| `PORT` | HTTP server port | 選填 | `3001` |
| `BASE_URL` | 本地站台 base URL | 選填 | `.env.example` 為 `http://localhost:3001`；用於綠界 `ClientBackURL` |
| `FRONTEND_URL` | CORS allowed origin | 選填 | `app.js` 預設 `http://localhost:3001`；`.env.example` 為 `http://localhost:5173` |
| `ADMIN_EMAIL` | seed admin email | 選填 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | seed admin password | 選填 | `12345678` |
| `NODE_ENV` | 執行環境 | 選填 | `test` 時 admin seed bcrypt rounds 為 1，其餘為 10 |
| `ECPAY_MERCHANT_ID` | 綠界特店編號 | 選填 | 預設測試特店 `2000132` |
| `ECPAY_HASH_KEY` | 綠界 CheckMacValue HashKey | 選填 | 預設測試 HashKey `5294y06JbISpM5x9` |
| `ECPAY_HASH_IV` | 綠界 CheckMacValue HashIV | 選填 | 預設測試 HashIV `v77hoKGq4kWxNNIS` |
| `ECPAY_ENV` | 綠界環境 | 選填 | `staging` 使用 `payment-stage.ecpay.com.tw`；其他值視為 production |
| `ECPAY_RETURN_URL` | 綠界 AIO ReturnURL | 選填 | 預設 `${BASE_URL}/api/ecpay/notify`；本地端通常無法被綠界打到 |

## 綠界開發規範

本專案採用綠界 AIO 跳轉付款，服務邏輯集中在 `src/services/ecpayService.js`。任何新增付款功能時，應先沿用該 service，不要在 route 或前端重寫 CheckMacValue。

核心規則：

1. `MerchantTradeNo` 必須是英數字且不超過 20 字元。
2. checkout 參數必須包含 `EncryptType=1`，並以 SHA256 產生 `CheckMacValue`。
3. `ItemName` 使用 `#` 串接品項，並限制長度，避免超過綠界欄位限制。
4. QueryTradeInfo 每次呼叫都要產生新的 `TimeStamp`，不可重用舊時間。
5. 綠界查詢回應必須驗證 `CheckMacValue`，驗證失敗不可更新訂單為 paid。
6. `TradeStatus === '1'` 才能將訂單更新為 `paid`。
7. 查詢金額必須等於本地 `orders.total_amount`，否則回 `ECPAY_AMOUNT_MISMATCH` 並保持原訂單狀態。
8. 本地開發無法依賴 Server Notify，`/api/ecpay/notify` 只作為可到達時的 acknowledgement，真正狀態更新由 `/api/orders/:id/ecpay/query` 完成。

## JSDoc / OpenAPI 格式

Route handler 前方可加入 `@openapi` 註解，供 `npm run openapi` 產生規格。格式範例：

```js
/**
 * @openapi
 * /api/example:
 *   post:
 *     summary: Create example resource
 *     tags: [Examples]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Validation error
 */
router.post('/example', authMiddleware, (req, res) => {
  // handler
});
```

目前安全 schemes 定義於 `swagger-config.js`：

- `bearerAuth`: JWT。
- `sessionId`: `X-Session-Id`。

## 前端頁面開發規範

EJS page route 需透過 `renderFront()` 或 `renderAdmin()` 傳入 `title` 與 `pageScript`。新增頁面的流程：

1. 建立 `views/pages/<page>.ejs` 或 `views/pages/admin/<page>.ejs`。
2. 建立 `public/js/pages/<page>.js`。
3. 在 `src/routes/pageRoutes.js` 新增 route，並指定 `pageScript`。
4. 若頁面需要登入，在 page script 開頭呼叫 `Auth.requireAuth()`；管理頁面使用 `Auth.requireAdmin()`。
5. API 呼叫應使用 `apiFetch()`，讓 token、401 處理與錯誤格式維持一致。
6. 表單送出應處理 loading 狀態，避免重複提交。
7. 顯示錯誤時使用 `Notification`，不要只寫 `console.error()`。

## 計畫歸檔流程

1. 計畫檔案命名格式：`YYYY-MM-DD-<feature-name>.md`
2. 計畫文件結構：User Story → Spec → Tasks
3. 功能完成後：移至 `docs/plans/archive/`
4. 更新 `docs/FEATURES.md` 和 `docs/CHANGELOG.md`

計畫文件範例：

```markdown
# YYYY-MM-DD Feature Name

## User Story
As a ...
I want ...
So that ...

## Spec
- API:
- DB:
- UI:
- Error cases:

## Tasks
- [ ] Update schema/routes
- [ ] Update frontend
- [ ] Add tests
- [ ] Update docs
```
