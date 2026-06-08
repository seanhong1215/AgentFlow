# 測試指南

## 測試策略

本專案使用 Vitest + Supertest 做 API integration tests。測試直接 `require('../app')`，不啟動 `server.js` 的 network listener，因此測試不會佔用 port。資料庫使用本機 `database.sqlite`，由 `src/database.js` 初始化 schema 與 seed data。

測試重點不是單純確認 HTTP status，而是覆蓋跨模組流程：

- auth token 是否能正確保護會員與管理員 API。
- 訪客購物車與會員購物車是否能分流。
- 結帳是否在 transaction 中扣庫存、建立訂單明細、清空購物車。
- 管理員商品與訂單 API 是否有權限限制。
- 綠界 CheckMacValue、checkout params、QueryTradeInfo 查詢與付款狀態更新是否正確。

## 執行指令

第一次安裝：

```powershell
npm install
```

執行完整測試：

```powershell
$env:JWT_SECRET='test-secret'; npm test
```

若 shell 已設定 `JWT_SECRET`，可直接執行：

```powershell
npm test
```

缺少 `JWT_SECRET` 時，登入與註冊流程會在 `jwt.sign()` 發生 `secretOrPrivateKey must have a value`，導致 auth、cart、orders、admin 相關測試連鎖失敗。

## 目前驗證結果

綠界付款流程最後一次驗證指令：

```powershell
.\node_modules\.bin\vitest.cmd run tests\ecpay.test.js
```

結果：

- 測試檔案：1 個通過
- 測試案例：10 個通過

完整測試 suite 目前仍使用本機 `database.sqlite`。若先前測試已大量扣除 seed 商品庫存，cart/order/admin order 測試可能因 `STOCK_INSUFFICIENT` 或建立訂單失敗而連鎖失敗；這是測試資料持久化問題，不代表綠界 checkout/query 變更失敗。

## Vitest 設定

`vitest.config.js` 使用固定測試順序：

```js
export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    sequence: {
      files: [
        'tests/auth.test.js',
        'tests/products.test.js',
        'tests/cart.test.js',
        'tests/orders.test.js',
        'tests/ecpay.test.js',
        'tests/adminProducts.test.js',
        'tests/adminOrders.test.js',
      ],
    },
    hookTimeout: 10000,
  },
});
```

設定說明：

- `globals: true`: 測試檔可直接使用 `describe`、`it`、`expect`。
- `fileParallelism: false`: 避免多個測試檔同時寫入同一個 SQLite 檔案造成不穩定。
- `sequence.files`: 固定測試順序，讓 auth、products、cart、orders 等流程的資料依賴較容易追蹤。
- `hookTimeout: 10000`: 給 seed、bcrypt 與整合測試較寬鬆的 hook 時間。

## 測試檔案表

| 檔案 | 測試範圍 | 主要依賴 |
| --- | --- | --- |
| `tests/setup.js` | 測試 helper | 匯出 `app`、`request`、`getAdminToken()`、`registerUser()` |
| `tests/auth.test.js` | 註冊、登入、目前使用者 profile | `JWT_SECRET`、admin seed |
| `tests/products.test.js` | 前台商品列表、詳情、404 | products seed |
| `tests/cart.test.js` | 訪客/會員購物車新增、更新、移除、清空 | products seed、`registerUser()`、`X-Session-Id` |
| `tests/orders.test.js` | 建立訂單、扣庫存、查詢訂單、訂單不存在 | `registerUser()`、products seed、cart API |
| `tests/ecpay.test.js` | CheckMacValue、checkout params、每次 checkout 產生新 MerchantTradeNo、failed 訂單重新付款、OrderResultURL、返回後未付款落 failed、client result 強制 failed、paid 防止被強制 failed、QueryTradeInfo paid/unpaid/amount mismatch/fetch failure | orders API、mock `global.fetch`、`ecpayService` |
| `tests/adminProducts.test.js` | 管理員商品 CRUD、一般會員禁止、無 token 禁止 | admin seed、`getAdminToken()` |
| `tests/adminOrders.test.js` | 管理員訂單列表、狀態變更、404、權限限制 | admin seed、測試會員與訂單 |

## Helper 說明

### `tests/setup.js`

`app`:

- 直接 require `../app`。
- 不 require `server.js`，避免測試啟動 HTTP listener。
- route 內的 `jwt.sign()` / `jwt.verify()` 仍依賴環境變數 `JWT_SECRET`。

`request`:

- Supertest instance，可用 `request(app).get('/api/products')` 形式呼叫 API。

`getAdminToken()`:

1. 呼叫 `POST /api/auth/login`。
2. 使用 seed admin：`admin@hexschool.com` / `12345678`。
3. 回傳 `res.body.data.token`。

