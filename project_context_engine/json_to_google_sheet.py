#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
將「進度_wport_程式設計 - waiting list.json」寫回 Google Sheet（覆蓋現有資料）。

使用前請先設定：
1. Google Cloud Console 建立專案，啟用 Google Sheets API
2. 建立「服務帳戶」，下載 JSON 金鑰檔，另存為 credentials.json 放在此目錄
3. 把試算表「共用」給該服務帳戶的 email（例如 xxx@xxx.iam.gserviceaccount.com）
4. pip install gspread
5. 在下方設定 SPREADSHEET_KEY（試算表網址中 /d/ 與 /edit 之間的那段 ID）
"""

import json
import os

JSON_PATH = "進度_wport_程式設計 - waiting list.json"
# 試算表網址格式: https://docs.google.com/spreadsheets/d/<SPREADSHEET_KEY>/edit
SPREADSHEET_KEY = os.environ.get("WPORT_SHEET_ID", "")  # 或直接填 ID，例如 "1abc..."
CREDENTIALS_PATH = "credentials.json"


def json_to_rows():
    """從 JSON 讀出並轉成 [標題列, 資料列...]。"""
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        rows = json.load(f)
    if not rows:
        return [], []
    headers = list(rows[0].keys())
    data = [headers]
    for r in rows:
        data.append([r.get(h, "") for h in headers])
    return headers, data


def upload_to_sheet():
    import gspread
    from google.oauth2.service_account import Credentials

    if not SPREADSHEET_KEY:
        print("請設定 SPREADSHEET_KEY 或環境變數 WPORT_SHEET_ID（試算表 ID）")
        return
    if not os.path.exists(CREDENTIALS_PATH):
        print(f"請將服務帳戶金鑰檔放在: {CREDENTIALS_PATH}")
        return
    if not os.path.exists(JSON_PATH):
        print(f"找不到 {JSON_PATH}，請先執行 csv_to_json.py 產生 JSON")
        return

    _, data = json_to_rows()
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = Credentials.from_service_account_file(CREDENTIALS_PATH, scopes=scopes)
    gc = gspread.authorize(creds)
    sh = gc.open_by_key(SPREADSHEET_KEY)
    # 使用第一個工作表；若要用特定名稱可改為 sh.worksheet("waiting list")
    ws = sh.sheet1

    # 先清空再寫入，避免殘留舊資料
    ws.clear()
    ws.update(data, "A1")
    print(f"已將 {len(data) - 1} 筆資料寫回 Google Sheet（含標題列）")


if __name__ == "__main__":
    upload_to_sheet()
