import os
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional, Tuple

import requests

try:
    # Optional convenience: load .env if python-dotenv is installed
    from dotenv import load_dotenv  # type: ignore
except Exception:  # pragma: no cover
    load_dotenv = None  # type: ignore


@dataclass
class CommitItem:
    repo: str
    title: str
    author: str
    date: str
    sha: str
    url: str


@dataclass
class PullRequestItem:
    repo: str
    title: str
    author: str
    date: str
    number: int
    url: str


def load_env() -> None:
    """
    嘗試自動載入與此檔案同目錄下的 .env（若有安裝 python-dotenv）。
    若沒有安裝 python-dotenv，則略過，改用系統環境變數。
    """
    if load_dotenv is None:
        return
    env_path = Path(__file__).with_name(".env")
    if env_path.exists():
        load_dotenv(env_path)  # type: ignore[arg-type]


def parse_date(date_str: str) -> datetime:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise SystemExit(f"日期格式錯誤，請使用 YYYY-MM-DD，例如 2026-02-27（收到：{date_str!r}）")


def get_timezone(tz_name: Optional[str]) -> timezone:
    """
    從 TZ 名稱取得時區；預設使用 Asia/Taipei。
    優先使用標準庫 zoneinfo，失敗時 fallback 為固定 +8。
    """
    tz_name = tz_name or "Asia/Taipei"
    try:
        from zoneinfo import ZoneInfo

        return ZoneInfo(tz_name)  # type: ignore[return-value]
    except Exception:
        # 簡單 fallback：台北時間 +8
        offset_hours = 8 if tz_name in ("Asia/Taipei", "Asia/Taiwan") else 0
        return timezone(timedelta(hours=offset_hours))


def compute_utc_range(date_str: str, tz_name: Optional[str]) -> Tuple[str, str]:
    """
    給定「本地日期」與時區名稱，計算該日 00:00～24:00 對應的 UTC ISO 字串。
    """
    local_tz = get_timezone(tz_name)
    local_start = parse_date(date_str).replace(tzinfo=local_tz)
    local_end = local_start + timedelta(days=1)
    start_utc = local_start.astimezone(timezone.utc)
    end_utc = local_end.astimezone(timezone.utc)
    start_iso = start_utc.isoformat().replace("+00:00", "Z")
    end_iso = end_utc.isoformat().replace("+00:00", "Z")
    return start_iso, end_iso


def build_session(token: str) -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "daily-reporter-md-script",
        }
    )
    return s


def fetch_commits(
    session: requests.Session,
    owner: str,
    repo: str,
    since_iso: str,
    until_iso: str,
) -> List[CommitItem]:
    url = f"https://api.github.com/repos/{owner}/{repo}/commits"
    commits: List[CommitItem] = []

    page = 1
    while True:
        resp = session.get(
            url,
            params={
                "since": since_iso,
                "until": until_iso,
                "per_page": 100,
                "page": page,
            },
            timeout=30,
        )
        if resp.status_code != 200:
            sys.stderr.write(
                f"[Commits] {owner}/{repo} 取得失敗: {resp.status_code} {resp.text}\n"
            )
            break
        data = resp.json()
        if not data:
            break

        for c in data:
            commit_info = c.get("commit", {})
            author_info = commit_info.get("author") or {}
            author = author_info.get("name") or (c.get("author") or {}).get("login") or ""
            date_str = author_info.get("date") or ""
            msg = (commit_info.get("message") or "").split("\n")[0].strip()
            sha_full = c.get("sha") or ""
            sha_short = sha_full[:7] if sha_full else ""
            commits.append(
                CommitItem(
                    repo=f"{owner}/{repo}",
                    title=msg,
                    author=author,
                    date=date_str,
                    sha=sha_short,
                    url=c.get("html_url") or "",
                )
            )

        page += 1

    # 再保險一次：依日期區間過濾
    since_ts = datetime.fromisoformat(since_iso.replace("Z", "+00:00")).timestamp()
    until_ts = datetime.fromisoformat(until_iso.replace("Z", "+00:00")).timestamp()
    filtered: List[CommitItem] = []
    for c in commits:
        if not c.date:
            continue
        try:
            t = datetime.fromisoformat(c.date.replace("Z", "+00:00")).timestamp()
        except Exception:
            continue
        if since_ts <= t < until_ts:
            filtered.append(c)
    return filtered


