#!/usr/bin/env python3
"""
ตรวจ internal links ใน specs/**/*.md
- ตรวจเฉพาะ relative links (ไม่ตรวจ http/https/mailto anchors)
- ตรวจว่า target file มีอยู่จริง
- ตรวจ anchor (#section) เบื้องต้น ถ้า target เป็น .md ใน repo

Exit code:
  0 = ผ่าน (หรือมี broken links แต่ใช้ --soft)
  1 = พบ broken links (โหมด strict)

Usage:
  python3 scripts/check-spec-links.py [--root specs] [--strict]
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# จับ markdown links: [text](target)
# ไม่จับ ![alt](image) และไม่จับ code spans
LINK_RE = re.compile(
    r'(?<!!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)',
    re.MULTILINE,
)

# จับ reference-style links: [ref]: url
REF_DEF_RE = re.compile(r'^\s*\[([^\]]+)\]:\s+(\S+)', re.MULTILINE)

# จับ fenced code blocks (``` ... ```) เพื่อ strip ออกก่อนตรวจ links
# ป้องกัน false positive จาก TypeScript code เช่น [key: string]: UiSchemaField;
CODE_BLOCK_RE = re.compile(r'```[^\n]*\n.*?```', re.DOTALL)

# จับ inline code spans `...` เพื่อ strip ออก
INLINE_CODE_RE = re.compile(r'`[^`]+`')


def strip_code_blocks(text: str) -> str:
    """ลบ fenced code blocks และ inline code spans ออกจาก text
    เพื่อป้องกัน false positive จาก code ที่หน้าตาคล้าย markdown links"""
    text = CODE_BLOCK_RE.sub('', text)
    text = INLINE_CODE_RE.sub('', text)
    return text


def is_external(target: str) -> bool:
    return bool(
        target.startswith(('http://', 'https://', 'mailto:', 'ftp://', 'tel:'))
        or target.startswith('//')
        or target.startswith('file:///')
    )


def is_anchor_only(target: str) -> bool:
    return target.startswith('#')


def resolve_link(src: Path, root: Path, repo_root: Path, target: str) -> tuple[Path | None, str | None]:
    """
    คืน (resolved_path, error_message)
    resolved_path เป็น absolute path ของ target ใน repo (หรือ None ถ้าเป็น external)
    root = specs root (สำหรับ relative reporting)
    repo_root = repo root (สำหรับตรวจว่า target อยู่ใน repo หรือไม่)
    """
    if is_external(target) or is_anchor_only(target):
        return None, None

    # แยก path กับ anchor
    path_part, _, anchor = target.partition('#')

    if not path_part:
        # anchor-only ที่ไม่ถูกจับข้างบน — skip
        return None, None

    # decode URL encoding (เช่น %20 → space) สำหรับ path resolution
    from urllib.parse import unquote
    decoded_path = unquote(path_part)

    # resolve สัมพัทธ์กับ src
    resolved = (src.parent / decoded_path).resolve()

    # ตรวจว่ายังอยู่ใน repo_root หรือไม่ (อนุญาตให้อ้างถึงไฟล์นอก specs/ แต่ใน repo)
    try:
        resolved.relative_to(repo_root)
    except ValueError:
        return None, f'อยู่นอก repo root: {target}'

    if not resolved.exists():
        # Fallback: ลอง resolve สัมพัทธ์กับ repo_root (repo-root-relative path)
        # สำหรับ links เช่น backend/src/... หรือ specs/... หรือ ./backend/...
        stripped = decoded_path[2:] if decoded_path.startswith('./') else decoded_path
        if not path_part.startswith(('../', '#')):
            resolved2 = (repo_root / stripped).resolve()
            try:
                resolved2.relative_to(repo_root)
            except ValueError:
                resolved2 = None
            if resolved2 and resolved2.exists():
                resolved = resolved2
            else:
                return resolved, f'ไม่พบไฟล์: {target}'
        else:
            return resolved, f'ไม่พบไฟล์: {target}'

    if resolved.is_dir():
        # ถ้าชี้โฟลเดอร์ ให้ถือว่า OK (อาจเป็น directory listing)
        return resolved, None

    # ถ้าเป็น .md และมี anchor ตรวจ heading เบื้องต้น
    if anchor and resolved.suffix == '.md':
        try:
            text = resolved.read_text(encoding='utf-8', errors='replace')
        except OSError:
            return resolved, None
        # แปลง anchor เป็น heading text โดยประมาณ (GitHub style)
        # เช็คแบบหลวม ๆ — ไม่ strict เพราะ anchor normalization ซับซ้อน
        normalized = anchor.lower().replace('-', ' ').strip()
        headings = [
            line.lstrip('#').strip().lower()
            for line in text.splitlines()
            if line.startswith('#')
        ]
        if not any(normalized in h or h in normalized for h in headings):
            return resolved, f'ไม่พบ anchor #{anchor} ใน {path_part}'

    return resolved, None


def check(root: Path, repo_root: Path) -> list[str]:
    """คืน list ของ broken link descriptions"""
    broken: list[str] = []
    md_files = sorted(root.rglob('*.md'))

    for md in md_files:
        try:
            raw = md.read_text(encoding='utf-8', errors='replace')
        except OSError as exc:
            broken.append(f'{md}: อ่านไฟล์ไม่ได้ ({exc})')
            continue

        # strip code blocks เพื่อกัน false positive จาก code snippets
        text = strip_code_blocks(raw)
        rel_src = md.relative_to(root)

        # inline links
        for match in LINK_RE.finditer(text):
            target = match.group(2).strip()
            if is_external(target):
                continue
            _, err = resolve_link(md, root, repo_root, target)
            if err:
                broken.append(f'{rel_src}: {err} (link text: {match.group(1)[:40]!r})')

        # reference definitions
        for match in REF_DEF_RE.finditer(text):
            target = match.group(2).strip()
            if is_external(target):
                continue
            _, err = resolve_link(md, root, repo_root, target)
            if err:
                broken.append(f'{rel_src}: {err} (ref: {match.group(1)!r})')

    return broken


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default='specs', help='โฟลเดอร์ specs (default: specs)')
    parser.add_argument('--strict', action='store_true', help='exit 1 ถ้ามี broken links')
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f'✗ ไม่พบโฟลเดอร์ {root}', file=sys.stderr)
        return 2

    # repo_root = parent ของ specs/ (หรือใช้ --repo-root  override)
    repo_root = root.parent

    print(f'🔍 ตรวจ internal links ใน {root}/')
    broken = check(root, repo_root)

    total = len(broken)
    if total == 0:
        print('✓ ไม่พบ broken internal links')
        return 0

    print(f'\n⚠️  พบ {total} broken link(s):')
    for line in broken[:50]:
        print(f'  - {line}')
    if total > 50:
        print(f'  ... และอีก {total - 50} รายการ (ดู log เต็มใน CI artifact)')

    return 1 if args.strict else 0


if __name__ == '__main__':
    sys.exit(main())
