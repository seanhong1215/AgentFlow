#!/usr/bin/env bash
# PreToolUse hook：阻止編輯敏感或不應手動修改的檔案
# stdin 為 JSON：{ "tool_name": "Edit", "tool_input": { "file_path": "..." } }

input=$(cat)

file_path=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

if [ -z "$file_path" ]; then
  exit 0
fi

# 保護 .env 檔案
if echo "$file_path" | grep -qE '(^|/)\.env$'; then
  echo "BLOCKED: .env 包含密鑰，請直接用文字編輯器修改" >&2
  exit 1
fi

# 保護 SQLite 資料庫檔案
if echo "$file_path" | grep -qE '\.(sqlite|db)$'; then
  echo "BLOCKED: 資料庫檔案不應直接編輯（使用 DB 操作 API）" >&2
  exit 1
fi

# 保護 package-lock.json（應由 npm 管理）
if echo "$file_path" | grep -qE '(^|/)package-lock\.json$'; then
  echo "BLOCKED: package-lock.json 由 npm 自動管理，請勿手動修改" >&2
  exit 1
fi

exit 0
