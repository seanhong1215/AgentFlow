# CLAUDE.md

## 專案概述
花卉電商平台 — Node.js + Express 4 + EJS + SQLite (better-sqlite3) + JWT 認證 + Vue CDN 前端互動

## 常用指令
```powershell
npm run dev:server   # 啟動後端（port 3001）
npm run dev:css      # 監聽 Tailwind CSS 變更
npm start            # 建置 CSS 後啟動
npm test             # 執行 Vitest 整合測試
npm run openapi      # 產出 openapi.json
```

## 關鍵規則
- **API 回應格式統一**：所有端點回傳 `{ data, error, message }`，error 為 null 或錯誤代碼字串
- **購物車雙模式認證**：`/api/cart` 接受 JWT Bearer Token **或** `X-Session-Id` header（未登入訪客購物車）
- **DB 操作同步**：使用 better-sqlite3 同步 API，禁止 async/await 操作 DB
- **功能開發使用 docs/plans/ 記錄計畫；完成後移至 docs/plans/archive/**
- **語系**：所有 UI 文字、錯誤訊息、commit message 使用繁體中文

## 詳細文件
- [docs/README.md](docs/README.md) — 項目介紹與快速開始
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 架構、目錄結構、資料流、DB Schema
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — 開發規範、命名規則、計畫歸檔流程
- [docs/FEATURES.md](docs/FEATURES.md) — 功能列表、行為描述、完成狀態
- [docs/TESTING.md](docs/TESTING.md) — 測試規範與指南
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — 更新日誌
