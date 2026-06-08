# CLAUDE.md — 花卉電商平台（Claude CLI 版）

## 專案概述
Node.js + Express 花卉電商平台，使用 EJS 模板、SQLite 資料庫、JWT 認證。

## 技術棧
- **後端**：Node.js、Express 4、better-sqlite3、bcrypt、jsonwebtoken、uuid
- **前端**：EJS、Tailwind CSS 4、Vue CDN（頁面互動）
- **測試**：Vitest + Supertest
- **API 文件**：swagger-jsdoc

## 目錄結構
```
claudecli/
├── app.js              # Express 應用設定（middleware、路由掛載）
├── server.js           # HTTP 伺服器啟動入口
├── src/
│   ├── database.js     # SQLite 初始化與種子資料
│   ├── middleware/     # auth、admin、error、session
│   └── routes/         # API 路由
├── views/              # EJS 模板（layouts、pages、partials）
├── public/             # 靜態資源（CSS、JS）
├── tests/              # Vitest 整合測試
└── docs/               # 詳細文件（見下方）
```

## 詳細文件
| 文件 | 說明 |
|------|------|
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | 命名規則、程式碼風格、錯誤處理 |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 架構全覽、資料流、模組互動 |
| [FEATURES.md](docs/FEATURES.md) | 功能清單與狀態 |
| [TESTING.md](docs/TESTING.md) | 測試規範與範例 |

## 快速啟動
```powershell
npm install
Copy-Item .env.example .env   # 填入 JWT_SECRET
npm run dev:server
```

## API 回應格式（所有端點統一）
```json
{ "data": ..., "error": "ERROR_CODE | null", "message": "說明文字" }
```

## 關鍵規則
1. **資料庫操作**：直接使用 `better-sqlite3` 同步 API，不用 ORM
2. **認證**：JWT Bearer Token，7 天有效，透過 `authMiddleware` 驗證
3. **權限**：管理員路由加掛 `adminMiddleware`
4. **錯誤**：非預期錯誤交由 `errorHandler` 統一處理，不在路由中 `console.error`
5. **語系**：繁體中文，錯誤訊息與 UI 文字均使用中文
