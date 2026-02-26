# Email Automation - Google Apps Script

## 雙環境：PRD（正式）與 DEV（開發）

目前這個資料夾連結的 Script ID：
`1IcNfQ9biWr_9xhU8o_72MwoCMZ-y71HKQfdcNaTR_n2PmbmrRAS9hCVM`

### 建議做法：兩個資料夾、兩個專案

| 資料夾 | 用途 | 指令 |
|--------|------|------|
| **Email Automation**（或改為 `Email-Automation-PRD`） | 正式環境 | `clasp push` / `clasp pull` 只影響此 Script |
| **Email-Automation-Dev**（另建） | 開發環境 | 在此改程式、測試，再同步到 PRD |

### 工作流程

1. **日常開發**：在 **Dev** 資料夾改程式 → `clasp push` 推到開發用 Script → 在 GAS 上測試。
2. **上線**：確認沒問題後，把 Dev 的程式複製/同步到 **PRD** 資料夾，再在 PRD 資料夾執行 `clasp push` 更新正式環境。

### 若要建立第二個環境（Dev 或 PRD）

在專案根目錄執行（把 `<另一個_Script_ID>` 換成實際 ID）：

```bash
# 建立開發環境資料夾並 clone 另一個 Script
mkdir -p "../Email-Automation-Dev"
cd "../Email-Automation-Dev"
clasp clone <另一個_Script_ID>
```

之後：
- 在 **Email Automation** 用 `clasp push` / `clasp pull` → 操作目前這個 Script。
- 在 **Email-Automation-Dev** 用 `clasp push` / `clasp pull` → 操作另一個 Script。

### 常用指令（在對應資料夾內執行）

- `clasp pull` — 從 Google 拉最新程式
- `clasp push` — 把本機程式推到 Google
- `clasp open` — 在瀏覽器開啟該專案
