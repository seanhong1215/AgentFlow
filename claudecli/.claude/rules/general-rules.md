---
name: general-rules
description: 通用開發規則：語言風格、文件優先順序、修改範圍限制
---

# 通用開發規則

## 語言與風格
- 所有回應、說明、commit message 使用**繁體中文**
- 程式碼遵循 DEVELOPMENT.md 的命名規則與風格
- 不加不必要的註解；只在「為什麼」非顯而易見時才加
- 不使用 emoji，除非使用者明確要求

## 優先讀取的文件
開始任何開發任務前，先閱讀：
1. CLAUDE.md — 快速理解專案
2. docs/ARCHITECTURE.md — 確認程式碼放置位置
3. docs/DEVELOPMENT.md — 遵守程式碼規範
4. docs/FEATURES.md — 確認功能現況，避免重複開發

## 修改範圍
- **不新增**不在任務範圍內的功能或抽象層
- **不重構**任務以外的程式碼
- 不新增 error handling、fallback 或 validation 來處理不可能發生的情況
- 修改任何功能後，同步更新 docs/FEATURES.md
