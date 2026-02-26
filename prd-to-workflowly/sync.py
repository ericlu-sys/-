#!/usr/bin/env python3
"""
Markdown to WorkFlowy 同步腳本

讀取資料夾內的 .md 檔案，解析階層結構後同步至 WorkFlowy。
參考 workflowly-doc API 文件實作。
"""

import argparse
import os
import re
import time
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

# 載入 .env
load_dotenv()

BASE_URL = "https://workflowy.com/api/v1"
RATE_LIMIT_DELAY = 0.5  # API 呼叫間隔（秒）


def get_headers() -> dict:
    """取得 API 認證 headers"""
    api_key = os.getenv("WORKFLOWLY_API_KEY")
    if not api_key:
        raise ValueError(
            "請設定 WORKFLOWLY_API_KEY 環境變數，或在 .env 中設定"
        )
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


# --- Markdown 解析 ---


def _parse_markdown_line(line: str) -> tuple[Optional[str], int, bool]:
    """
    解析單行 Markdown，回傳 (內容, 階層, 是否已完成)
    - 階層: 0=頂層, 1=#, 2=##, 3=###, 4+=#### 當粗體
    - 回傳 (None, 0, False) 表示跳過此行
    """
    stripped = line.rstrip()
    if not stripped:
        return None, 0, False

    # 標題
    if stripped.startswith("# "):
        return stripped[2:].strip(), 1, False
    if stripped.startswith("## "):
        return stripped[3:].strip(), 2, False
    if stripped.startswith("### "):
        return stripped[4:].strip(), 3, False
    if stripped.startswith("#### "):
        return f"**{stripped[5:].strip()}**", 0, False

    # 待辦
    todo_match = re.match(r"^-\s*\[([ xX])\]\s*(.*)$", stripped)
    if todo_match:
        done = todo_match.group(1).lower() == "x"
        return f"- {'[x]' if done else '[ ]'} {todo_match.group(2).strip()}", 0, done

    # 項目符號
    if stripped.startswith("- "):
        return stripped[2:].strip(), 0, False

    # 引用
    if stripped.startswith("> "):
        return f"> {stripped[2:].strip()}", 0, False

    # 純文字（當作 bullet）
    return stripped, 0, False


def parse_markdown(content: str) -> list[dict]:
    """
    將 Markdown 內容解析為節點樹（扁平化為建立順序）
    每個節點: { "name": str, "level": int, "completed": bool, "children": [...] }
    """
    lines = content.split("\n")
    stack: list[dict] = []  # (level, node)
    root_nodes: list[dict] = []
    current_path: list[dict] = []  # 當前各層級節點

    for line in lines:
        name, level, completed = _parse_markdown_line(line)
        if name is None:
            continue

        node = {"name": name, "level": level, "completed": completed, "children": []}

        # 找到正確的父節點
        while current_path and current_path[-1]["level"] >= level:
            current_path.pop()

        if not current_path:
            root_nodes.append(node)
            current_path.append(node)
        else:
            parent = current_path[-1]
            parent["children"].append(node)
            current_path.append(node)

    return root_nodes


def flatten_tree(nodes: list[dict], parent_id: Optional[str] = None) -> list[tuple[dict, Optional[str]]]:
    """
    將樹狀結構扁平化為 (node, parent_id) 列表，依建立順序
    """
    result = []

    def walk(ns: list[dict], parent: Optional[str]):
        for n in ns:
            result.append((n, parent))
            if n["children"]:
                # 子節點會在自己的 create 後取得 id，這裡先傳 placeholder
                # 實際建立時需要依序處理
                walk(n["children"], None)  # parent 會在建立時動態傳入

    walk(nodes, parent_id)
    return result


# --- WorkFlowy API ---


