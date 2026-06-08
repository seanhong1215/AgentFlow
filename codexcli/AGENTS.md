# AGENTS.md

## 專案概述

backend-project — Node.js Express 4 + EJS + Vue 3 CDN + SQLite/better-sqlite3 的花卉電商教學專案。系統包含商品瀏覽、購物車、會員結帳、訂單、管理員商品/訂單查詢，以及綠界 ECPay AIO 金流串接。本專案僅運行於本地端，因此綠界付款結果以本地端主動呼叫 `QueryTradeInfo` 驗證，不依賴 Server Notify。

## 常用指令

| 指令 | 用途 |
| --- | --- |
| `npm install` | 安裝 dependencies 與 devDependencies |
| `npm run dev:server` | 啟動 Express server，預設 `http://localhost:3001` |
| `npm run dev:css` | 啟動 Tailwind CLI watch，輸出 `public/css/output.css` |
| `npm run css:build` | 產生 minified CSS |
| `npm start` | build CSS 後啟動 `server.js` |
| `npm run openapi` | 由 route JSDoc 產生 `openapi.json` |
| `npm test` | 執行 Vitest 測試，需先設定 `JWT_SECRET` |
| `$env:JWT_SECRET='test-secret'; npm test` | Windows PowerShell 測試指令 |

## 關鍵規則

- API 回應固定使用 `{ data, error, message }`；成功時 `error: null`，失敗時 `data: null` 並提供穩定錯誤碼。
- JWT 使用 HS256，payload 為 `{ userId, email, role }`，有效期 7 天；會員 API 必須經過 `authMiddleware`。
- 購物車支援雙模式認證：有 Bearer token 時使用 `user_id`，無 token 時使用 `X-Session-Id` 與 `session_id`；無效 token 不可 fallback 到 session。
- 建立訂單必須使用 database transaction，同步完成建立訂單、建立明細、扣庫存與清空會員購物車。
- 綠界付款不可只相信前端導回；本地端付款確認必須呼叫 `/api/orders/:id/ecpay/query`，由後端查詢綠界 `QueryTradeInfo` 並驗證 CheckMacValue。
- 功能開發使用 `docs/plans/` 記錄計畫；完成後移至 `docs/plans/archive/`，並更新 `docs/FEATURES.md` 與 `docs/CHANGELOG.md`。

## 詳細文件

- ./docs/README.md — 項目介紹與快速開始
- ./docs/ARCHITECTURE.md — 架構、目錄結構、資料流
- ./docs/DEVELOPMENT.md — 開發規範、命名規則
- ./docs/FEATURES.md — 功能列表與完成狀態
- ./docs/TESTING.md — 測試規範與指南
- ./docs/CHANGELOG.md — 更新日誌
