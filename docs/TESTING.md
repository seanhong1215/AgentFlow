# 測試規範

## 測試框架
- **Vitest**（測試執行器，替代 Jest）
- **Supertest**（HTTP 整合測試，直接測 Express app）
- **不 mock 資料庫**：使用真實 better-sqlite3，資料落地於 `database.sqlite`

## 執行測試

```powershell
# 需要 .env 有設定 JWT_SECRET
npm test
```

若 `.env` 不存在，最快設定方式：
```powershell
Copy-Item .env.example .env
# .env.example 已有合法 JWT_SECRET 格式，可直接用
```

## 測試檔案表

| 檔案 | 對應模組 | 執行順序 |
|------|----------|----------|
| `tests/auth.test.js` | `/api/auth` | 1 |
| `tests/products.test.js` | `/api/products` | 2 |
| `tests/cart.test.js` | `/api/cart` | 3 |
| `tests/orders.test.js` | `/api/orders` | 4 |
| `tests/adminProducts.test.js` | `/api/admin/products` | 5 |
| `tests/adminOrders.test.js` | `/api/admin/orders` | 6 |
| `tests/setup.js` | 共用工具 | — |

## 執行順序與依賴關係

`vitest.config.js` 設定 `fileParallelism: false` 並固定 `sequence.files` 順序。

**關鍵依賴**：
- `orders.test.js` 在 `beforeAll` 中會先呼叫 `registerUser()` 然後 `POST /api/cart`，需要購物車有商品才能建立訂單
- `adminOrders.test.js` 依賴 `orders.test.js` 已建立訂單資料
- **不可並行**：所有測試共用同一個 `database.sqlite` 實例，並行操作會造成資料競爭

## 共用工具（tests/setup.js）

```js
const { app, request, getAdminToken, registerUser } = require('./setup');
```

### `request`
Supertest 的 `request` 函式（未呼叫前不啟動 server）：
```js
const res = await request(app).get('/api/products');
```

### `getAdminToken()`
登入種子管理員帳號，回傳 JWT token：
```js
const adminToken = await getAdminToken();
// 使用：.set('Authorization', `Bearer ${adminToken}`)
```
管理員帳號：`admin@hexschool.com` / `12345678`（種子資料）

### `registerUser(overrides = {})`
註冊一個新的測試用戶，回傳 `{ token, user }`：
```js
const { token, user } = await registerUser();
// 客製化
const { token } = await registerUser({
  email: 'custom@example.com',
  password: 'mypass123',
  name: '自訂名稱'
});
```
預設 email 格式：`test-<timestamp>-<random>@example.com`（確保每次測試唯一）

## 撰寫新測試步驟

1. **確認測試位置**：在對應的 `tests/*.test.js` 加入 `describe`/`it` 區塊
2. **若需要認證**：在 `beforeAll` 取得 token，避免每個 case 重複登入
3. **覆蓋以下情境**（每個端點）：

```
✅ 成功情境 → 驗證 status code、data 結構、關鍵欄位值
✅ 驗證失敗 → 缺少必填欄位 → 400
✅ 未授權 → 不帶 token → 401
✅ 無權限 → 一般用戶呼叫 admin 端點 → 403
✅ 資源不存在 → 不存在的 ID → 404
✅ 業務邏輯邊界 → 庫存不足、購物車為空、重複操作等
```

## 撰寫測試範例

### 基本 GET 測試（公開端點）
```js
import { describe, it, expect } from 'vitest';
const { request, app } = require('./setup');

describe('GET /api/products', () => {
  it('應回傳商品列表與分頁資訊', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(Array.isArray(res.body.data.products)).toBe(true);
    expect(res.body.data.pagination).toHaveProperty('total');
    expect(res.body.data.pagination).toHaveProperty('totalPages');
  });

  it('分頁參數應正常作用', async () => {
    const res = await request(app).get('/api/products?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data.products.length).toBeLessThanOrEqual(2);
    expect(res.body.data.pagination.limit).toBe(2);
  });
});
```

### 需要認證的端點（Admin）
```js
const { request, app, getAdminToken, registerUser } = require('./setup');

describe('POST /api/admin/products', () => {
  let adminToken;
  let userToken;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    const { token } = await registerUser();
    userToken = token;
  });

  it('admin 可新增商品', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '測試玫瑰', price: 100, stock: 10 });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.name).toBe('測試玫瑰');
    expect(res.body.error).toBeNull();
  });

  it('未登入應回傳 401', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .send({ name: '未授權商品', price: 100, stock: 5 });
    expect(res.status).toBe(401);
    expect(res.body.error).not.toBeNull();
  });

  it('一般用戶應回傳 403', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: '無權限商品', price: 100, stock: 5 });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });
});
```

### 購物車雙模式測試
```js
describe('GET /api/cart', () => {
  it('使用 JWT 可查詢購物車', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('使用 X-Session-Id 可查詢訪客購物車', async () => {
    const res = await request(app)
      .get('/api/cart')
      .set('X-Session-Id', 'test-session-uuid-1234');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('兩者皆無應回傳 401', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(401);
  });
});
```

## 常見陷阱

### 1. 訂單測試依賴購物車狀態
`orders.test.js` 中，第一個建立訂單的測試成功後，購物車會被清空。後續測試若再次呼叫 `POST /api/orders` 會得到 `CART_EMPTY`（400）。這是正確行為，測試已驗證此情境。

### 2. 資料庫不自動清理
測試結束後 `database.sqlite` 不刪除。重複執行測試時，種子管理員已存在（`seedAdminUser` 的 `SELECT` 先檢查）、種子商品若已有資料也不會重複插入。但測試用的一般用戶會不斷累積（email 包含 timestamp，不重複）。

### 3. bcrypt 加速
`NODE_ENV=test` 時 `saltRounds = 1`（正常為 10），大幅縮短測試中帳號建立的時間。在 `.env` 設定或測試指令前置 `NODE_ENV=test`。

### 4. 測試不可並行
`vitest.config.js` 已設定 `fileParallelism: false`，**不可改為 true**，否則測試會因共用 DB 產生競爭狀態（race condition）。

### 5. 購物車 session 測試
訪客購物車的 `session_id` 從 `X-Session-Id` header 讀取。測試中直接用 `.set('X-Session-Id', 'any-string')` 傳入即可，不需要模擬瀏覽器 localStorage。