常見失敗：若 `JWT_SECRET` 缺失，login 回 500，`res.body.data` 為 null，helper 會因讀取 `token` 失敗而拋錯。

`registerUser(overrides = {})`:

1. 產生唯一 email：`test-${Date.now()}-${random}@example.com`。
2. 呼叫 `POST /api/auth/register`。
3. 預設 password 為 `password123`。
4. 回傳 `{ token, user }`。

## 撰寫新測試的步驟

1. 判斷測試是否依賴既有 seed、helper 或前一個流程建立的資料。
2. 新增測試檔時，將檔名加入 `vitest.config.js` 的 `sequence.files`。
3. 會員 API 使用 `registerUser()` 建立 token。
4. 管理員 API 使用 `getAdminToken()`。
5. 需要商品 ID 時，先呼叫 `GET /api/products` 取得 seed 商品。
6. 訪客購物車測試需傳入唯一 `X-Session-Id`，例如 `test-session-${Date.now()}`。
7. 斷言 API 回應格式：成功時 `error: null`；失敗時 `data: null` 與具體 `error.code`。
8. 若 mock 第三方 API，測試結束後要還原 global 狀態。

範例：

```js
const { app, request, registerUser } = require('./setup');

describe('Example API', () => {
  it('should require auth', async () => {
    const res = await request(app).get('/api/orders');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('data', null);
    expect(res.body.error).not.toBeNull();
  });

  it('should return current user orders', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('error', null);
    expect(res.body.data).toHaveProperty('orders');
  });
});
```

## 綠界測試注意事項

`tests/ecpay.test.js` 不會真的打到綠界 staging，而是 mock `global.fetch`。這讓測試可穩定驗證本地端付款確認流程：

- `generateCheckMacValue()` 使用官方 SHA256 測試向量驗證。
- checkout API 確認不把 `HashKey`、`HashIV` 送到前端。
- paid response 會把本地訂單更新為 `paid`。
- unpaid response 會保留本地訂單狀態。
- amount mismatch 會回 `409 ECPAY_AMOUNT_MISMATCH`。
- fetch/network failure 會回 `502 ECPAY_QUERY_FAILED`。

若未來新增退款、取消授權或電子發票，應延續同樣策略：service 層測簽章與參數，route 層測資料庫狀態變化，第三方 HTTP 以 mock 控制。

## 測試資料依賴

- `products.test.js` 依賴 seed products。
- `auth.test.js` 建立測試 user。
- `cart.test.js` 建立 product、session、user cart。
- `orders.test.js` 建立 user、cart、order。
- `ecpay.test.js` 建立 user、cart、order，並 mock 綠界查詢結果。
- `adminProducts.test.js` 依賴 admin token，並建立/更新/刪除測試 product。
- `adminOrders.test.js` 依賴 admin token、測試 user、測試 order。

各測試檔內如需共享 ID，應用 `let` 在 describe scope 保存，例如 `cartItemId`、`orderId`，不要假設其他測試檔留下的資料一定存在。

## 常見陷阱

| 問題 | 原因 | 解法 |
| --- | --- | --- |
| 註冊/登入回 500 | 缺少 `JWT_SECRET` | 測試前設定 `$env:JWT_SECRET='test-secret'` |
| helper 讀不到 token | auth API 失敗，`data` 為 null | 先看 stderr 的「未處理的錯誤」訊息 |
| 購物車 API 回 401 | 缺少 `X-Session-Id` 或 Bearer token | 訪客 cart 加 `.set('X-Session-Id', sessionId)` |
| 會員 cart 沒有合併訪客 cart | 測試未建立 session cart 或未用 Bearer token | 先用 session 加商品，再登入後用 token 呼叫 |
| admin API 回 403 | token 是一般 user | 改用 `getAdminToken()` |
| admin API 回 401 | 沒有 token 或 header 格式錯 | 設定 `Authorization: Bearer ${token}` |
| 商品刪除流程 500 | product 被 `order_items` FK 引用 | 測試刪除前確認商品沒有被訂單使用 |
| 測試資料互相污染 | 共用 `database.sqlite` | 使用唯一 email、session、product name，避免依賴資料筆數 |
| ECPay query 測試不穩 | 忘記 mock 或還原 `global.fetch` | 在測試前保存原始 fetch，afterEach 還原 |

## 建議補強

目前測試已覆蓋主要 happy path 與常見錯誤情境，後續可補：

- cart quantity 超過 stock。
- invalid JWT 不應 fallback 到訪客 session。
- 綠界 staging 手動付款 smoke test。
- admin orders 無 token 401。
- admin product delete 被 paid/failed order item 引用時的行為。
- OpenAPI 產生結果 smoke check。
