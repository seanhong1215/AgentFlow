# 更新日誌

格式依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，版本號遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

---

## [未發布]

### 計畫中
- 綠界金流整合（ECPay AIO）

---

## [1.0.0] — 2026-06-08

### 新增
- Express + EJS 花卉電商平台初始架構
- 使用者認證：註冊、登入、個人資料（JWT，HS256，7 天）
- 商品管理：公開列表（分頁）與詳情
- 購物車：雙模式認證（JWT + X-Session-Id 訪客模式），累加邏輯
- 訂單系統：建立訂單（Transaction 保護，扣庫存 + 清購物車），列表、詳情、模擬付款
- 管理員後台：商品 CRUD（含刪除守衛）、訂單列表（狀態篩選）+ 詳情
- 前台 EJS 頁面：首頁、商品詳情、購物車、結帳、登入、訂單列表、訂單詳情
- 後台 EJS 頁面：商品管理、訂單管理
- Vue CDN 前端互動（各頁面獨立 JS）
- Tailwind CSS 4 樣式
- Vitest + Supertest 整合測試（6 個測試檔）
- swagger-jsdoc OpenAPI 3.0 文件生成
- SQLite 種子資料（8 種花卉商品 + 管理員帳號）
- `.claude/` 專案設定集（settings.json、rules）
- `docs/` 完整專案文件（README、ARCHITECTURE、DEVELOPMENT、FEATURES、TESTING、CHANGELOG）
