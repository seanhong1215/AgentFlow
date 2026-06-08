# 功能清單

## 認證功能（/api/auth）
| 功能 | 端點 | 狀態 |
|------|------|------|
| 使用者註冊 | POST /api/auth/register | ✅ 完成 |
| 使用者登入 | POST /api/auth/login | ✅ 完成 |
| 取得個人資料 | GET /api/auth/profile | ✅ 完成 |

## 商品功能（/api/products）
| 功能 | 端點 | 狀態 |
|------|------|------|
| 取得商品列表 | GET /api/products | ✅ 完成 |
| 取得單一商品 | GET /api/products/:id | ✅ 完成 |

## 購物車功能（/api/cart）
| 功能 | 端點 | 狀態 |
|------|------|------|
| 取得購物車 | GET /api/cart | ✅ 完成 |
| 加入購物車 | POST /api/cart | ✅ 完成 |
| 更新數量 | PUT /api/cart/:id | ✅ 完成 |
| 移除品項 | DELETE /api/cart/:id | ✅ 完成 |
| 清空購物車 | DELETE /api/cart | ✅ 完成 |

## 訂單功能（/api/orders，需登入）
| 功能 | 端點 | 狀態 |
|------|------|------|
| 建立訂單 | POST /api/orders | ✅ 完成 |
| 取得我的訂單列表 | GET /api/orders | ✅ 完成 |
| 取得訂單詳情 | GET /api/orders/:id | ✅ 完成 |

## 管理後台（需 admin 角色）
### 商品管理（/api/admin/products）
| 功能 | 端點 | 狀態 |
|------|------|------|
| 新增商品 | POST /api/admin/products | ✅ 完成 |
| 更新商品 | PUT /api/admin/products/:id | ✅ 完成 |
| 刪除商品 | DELETE /api/admin/products/:id | ✅ 完成 |

### 訂單管理（/api/admin/orders）
| 功能 | 端點 | 狀態 |
|------|------|------|
| 取得所有訂單 | GET /api/admin/orders | ✅ 完成 |
| 更新訂單狀態 | PUT /api/admin/orders/:id/status | ✅ 完成 |

## 前台頁面（EJS）
| 頁面 | 路徑 | 狀態 |
|------|------|------|
| 首頁（商品列表） | / | ✅ 完成 |
| 商品詳情 | /products/:id | ✅ 完成 |
| 購物車 | /cart | ✅ 完成 |
| 結帳 | /checkout | ✅ 完成 |
| 登入 | /login | ✅ 完成 |
| 我的訂單 | /orders | ✅ 完成 |
| 訂單詳情 | /orders/:id | ✅ 完成 |
| 404 頁面 | （全局） | ✅ 完成 |

## 後台頁面（EJS）
| 頁面 | 路徑 | 狀態 |
|------|------|------|
| 商品管理 | /admin/products | ✅ 完成 |
| 訂單管理 | /admin/orders | ✅ 完成 |

## 其他功能
| 功能 | 說明 | 狀態 |
|------|------|------|
| OpenAPI 文件生成 | `npm run openapi` → openapi.json | ✅ 完成 |
| SQLite 種子資料 | 8 種花卉商品 + 管理員帳號 | ✅ 完成 |
| Session 購物車 | 未登入狀態下保留購物車 | ✅ 完成 |
| 付款整合（綠界） | ECPay staging 環境（.env 已設定） | 🚧 待實作 |