def fetch_merged_prs(
    session: requests.Session,
    owner: str,
    repo: str,
    start_date: str,
    end_date: str,
) -> List[PullRequestItem]:
    # 與 GAS 版相同：使用 Search API
    q = f"repo:{owner}/{repo} is:pr is:merged merged:{start_date}..{end_date}"
    url = "https://api.github.com/search/issues"
    prs: List[PullRequestItem] = []

    page = 1
    while True:
        resp = session.get(
            url,
            params={
                "q": q,
                "per_page": 100,
                "page": page,
            },
            timeout=30,
        )
        if resp.status_code != 200:
            sys.stderr.write(
                f"[PRs] {owner}/{repo} 取得失敗: {resp.status_code} {resp.text}\n"
            )
            break
        data = resp.json()
        items = data.get("items") or []
        if not items:
            break
        for pr in items:
            prs.append(
                PullRequestItem(
                    repo=f"{owner}/{repo}",
                    title=pr.get("title") or "",
                    author=(pr.get("user") or {}).get("login") or "",
                    date=pr.get("merged_at") or pr.get("updated_at") or "",
                    number=pr.get("number") or 0,
                    url=pr.get("html_url") or "",
                )
            )
        page += 1

    return prs


def add_one_day(date_str: str) -> str:
    d = parse_date(date_str)
    return (d + timedelta(days=1)).strftime("%Y-%m-%d")


def generate_markdown(
    date_str: str,
    tz_name: str,
    repos: List[str],
    prs: List[PullRequestItem],
    commits: List[CommitItem],
) -> str:
    lines: List[str] = []
    lines.append(f"# Daily Report {date_str}")
    lines.append("")
    lines.append(f"- 時區：{tz_name or 'Asia/Taipei'}，以當地時間 00:00～24:00 計算")
    lines.append(f"- Repos：{', '.join(repos)}")
    lines.append(f"- Merged PRs：{len(prs)}")
    lines.append(f"- Commits：{len(commits)}")
    lines.append("")

    if prs:
        lines.append("## Merged PRs")
        grouped_prs: dict[str, List[PullRequestItem]] = {}
        for pr in prs:
            grouped_prs.setdefault(pr.repo, []).append(pr)
        for repo in repos:
            repo_prs = grouped_prs.get(repo, [])
            if not repo_prs:
                continue
            lines.append("")
            lines.append(f"### {repo}")
            for pr in sorted(repo_prs, key=lambda x: (x.date or "", x.number)):
                num = f"#{pr.number}" if pr.number else ""
                when = pr.date or ""
                lines.append(
                    f"- {num} {pr.title} （by {pr.author or 'unknown'}，{when}）  \n  {pr.url}"
                )
        lines.append("")
    else:
        lines.append("## Merged PRs")
        lines.append("")
        lines.append("_此日無 merged PR_")
        lines.append("")

    if commits:
        lines.append("## Commits")
        grouped_commits: dict[str, List[CommitItem]] = {}
        for c in commits:
            grouped_commits.setdefault(c.repo, []).append(c)
        for repo in repos:
            repo_commits = grouped_commits.get(repo, [])
            if not repo_commits:
                continue
            lines.append("")
            lines.append(f"### {repo}")
            for c in sorted(repo_commits, key=lambda x: x.date or ""):
                when = c.date or ""
                sha = c.sha or ""
                lines.append(
                    f"- {sha} {c.title} （by {c.author or 'unknown'}，{when}）  \n  {c.url}"
                )
        lines.append("")
    else:
        lines.append("## Commits")
        lines.append("")
        lines.append("_此日無 commits_")
        lines.append("")

    return "\n".join(lines)


def main(argv: List[str]) -> None:
    if len(argv) < 2:
        print("用法：python github_daily_report_md.py YYYY-MM-DD [輸出檔名]", file=sys.stderr)
        raise SystemExit(1)

    date_str = argv[1]
    output_path = argv[2] if len(argv) >= 3 else f"daily-report-{date_str}.md"

    load_env()

    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise SystemExit("找不到 GITHUB_TOKEN，請在 .env 或環境變數中設定。")

    repos_str = os.getenv("REPOS") or ""
    repos = [r.strip() for r in repos_str.split(",") if r.strip()]
    if not repos:
        raise SystemExit("找不到 REPOS 設定，請在 .env 設定要查詢的 repos。")

    tz_name = os.getenv("TZ") or "Asia/Taipei"

    since_iso, until_iso = compute_utc_range(date_str, tz_name)

    session = build_session(token)

    all_prs: List[PullRequestItem] = []
    all_commits: List[CommitItem] = []

    for full_name in repos:
        parts = full_name.split("/")
        if len(parts) != 2:
            sys.stderr.write(f"略過無效 repo 名稱：{full_name!r}\n")
            continue
        owner, repo = parts[0].strip(), parts[1].strip()
        if not owner or not repo:
            sys.stderr.write(f"略過無效 repo 名稱：{full_name!r}\n")
            continue

        commits = fetch_commits(session, owner, repo, since_iso, until_iso)
        all_commits.extend(commits)

        next_date = add_one_day(date_str)
        prs = fetch_merged_prs(session, owner, repo, date_str, next_date)
        all_prs.extend(prs)

    markdown = generate_markdown(date_str, tz_name, repos, all_prs, all_commits)
    out_path = Path(output_path)
    out_path.write_text(markdown, encoding="utf-8")
    print(f"已產生 Markdown 檔案：{out_path}")


if __name__ == "__main__":
    main(sys.argv)

