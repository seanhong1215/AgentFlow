---
name: db-rules
description: 資料庫操作規則：better-sqlite3 同步 API、欄位命名、transaction 用法
paths:
  - "src/database.js"
  - "src/routes/**"
---

# 資料庫規則

## 同步 API（禁止 async/await）
使用 `better-sqlite3` 同步 API，**絕對禁止** async/await 操作 DB：
```js
// 正確
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
const products = db.prepare('SELECT * FROM products').all();
db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run(id, email);

// 禁止
const user = await db.prepare('...').get(id);
```

## Batch 操作必須用 transaction
多個 DB 操作絕對不能裸跑，必須包進 `db.transaction()`：
```js
const createOrder = db.transaction(() => {
  db.prepare('INSERT INTO orders ...').run(...);
  db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(qty, id);
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
});
createOrder();
```

## 欄位命名
- SQLite 欄位使用 `snake_case`：`password_hash`、`created_at`、`order_no`
- 從 DB 取出後**保持 snake_case**，不轉換為 camelCase
- 主鍵使用 UUID（`uuidv4()`），不使用自增整數

## 結構變更規範
- 新增欄位用 `try/catch` 包裹 ALTER TABLE（冪等，允許已存在則跳過）：
  ```js
  try {
    db.exec('ALTER TABLE orders ADD COLUMN new_col TEXT');
  } catch { /* already exists */ }
  ```
- 新增表使用 `CREATE TABLE IF NOT EXISTS`
- 任何 schema 變更必須同步更新 `docs/ARCHITECTURE.md` 的 DB Schema 區段
