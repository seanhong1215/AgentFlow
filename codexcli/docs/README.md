# backend-project 文件

## 項目介紹

backend-project 是一個本地端花卉電商示範系統。前台提供商品列表、商品詳情、購物車、會員登入、結帳建立訂單與訂單詳情；後台提供管理員商品管理與訂單查詢。付款流程已接入綠界 ECPay AIO，使用者在訂單詳情頁前往綠界付款，按「返回商店」回到本地訂單頁後，頁面會自動呼叫後端查詢綠界 `QueryTradeInfo` 驗證付款結果。

這個專案不是 SPA build 架構，而是 Express 同時提供 API 與 EJS 頁面。每個頁面由 EJS layout 載入 Vue 3 CDN 與對應的 `public/js/pages/*.js`。資料庫使用 SQLite，schema、migration 與 seed data 集中在 `src/database.js`。

## 技術棧

| 類別 | 技術 | 用途 |
| --- | --- | --- |
| Runtime | Node.js | 執行 Express server、測試與工具 script |
| Web framework | Express 4 | API routes、page routes、middleware pipeline |
| View | EJS | server-rendered layout 與頁面模板 |
| Frontend | Vue 3 global build via CDN | 每頁互動、表單、API 呼叫 |
| Database | SQLite + better-sqlite3 | 本地資料儲存、同步 transaction、seed data |
| Auth | jsonwebtoken + bcrypt | JWT 登入、密碼 hash、管理員權限 |
| ID | uuid v4 | users/products/cart_items/orders/order_items 主鍵 |
| CSS | Tailwind CSS CLI | 從 `public/css/input.css` 產生 `public/css/output.css` |
| API docs | swagger-jsdoc | 從 route JSDoc 產生 OpenAPI spec |
| Testing | Vitest + Supertest | API integration tests |
| Payment | ECPay AIO | 綠界跳轉付款；本地端使用 QueryTradeInfo 主動確認付款 |

## 快速開始

Windows PowerShell:

```powershell
npm install
Copy-Item .env.example .env
notepad .env
npm run css:build
npm run dev:server
```

`.env` 至少需要設定：

```env
JWT_SECRET=replace-with-a-development-secret
BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3001
ADMIN_EMAIL=admin@hexschool.com
ADMIN_PASSWORD=12345678
ECPAY_ENV=staging
```

啟動後開啟：

```text
http://localhost:3001
```

預設管理員帳號：

```text
email: admin@hexschool.com
password: 12345678
```

## 常用指令

| 指令 | 說明 | 注意事項 |
| --- | --- | --- |
| `npm install` | 安裝 dependencies 與 devDependencies | 會建立 `node_modules/` |
| `npm run dev:server` | 啟動 `server.js` | 需要 `JWT_SECRET`，預設 port `3001` |
| `npm run dev:css` | Tailwind watch mode | 修改 CSS 時使用 |
| `npm run css:build` | 產生 minified CSS | `npm start` 會自動先執行 |
| `npm start` | build CSS 後啟動 server | production-like 啟動方式 |
| `npm run openapi` | 產生 `openapi.json` | 依賴 route JSDoc |
| `npm test` | 執行 API integration tests | shell 需已有 `JWT_SECRET` |
| `$env:JWT_SECRET='test-secret'; npm test` | PowerShell 一次性設定 secret 後跑測試 | 推薦本機驗證使用 |

## 綠界付款測試

訂單成立後進入訂單詳情頁，按「前往綠界付款」會以 hidden form POST 到綠界測試付款頁。付款完成後按綠界頁面的「返回商店」回到本地訂單頁，頁面會自動呼叫後端查詢綠界 `QueryTradeInfo`，驗證 CheckMacValue 與金額後才把訂單改為 `paid`。若綠界資料尚未同步，頁面會短時間重試，並保留「重新確認付款狀態」按鈕。

測試環境可使用：

```text
Card: 4311-9522-2222-2222
CVV: 任意 3 碼
3D 驗證碼: 1234
```

本專案跑在 localhost，綠界通常無法呼叫本機 `ReturnURL` / Server Notify，因此不要把瀏覽器導回視為付款成功。付款成功與否以返回商店後自動查詢綠界 `QueryTradeInfo` 的結果為準。

## 文件索引

| 文件 | 內容 |
| --- | --- |
| `AGENTS.md` | 給開發代理使用的專案摘要、常用指令、關鍵規則與文件索引 |
| `docs/ARCHITECTURE.md` | 架構、目錄結構、啟動流程、API 路由、認證、schema、綠界整合 |
| `docs/DEVELOPMENT.md` | 命名規則、模組規範、新增 API/middleware/DB 流程、環境變數、計畫歸檔 |
| `docs/FEATURES.md` | 功能清單、端點、業務邏輯、錯誤碼、非標準機制 |
| `docs/TESTING.md` | 測試策略、執行順序、helper、撰寫新測試方式與常見陷阱 |
| `docs/CHANGELOG.md` | 更新日誌 |
| `docs/plans/` | 開發計畫 |
| `docs/plans/archive/` | 已完成計畫歸檔 |

## 目前測試狀態

最後驗證：

```powershell
$env:JWT_SECRET='test-secret'; npm test
```

目前針對綠界付款流程的驗證：

```powershell
.\node_modules\.bin\vitest.cmd run tests\ecpay.test.js
```

## 綠界付款結果返回說明

`ClientBackURL` 會返回 `/orders/:id?payment=returned`，頁面會短時間重試 `QueryTradeInfo`。`OrderResultURL` 會返回 `/orders/:id?payment=result`；頁面會先查詢綠界付款狀態，若無法確認訂單已付款，就呼叫 `/api/orders/:id/ecpay/fail` 將本地狀態強制改為 `failed`。付款失敗的訂單不再顯示手動確認按鈕，但可以用新的 `MerchantTradeNo` 重新建立綠界付款流程。

結果：`tests/ecpay.test.js` 12 個 tests 全部通過。完整測試若共用既有 `database.sqlite`，可能因 seed 商品庫存已被先前測試扣光而失敗；需重置測試資料庫或補測試商品後再跑完整 suite。
