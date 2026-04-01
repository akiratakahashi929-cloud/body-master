#!/usr/bin/env python3
"""
BODY_MASTERのアイコン運用チェック。

- Unicode絵文字が混入していないかを検知
- 失敗時はファイル/行番号を表示して終了コード1を返す
"""

from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent
TARGET_EXTS = {".html", ".js", ".css", ".md", ".sh"}
IGNORE_DIRS = {".git", ".vercel", "node_modules"}

# 絵文字の代表的なUnicode範囲
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F300-\U0001FAFF"  # 絵文字全般
    "\u2600-\u27BF"          # 記号絵文字
    "]"
)


def should_scan(path: Path) -> bool:
    if path.suffix.lower() not in TARGET_EXTS:
        return False
    return not any(part in IGNORE_DIRS for part in path.parts)


def main() -> int:
    violations: list[str] = []

    for file_path in ROOT.rglob("*"):
        if not file_path.is_file() or not should_scan(file_path):
            continue
        try:
            lines = file_path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError:
            continue
        for i, line in enumerate(lines, start=1):
            if EMOJI_PATTERN.search(line):
                rel = file_path.relative_to(ROOT)
                violations.append(f"{rel}:{i}: {line.strip()}")

    if violations:
        print("Unicode絵文字が検出されました。Phosphorアイコンに置換してください。\n")
        for v in violations:
            print(f"- {v}")
        return 1

    print("OK: Unicode絵文字は検出されませんでした。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
