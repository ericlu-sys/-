#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
為 waiting list 的每一筆項目確保有唯一 uid，方便追蹤（Trello、文件、討論可引用同一個 id）。

- 格式：wl_xxxxxxxx（8 碼英數字）
- 已有 uid 的項目不會改動
- 沒有 uid 的項目會自動產生並寫回 JSON
執行：python3 ensure_uids.py
"""

import json
import uuid

JSON_PATH = "進度_wport_程式設計 - waiting list.json"


def generate_uid():
    return "wl_" + uuid.uuid4().hex[:8]


def ensure_uids():
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        items = json.load(f)

    existing_uids = set()
    updated = 0
    for item in items:
        if item.get("uid"):
            existing_uids.add(item["uid"])
        else:
            while True:
                uid = generate_uid()
                if uid not in existing_uids:
                    break
            existing_uids.add(uid)
            item["uid"] = uid
            updated += 1

    # 每筆都輸出成「uid 在第一欄」的順序，方便在 Sheet 裡當追蹤碼
    fieldnames = ["uid", "屬性", "名稱", "描述", "進度", "trello", "文件"]
    ordered = []
    for item in items:
        ordered.append({k: item.get(k, "") for k in fieldnames})

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(ordered, f, ensure_ascii=False, indent=2)

    print(f"已確保 {len(items)} 筆都有 uid，其中 {updated} 筆為新產生。")


if __name__ == "__main__":
    ensure_uids()
