# AgentFlow

本倉庫以花卉電商為題，分別用 **Claude CLI** 與 **OpenAI Codex CLI** 協作開發，對比兩種 AI 工具的開發流程與成果。

## 目錄結構

| 目錄 | AI 工具 | 說明 |
| --- | --- | --- |
| `claudecli/` | Claude CLI | 含 ECPay 綠界付款、CLAUDE.md 記憶、.claude/ 設定集、完整 docs |
| `codexcli/` | OpenAI Codex CLI | 含 ECPay 綠界付款、AGENTS.md、.codex/ 設定、完整 docs 與測試 |

兩個子專案皆為 **Node.js + Express + EJS + SQLite** 應用，功能對等：會員認證、商品瀏覽、購物車、訂單、綠界付款、管理員後台。

## Branch 說明

| Branch | 內容 |
| --- | --- |
| `main` | 整合目錄，同時包含 `claudecli/` 與 `codexcli/` 兩個子專案 |
| `claudecli` | claudecli 獨立歷史（12 commits，files 在 root），可直接 clone 作獨立 repo |
| `codexcli` | codexcli 獨立歷史（4 commits，files 在 root），可直接 clone 作獨立 repo |

## 快速啟動

```powershell
# Claude CLI 版本
cd claudecli
npm install
Copy-Item .env.example .env
npm run dev:server
```

```powershell
# Codex CLI 版本
cd codexcli
npm install
Copy-Item .env.example .env
npm run dev:server
```

啟動後開啟 `http://localhost:3000`。
