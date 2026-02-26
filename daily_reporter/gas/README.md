# Daily Reporter - Google 試算表版

在 Google 試算表裡選好日期，用 Apps Script 直接呼叫 GitHub API，把該日的 **Merged PR** 與 **Commits** 寫入同一份試算表，不需自架網站或跑 Python。

## 步驟一：建立試算表與腳本

1. 新增一份 [Google 試算表](https://sheets.google.com)。
2. 選單 **擴充功能** → **Apps Script**，會開啟腳本編輯器。
3. 把專案裡 `gas/Code.gs` 的內容全部複製到編輯器預設的 `Code.gs`，儲存。

## 步驟二：設定 GitHub Token

1. 在 Apps Script 編輯器左側點 **專案設定**（齒輪圖示）。
2. 下方 **指令碼內容** → **新增指令碼內容**：
   - **內容**：`GITHUB_TOKEN`
   - **值**：你的 [GitHub Personal Access Token](https://github.com/settings/tokens)（至少要有 `repo` 讀取權限）。
3. 儲存後關閉專案設定。

## 步驟三：試算表版面（第一次執行會自動建立）

腳本會使用／建立兩個工作表：

| 工作表名稱 | 用途 |
|------------|------|
| **設定** | 日期、時區、Repos；第一次執行若沒有會自動建立 |
| **GitHub 資料** | 執行後寫入的 PR / Commit 列表 |

**設定** 工作表建議欄位（可手動建，或等第一次跑「取得 GitHub 資料」自動建）：

- **A1**：`日期 (YYYY-MM-DD)`，**B1**：例如 `2026-02-12`
- **A2**：`時區偏移(小時，8=Asia/Taipei)`，**B2**：`8`
- **A3**：`Repos (逗號分隔 owner/repo)`，**B3**：例如  
  `w101-admin/W101-Web,w101-admin/W101-AMS,w101-admin/prd,w101-admin/W101-Admin-Web,w101-admin/W101-TalentSearchHub`

## 步驟四：執行

1. 回到試算表（不要關掉 Apps Script 分頁，第一次執行會要求授權）。
2. 選單會多出 **Daily Report** → **取得 GitHub 資料**。
3. 點下去後會依 **設定** 的日期、時區、Repos 呼叫 GitHub API，結果寫入 **GitHub 資料** 工作表。

**GitHub 資料** 欄位：類型、Repo、標題/訊息、作者、時間、編號/SHA、連結。

## 注意

- 日期一律依「該日 00:00～24:00」在**你設定的時區**換算成 UTC 去查 GitHub（例如 Asia/Taipei = +8）。
- PR 用 GitHub Search API（`is:pr is:merged merged:起始日..結束日`）；Commits 用 Repo Commits API（`since` / `until`）。
- Token 只存在你的 Apps Script 專案（指令碼內容），不會離開 Google 帳號。

## 從本機 Push 到既有 GAS 專案（clasp）

若你已用本 repo 的 Script ID 綁定試算表背後的 Apps Script 專案，可在本機改完 `Code.gs` 後推上去：

1. 安裝並登入：`npm install -g @google/clasp`，再執行 `clasp login`（會開瀏覽器登入 Google）。
2. 在 **daily_reporter/gas** 目錄執行：`clasp push`。
3. `.clasp.json` 內已寫入 Script ID，無須改動（除非你要換成另一份試算表）。
