# Daily Reporter

依「日期」從多個 GitHub repo 抓取 **Merged PR** 與 **Commits**，產出日報用資料。

## Google 試算表 + Apps Script

在 Google 試算表選好日期，用 **Apps Script** 直接呼叫 GitHub API，結果寫入同一份試算表。

- **設定與使用**：請看 [gas/README.md](gas/README.md)
- **腳本**：複製 [gas/Code.gs](gas/Code.gs) 到試算表的 **擴充功能 → Apps Script**，並在專案設定裡新增 `GITHUB_TOKEN` 即可
- **從本機 push 到 GAS**：在 `gas/` 目錄執行 `npx clasp push`（需先 `clasp login`）
