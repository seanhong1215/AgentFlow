---
name: git-rules
description: Git 操作規則：commit message 格式、禁止事項、分支策略
---

# Git 規則

## Commit Message 格式
- 使用**繁體中文**
- 說明「為什麼」，不只是「做了什麼」
- 每個邏輯單元一個 commit，不批次提交無關更改
- **絕對禁止**在 commit message 中加入 `Co-Authored-By: Claude` 或任何 AI 署名

## 禁止操作
- 禁止 force push 到 `main` 分支
- 禁止 `git reset --hard`（可能丟失工作）
- 禁止 `git commit --amend` 已推送的 commit
- 禁止 `--no-verify`（跳過 hook）

## 分支策略
- 功能開發在 feature branch 進行
- main 為穩定分支，只接受完整功能的 PR
- commit 前確認沒有 `.env`、`*.sqlite`、`node_modules/` 等敏感或大型檔案進入暫存區

## 敏感檔案
以下檔案**禁止**加入 git：
- `.env`（含密鑰）
- `*.sqlite`、`*.db`（資料庫檔案）
- `public/css/output.css`（建置產物）
- `node_modules/`
