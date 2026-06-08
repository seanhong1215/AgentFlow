# AgentFlow

本倉庫整理兩個本地端花卉電商示範專案版本：

| 目錄 | 說明 |
| --- | --- |
| `codexcli/` | Codex 協作整理版本，已包含綠界付款流程、測試與專案文件。 |
| `claudecli/` | Claude 協作初始化版本，包含 Express、EJS、Vue CDN、SQLite 與 API 測試。 |

兩個子專案皆為 Node.js Express 應用，啟動前請先進入對應目錄安裝依賴並設定 `.env`。

```powershell
cd codexcli
npm install
Copy-Item .env.example .env
npm run dev:server
```

或：

```powershell
cd claudecli
npm install
Copy-Item .env.example .env
npm run dev:server
```
