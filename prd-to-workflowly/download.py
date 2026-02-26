#!/usr/bin/env python3
"""
WorkFlowy 下載腳本

從 WorkFlowy 匯出所有節點，還原階層後輸出為本地 .md 檔案。
使用 nodes-export API（速率限制：每分鐘 1 次）。
"""

import json
import os
import re
import time
from pathlib import Path
from typing import Any, Optional

import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://workflowy.com/api/v1"


def get_headers() -> dict:
    """取得 API 認證 headers"""
    api_key = os.getenv("WORKFLOWLY_API_KEY")
    if not api_key:
        raise ValueError("請設定 WORKFLOWLY_API_KEY 環境變數，或在 .env 中設定")
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def fetch_nodes_export() -> list[dict]:
    """呼叫 nodes-export API，回傳節點列表"""
    resp = requests.get(
        f"{BASE_URL}/nodes-export",
        headers=get_headers(),
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("nodes", [])


def build_by_id(nodes: list[dict]) -> dict[str, dict]:
    """建立 id -> node 對照，每個 node 含 children 列表"""
    by_id: dict[str, dict] = {}
    for n in nodes:
        node = dict(n)
        node["children"] = []
        by_id[node["id"]] = node

    for node in by_id.values():
        pid = node.get("parent_id")
        if pid is not None and pid in by_id:
            by_id[pid]["children"].append(node)

    def sort_children(n: dict) -> None:
        n["children"].sort(key=lambda c: c.get("priority", 0))
        for c in n["children"]:
            sort_children(c)

    for n in by_id.values():
        sort_children(n)
    return by_id


def build_tree(nodes: list[dict]) -> list[dict]:
    """
    將扁平節點列表還原為樹狀結構（頂層節點列表）。
    依 parent_id 與 priority 排序。
    """
    by_id = build_by_id(nodes)
    roots = [n for n in by_id.values() if n.get("parent_id") is None or n["parent_id"] not in by_id]
    roots.sort(key=lambda r: r.get("priority", 0))
    return roots


def node_to_markdown_line(node: dict, indent: int = 0) -> str:
    """
    將單一節點轉為 Markdown 字串。
    layoutMode: h1, h2, h3, bullets, todo, quote-block, code-block
    """
    name = node.get("name") or ""
    layout = "bullets"
    if node.get("data") and isinstance(node["data"], dict):
        layout = node["data"].get("layoutMode", "bullets") or "bullets"
    completed = node.get("completed") or bool(node.get("completedAt"))
    prefix = "  " * indent

    if layout == "h1":
        return f"{prefix}# {name}"
    if layout == "h2":
        return f"{prefix}## {name}"
    if layout == "h3":
        return f"{prefix}### {name}"
    if layout == "todo":
        cb = "[x]" if completed else "[ ]"
        return f"{prefix}- {cb} {name}"
    if layout == "quote-block":
        return f"{prefix}> {name}"
    if layout == "code-block":
        return f"{prefix}```\n{prefix}{name}\n{prefix}```"
    # bullets, default
    return f"{prefix}- {name}"


def tree_to_markdown(nodes: list[dict], depth: int = 0) -> list[str]:
    """遞迴將節點樹轉為 Markdown 行列表"""
    lines = []
    for node in nodes:
        lines.append(node_to_markdown_line(node, depth))
        if node.get("note"):
            note_indent = "  " * (depth + 1)
            for line in node["note"].strip().split("\n"):
                lines.append(f"{note_indent}> {line}")
        if node.get("children"):
            lines.extend(tree_to_markdown(node["children"], depth + 1))
    return lines


def find_node_by_id(nodes: list[dict], node_ref: str) -> Optional[dict]:
    """
    依 ID 或 URL 後段找到節點。
    node_ref 可為：完整 UUID、後 12 碼（如 1e9a58315fb7）、或 WorkFlowy URL
    """
    # 從 URL 提取： workflowy.com/#/1e9a58315fb7 -> 1e9a58315fb7
    s = node_ref.strip()
    if "workflowy.com" in s and "#" in s:
        s = s.split("#/")[-1].strip()
    if not s:
        return None
    # 完整 UUID 或後 12 碼比對
    for n in nodes:
        nid = n.get("id", "")
        if nid == s or nid.endswith(s) or s in nid:
            return n
    return None


def get_subtree(by_id: dict[str, dict], root_id: str) -> Optional[dict]:
    """從 by_id 取得以 root_id 為根的節點（其 children 已由 build_by_id 建立）"""
    return by_id.get(root_id)


def sanitize_filename(name: str, node_id: str) -> str:
    """將節點名稱轉為安全檔名"""
    if not name or not name.strip():
        return f"untitled_{node_id[:8]}"
    s = re.sub(r'[<>:"/\\|?*]', "_", name.strip())
    s = s[:80].strip() or f"untitled_{node_id[:8]}"
    return s


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(
        description="從 WorkFlowy 下載所有節點並輸出為 .md 檔案"
    )
    parser.add_argument(
        "-o",
        "--output",
        default="./downloaded",
        help="輸出資料夾（預設: ./downloaded）",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="同時儲存原始 JSON（workflowy-export.json）",
    )
    parser.add_argument(
        "-n",
        "--node",
        metavar="ID_OR_URL",
        help="只下載此節點及其子樹。可為節點 ID、後 12 碼、或 WorkFlowy URL（如 https://workflowy.com/#/1e9a58315fb7）",
    )
    args = parser.parse_args()

    out_dir = Path(args.output).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    print("📥 正在從 WorkFlowy 匯出節點...")
    print("   （nodes-export 速率限制：每分鐘 1 次）")
    try:
        nodes = fetch_nodes_export()
    except requests.HTTPError as e:
        print(f"❌ API 錯誤: {e}")
        if e.response and e.response.status_code == 429:
            print("   請稍候一分鐘後重試（速率限制）")
        return 1
    except ValueError as e:
        print(f"❌ {e}")
        return 1

    if not nodes:
        print("⚠ 未取得任何節點")
        return 0

    print(f"   取得 {len(nodes)} 個節點")

    if args.json:
        json_path = out_dir / "workflowy-export.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump({"nodes": nodes}, f, ensure_ascii=False, indent=2)
        print(f"   ✓ 原始 JSON: {json_path}")

    by_id = build_by_id(nodes)

    if args.node:
        target = find_node_by_id(nodes, args.node)
        if not target:
            print(f"❌ 找不到節點: {args.node}")
            return 1
        root_node = get_subtree(by_id, target["id"])
        if not root_node:
            print(f"❌ 無法取得子樹: {args.node}")
            return 1
        tree = [root_node]
        print(f"   以節點為根: {target.get('name') or '(無名稱)'} ({target['id']})")
    else:
        tree = [n for n in by_id.values() if n.get("parent_id") is None or n["parent_id"] not in by_id]
        tree.sort(key=lambda r: r.get("priority", 0))

    written = 0
    for node in tree:
        lines = tree_to_markdown([node])
        content = "\n".join(lines).strip()
        fname = sanitize_filename(node.get("name", ""), node.get("id", ""))
        ext = ".md"
        path = out_dir / f"{fname}{ext}"
        # 避免檔名衝突
        if path.exists() and path.read_text(encoding="utf-8") != content:
            base = fname
            i = 1
            while path.exists():
                path = out_dir / f"{base}_{i}{ext}"
                i += 1
        path.write_text(content, encoding="utf-8")
        written += 1
        print(f"   ✓ {path.name}")

    print(f"\n✅ 完成，共輸出 {written} 個 .md 檔案到 {out_dir}")
    return 0


if __name__ == "__main__":
    exit(main())
