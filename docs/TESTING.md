# 測試規範

## 測試框架
- **Vitest**（測試執行器）
- **Supertest**（HTTP 整合測試）
- 測試直接打 Express app，**不 mock 資料庫**（使用真實 SQLite，測試用臨時 DB）

## 執行測試
```powershell
npm test          # 執行全部測試
```

測試需要設定環境變數（在 `.env` 或測試環境中）：
```
JWT_SECRET=test-secret
NODE_ENV=test
```

## 測試結構
```
tests/
├── setup.js              # 共用工具：getAdminToken()、registerUser()
├── auth.test.js          # 認證測試（register、login、profile）
├── products.test.js      # 商品 API 測試
├── cart.test.js          # 購物車 API 測試
├── orders.test.js        # 訂單 API 測試
├── adminProducts.test.js # 管理員商品 API 測試
└── adminOrders.test.js   # 管理員訂單 API 測試
```

## 測試執行順序
`vitest.config.js` 中設定固定順序（`fileParallelism: false`），依序執行：
1. auth → 2. products → 3. cart → 4. orders → 5. adminProducts → 6. adminOrders

**不可並行**：各測試共用同一個 SQLite 資料庫實例，並行會造成資料競爭。

## 共用工具（tests/setup.js）

```js
const { request, getAdminToken, registerUser } = require('./setup');

// 取得管理員 JWT Token
const adminToken = await getAdminToken();

// 註冊一般使用者並取得 Token
const { token, user } = await registerUser();
const { token } = await registerUser({ email: 'custom@example.com', password: 'pass123' });
```

## 撰寫測試範例

### 基本 API 測試
```js
import { describe, it, expect } from 'vitest';
import { request } from './setup';

describe('GET /api/products', () => {
  it('公開端點應回傳商品列表', async () => {
    const res = await request.get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.error).toBeNull();
  });
});
```

### 需要認證的端點
```js
import { describe, it, expect, beforeAll } from 'vitest';
import { request, getAdminToken } from './setup';

describe('POST /api/admin/products', () => {
  let adminToken;
  beforeAll(async () => { adminToken = await getAdminToken(); });

  it('admin 可新增商品', async () => {
    const res = await request
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '測試商品', price: 100, stock: 10 });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeTruthy();
  });

  it('未登入應回傳 401', async () => {
    const res = await request.post('/api/admin/products').send({});
    expect(res.status).toBe(401);
  });
});
```

## 測試覆蓋重點
每個 API 端點測試須包含：
- **成功情境**：正確參數，驗證回傳資料結構
- **驗證失敗**：缺少必填欄位 → 400
- **未授權**：不帶 token 或一般用戶呼叫 admin 端點 → 401/403
- **資源不存在**：傳入不存在的 ID → 404

## 注意事項
- 測試帳號使用動態 email（`test-<timestamp>-<random>@example.com`）避免衝突
- 管理員帳號固定：`admin@hexschool.com` / `12345678`（種子資料）
- `NODE_ENV=test` 時 bcrypt saltRounds 降為 1，加速測試
- 測試結束後資料庫不自動清理（下次啟動會重用同一 SQLite 檔）
