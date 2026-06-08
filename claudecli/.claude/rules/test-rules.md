---
name: test-rules
description: 測試規則：Vitest + Supertest、不 mock DB、執行順序、輔助函式
paths:
  - "tests/**"
---

# 測試規則

## 框架與工具
- 測試框架：Vitest（`npm test`）
- HTTP 測試：Supertest（`import request from 'supertest'`）
- 設定檔：`vitest.config.js`（固定執行順序、禁並行）

## 不 mock 資料庫
測試必須使用真實 SQLite（記憶體模式或測試 DB），**禁止** mock `better-sqlite3`。
原因：mock DB 曾導致真實遷移問題在測試中無法被發現。

## 執行順序
測試檔案依以下順序執行（`vitest.config.js` 固定）：
1. `auth.test.js`
2. `products.test.js`
3. `cart.test.js`
4. `orders.test.js`
5. `adminProducts.test.js`
6. `adminOrders.test.js`

## 輔助函式（tests/setup.js）
- `getAdminToken()` — 取得管理員 JWT，用於需 admin 認證的端點
- `registerUser()` — 註冊測試用一般使用者並取得 JWT

## 撰寫新測試
新功能必須附帶整合測試，測試必須覆蓋：
- 成功路徑（2xx）
- 驗證失敗（400）
- 認證失敗（401/403）
- 找不到資源（404）

測試檔案放在 `tests/` 目錄，命名格式：`<資源>.test.js`。