class WorkFlowyClient:
    """WorkFlowy API 客戶端"""

    def __init__(self):
        self.headers = get_headers()
        self._last_request = 0.0

    def _rate_limit(self):
        elapsed = time.time() - self._last_request
        if elapsed < RATE_LIMIT_DELAY:
            time.sleep(RATE_LIMIT_DELAY - elapsed)
        self._last_request = time.time()

    def create_node(
        self,
        parent_id: str,
        name: str,
        position: str = "bottom",
        layout_mode: Optional[str] = None,
        note: Optional[str] = None,
    ) -> str:
        """建立節點，回傳新節點的 id"""
        self._rate_limit()
        payload = {
            "parent_id": parent_id,
            "name": name,
            "position": position,
        }
        if layout_mode:
            payload["layoutMode"] = layout_mode
        if note:
            payload["note"] = note

        resp = requests.post(f"{BASE_URL}/nodes", headers=self.headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["item_id"]

    def complete_node(self, node_id: str):
        """標記節點為完成"""
        self._rate_limit()
        resp = requests.post(f"{BASE_URL}/nodes/{node_id}/complete", headers=self.headers)
        resp.raise_for_status()

    def get_targets(self) -> list[dict]:
        """取得 targets 列表"""
        self._rate_limit()
        resp = requests.get(f"{BASE_URL}/targets", headers=self.headers)
        resp.raise_for_status()
        return resp.json().get("targets", [])


def _get_layout_mode(level: int) -> str:
    if level == 1:
        return "h1"
    if level == 2:
        return "h2"
    if level == 3:
        return "h3"
    if level >= 4:
        return "bullets"  # #### 用粗體顯示，layout 用 bullets
    return "bullets"


def sync_markdown_to_workflowy(
    client: WorkFlowyClient,
    nodes: list[dict],
    parent_id: str,
    position: str = "bottom",
) -> None:
    """
    遞迴將解析後的節點樹同步至 WorkFlowy
    """
    for node in nodes:
        layout = _get_layout_mode(node["level"]) if node["level"] > 0 else "bullets"
        # 若為 todo 且內容含 - [ ] 或 - [x]，使用 todo layout
        if "- [ ]" in node["name"] or "- [x]" in node["name"]:
            layout = "todo"

        new_id = client.create_node(
            parent_id=parent_id,
            name=node["name"],
            position=position,
            layout_mode=layout,
        )
        if node["completed"]:
            client.complete_node(new_id)
        if node["children"]:
            sync_markdown_to_workflowy(client, node["children"], new_id, "bottom")


def sync_file(client: WorkFlowyClient, filepath: Path, parent_id: str, dry_run: bool = False) -> int:
    """
    同步單一 .md 檔案，回傳建立的節點數
    """
    content = filepath.read_text(encoding="utf-8", errors="replace")
    nodes = parse_markdown(content)

    if not nodes:
        print(f"  ⚠ {filepath.name}: 無有效內容，略過")
        return 0

    # 用檔名當作最外層節點（若第一個節點是 h1 則可選用）
    # 這裡直接以解析出的根節點建立
    if dry_run:
        def count(ns):
            return sum(1 + count(n["children"]) for n in ns)
        n = count(nodes)
        print(f"  [dry-run] {filepath.name}: 將建立 {n} 個節點")
        return n

    sync_markdown_to_workflowy(client, nodes, parent_id)
    def count(ns):
        return sum(1 + count(n["children"]) for n in ns)
    return count(nodes)


def main():
    parser = argparse.ArgumentParser(
        description="將 .md 檔案同步至 WorkFlowy",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
範例:
  python sync.py                    # 同步 ./md 到 inbox
  python sync.py -d ./notes         # 指定資料夾
  python sync.py -p None            # 同步到頂層（parent_id=None）
  python sync.py --dry-run          # 僅預覽，不實際建立
        """,
    )
    parser.add_argument(
        "-d",
        "--dir",
        default="./md",
        help="要讀取的 .md 資料夾（預設: ./md）",
    )
    parser.add_argument(
        "-p",
        "--parent",
        default="inbox",
        help="WorkFlowy 父節點 ID 或 target key，如 inbox, home, None（預設: inbox）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="僅預覽，不實際呼叫 API",
    )
    args = parser.parse_args()

    md_dir = Path(args.dir).resolve()
    if not md_dir.exists():
        print(f"❌ 資料夾不存在: {md_dir}")
        print("   請建立資料夾並放入 .md 檔案，或使用 -d 指定路徑")
        return 1

    md_files = sorted(md_dir.glob("*.md"))
    if not md_files:
        print(f"❌ 在 {md_dir} 中找不到 .md 檔案")
        return 1

    parent_id = args.parent if args.parent.lower() != "none" else "None"

    if args.dry_run:
        print(f"🔍 預覽模式：將同步 {len(md_files)} 個 .md 到 parent_id={parent_id}\n")
        # Dry run 仍需要能解析，不呼叫 API
        for fp in md_files:
            content = fp.read_text(encoding="utf-8", errors="replace")
            nodes = parse_markdown(content)
            def count(ns):
                return sum(1 + count(n["children"]) for n in ns)
            n = count(nodes)
            print(f"  {fp.name}: {n} 個節點")
        print("\n執行 python sync.py 開始同步")
        return 0

    try:
        client = WorkFlowyClient()
    except ValueError as e:
        print(f"❌ {e}")
        return 1

    # 檢查 parent 是否存在（inbox 可能尚未建立）
    targets = client.get_targets()
    target_keys = [t["key"] for t in targets]
    if parent_id not in target_keys and parent_id != "None":
        print(f"⚠ 警告: target '{parent_id}' 不在你的 targets 中: {target_keys}")
        print("  若使用 node ID 請確認正確。繼續執行...")

    print(f"📤 同步 {len(md_files)} 個 .md 到 WorkFlowy (parent={parent_id})\n")
    total = 0
    for fp in md_files:
        try:
            n = sync_file(client, fp, parent_id, dry_run=False)
            total += n
            print(f"  ✓ {fp.name}: {n} 個節點")
        except requests.HTTPError as e:
            print(f"  ✗ {fp.name}: API 錯誤 - {e}")
        except Exception as e:
            print(f"  ✗ {fp.name}: {e}")

    print(f"\n✅ 完成，共建立 {total} 個節點")
    return 0


if __name__ == "__main__":
    exit(main())
