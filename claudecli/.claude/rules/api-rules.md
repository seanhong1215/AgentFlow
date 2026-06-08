---
name: api-rules
description: API 端點設計規則：回應格式、路由命名、認證模式、JSDoc 格式
paths:
  - "src/routes/**"
---

# API 設計規則

## 統一回應格式
**所有端點**必須回傳以下結構，不得偏離：
```json
{ "data": <物件|陣列|null>, "error": "<ERROR_CODE>|null", "message": "說明文字（繁體中文）" }
```
- 成功時 `error: null`
- 失敗時 `data: null`，`error` 為全大寫底線的錯誤代碼（如 `VALIDATION_ERROR`）

## 路由命名
- 路由檔案命名：`<資源>Routes.js`（如 `authRoutes.js`）
- 路由 handler 使用匿名函式，不另命名
- URL 使用 kebab-case（如 `/order-result`，不用 `/orderResult`）

## 認證模式
- 需登入：使用 `authMiddleware`（Bearer JWT）
- 管理員：`authMiddleware` + `adminMiddleware`（鏈式）
- 購物車：`dualAuth`（JWT 或 X-Session-Id，兩者皆可）
- 公開端點（ECPay callback）：不套用 authMiddleware

## JSDoc 格式（swagger-jsdoc）
每個端點必須有 `@openapi` 格式的 JSDoc，讓 `npm run openapi` 能自動產出文件：
```js
/**
 * @openapi
 * /api/resource:
 *   post:
 *     summary: 操作摘要
 *     tags: [TagName]
 *     security:
 *       - bearerAuth: []
 */
```

## 錯誤代碼清單
| 情境 | 狀態碼 | error |
|------|--------|-------|
| 驗證失敗 | 400 | `VALIDATION_ERROR` |
| 購物車為空 | 400 | `CART_EMPTY` |
| 庫存不足 | 400 | `STOCK_INSUFFICIENT` |
| 狀態不允許 | 400 | `INVALID_STATUS` |
| 訂單未發起綠界 | 400 | `NO_ECPAY_TRADE` |
| 未登入 | 401 | `UNAUTHORIZED` |
| 無權限 | 403 | `FORBIDDEN` |
| 找不到 | 404 | `NOT_FOUND` |
| 衝突 | 409 | `CONFLICT` |
| 伺服器錯誤 | 500 | `INTERNAL_ERROR` |
| 綠界 API 失敗 | 500 | `ECPAY_ERROR` |
