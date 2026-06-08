# 花卉電商平台

花卉電商 Web 應用，支援商品瀏覽、購物車（訪客與登入雙模式）、訂單建立與管理員後台。

## 技術棧

| 層次 | 技術 |
|------|------|
| 後端框架 | Node.js + Express 4 |
| 模板引擎 | EJS（伺服器端渲染） |
| 資料庫 | SQLite（better-sqlite3，同步 API） |
| 認證 | JWT（jsonwebtoken，HS256，7 天有效期） |
| 前端互動 | Vue 3 CDN + Tailwind CSS 4 |
| 密碼雜湊 | bcrypt（production saltRounds=10） |
| ID 生成 | uuid v4 |
| 測試 | Vitest + Supertest |
| API 文件 | swagger-jsdoc（OpenAPI 3.0） |

## 快速開始

```powershell
# 1. 安裝依賴
npm install

# 2. 設定環境變數
Copy-Item .env.example .env
# 編輯 .env，至少填入 JWT_SECRET

# 3. 啟動開發伺服器
npm run dev:server

# 4. （選用）監聽 CSS 變更
npm run dev:css
```

伺服器預設在 `http://localhost:3001` 啟動。

### 預設帳號
| 角色 | Email | 密碼 |
|------|-------|------|
| 管理員 | admin@hexschool.com | 12345678 |

## 常用指令

| 指令 | 說明 |
|------|------|
| `npm run dev:server` | 啟動後端（不含 CSS watch） |
| `npm run dev:css` | 監聽 Tailwind CSS 變更 |
| `npm start` | 建置 CSS 後啟動（production 用） |
| `npm test` | 執行全部測試 |
| `npm run openapi` | 產出 openapi.json |

## 文件索引

| 文件 | 說明 |
|------|------|
| [CLAUDE.md](../CLAUDE.md) | AI Agent 記憶文件（快速參考） |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 架構、目錄結構、資料流、DB Schema |
| [DEVELOPMENT.md](DEVELOPMENT.md) | 開發規範、命名規則、計畫歸檔流程 |
| [FEATURES.md](FEATURES.md) | 功能列表、行為描述、完成狀態 |
| [TESTING.md](TESTING.md) | 測試規範與指南 |
| [CHANGELOG.md](CHANGELOG.md) | 更新日誌 |
| [plans/](plans/) | 開發計畫（進行中） |
| [plans/archive/](plans/archive/) | 已完成計畫歸檔 |
