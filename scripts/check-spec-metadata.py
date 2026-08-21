#!/usr/bin/env python3
"""
ตรวจ required metadata ของ spec files หลักใน specs/

ตรวจ:
1. ADR files (specs/06-Decision-Records/ADR-*.md)
   - ต้องมี H1 title ขึ้นต้นด้วย "ADR-XXX:"
   - ต้องมีบรรทัด **Status:** (Accepted / Proposed / Superseded / Deprecated / Rejected)

2. ไฟล์หลักใน specs/00-overview/
   - ต้องมี H1 title

3. Schema files (specs/03-Data-and-Storage/*.sql)
   - ต้องมี comment บนสุดที่บอก version

Exit code:
  0 = ผ่านทั้งหมด (หรือมีปัญหาแต่ใช้ --soft)
  1 = พบปัญหา (โหมด strict)

Usage:
  python3 scripts/check-spec-metadata.py [--root specs] [--strict]
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ADR_FILE_RE = re.compile(r'^ADR-(\d+[A-Z]?)-', re.IGNORECASE)
ADR_TITLE_RE = re.compile(r'^#\s+ADR-\d+[A-Z]?:', re.IGNORECASE)
STATUS_RE = re.compile(r'\*\*Status:\*\*\s*(\w+)', re.IGNORECASE)

VALID_ADR_STATUS = {
    'Accepted',
    'Active',        # ใช้ใน ADR เก่าบางตัว
    'Implemented',   # ใช้ใน ADR ที่ implement แล้ว
    'Proposed',
    'Draft',
    'Superseded',
    'Deprecated',
    'Rejected',
    'Withdrawn',
}

# ไฟล์ที่ชื่อขึ้นต้นด้วย prefix เหล่านี้ไม่ใช่ ADR จริง (เป็น template/policy/meta)
NON_ADR_PREFIXES = ('ADR-TEMPLATE', 'ADR-REVIEW', 'ADR-PROCESS')


def check_adr(path: Path, root: Path) -> list[str]:
    """ตรวจ ADR file"""
    issues: list[str] = []
    rel = path.relative_to(root)
    try:
        text = path.read_text(encoding='utf-8', errors='replace')
    except OSError as exc:
        return [f'{rel}: อ่านไฟล์ไม่ได้ ({exc})']

    lines = text.splitlines()

    # ต้องมี H1 ขึ้นต้นด้วย ADR-XXX:
    h1 = next((ln for ln in lines[:5] if ln.startswith('# ')), None)
    if not h1:
        issues.append(f'{rel}: ไม่มี H1 title')
    elif not ADR_TITLE_RE.match(h1):
        issues.append(f'{rel}: H1 title ไม่ตรงรูปแบบ "ADR-XXX: ..." (ได้: {h1[:60]!r})')

    # ต้องมี **Status:** <valid value>
    status_match = STATUS_RE.search(text)
    if not status_match:
        issues.append(f'{rel}: ไม่มีบรรทัด **Status:**')
    elif status_match.group(1) not in VALID_ADR_STATUS:
        issues.append(
            f'{rel}: Status ไม่ถูกต้อง ({status_match.group(1)!r}) '
            f'— ต้องเป็นหนึ่งใน {sorted(VALID_ADR_STATUS)}'
        )

    return issues


def check_overview(path: Path, root: Path) -> list[str]:
    """ตรวจไฟล์ใน specs/00-overview/ ว่ามี H1"""
    issues: list[str] = []
    rel = path.relative_to(root)
    try:
        text = path.read_text(encoding='utf-8', errors='replace')
    except OSError as exc:
        return [f'{rel}: อ่านไฟล์ไม่ได้ ({exc})']

    if not any(ln.startswith('# ') for ln in text.splitlines()[:5]):
        issues.append(f'{rel}: ไม่มี H1 title')

    return issues


def check_schema(path: Path, root: Path) -> list[str]:
    """ตรวจ SQL schema file ว่ามี comment บนสุดบอก version"""
    issues: list[str] = []
    rel = path.relative_to(root)
    try:
        text = path.read_text(encoding='utf-8', errors='replace')
    except OSError as exc:
        return [f'{rel}: อ่านไฟล์ไม่ได้ ({exc})']

    # 10 บรรทัดแรกต้องมี comment ที่มีคำว่า version หรือ v1.x
    head = '\n'.join(text.splitlines()[:10])
    if not re.search(r'(--|/\*).*v?\d+\.\d+', head, re.IGNORECASE):
        issues.append(f'{rel}: ส่วนหัวไม่มี version marker (เช่น -- v1.9.0)')

    return issues


def check(root: Path) -> list[str]:
    issues: list[str] = []

    adr_dir = root / '06-Decision-Records'
    if adr_dir.is_dir():
        for path in sorted(adr_dir.glob('ADR-*.md')):
            # ข้ามไฟล์ template/policy/meta ที่ไม่ใช่ ADR จริง
            if any(path.name.startswith(prefix) for prefix in NON_ADR_PREFIXES):
                continue
            issues.extend(check_adr(path, root))

    overview_dir = root / '00-overview'
    if overview_dir.is_dir():
        for path in sorted(overview_dir.glob('*.md')):
            if path.name == 'README.md':
                continue
            issues.extend(check_overview(path, root))

    data_dir = root / '03-Data-and-Storage'
    if data_dir.is_dir():
        for path in sorted(data_dir.glob('*.sql')):
            issues.extend(check_schema(path, root))

    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default='specs', help='โฟลเดอร์ specs (default: specs)')
    parser.add_argument('--strict', action='store_true', help='exit 1 ถ้ามีปัญหา')
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f'✗ ไม่พบโฟลเดอร์ {root}', file=sys.stderr)
        return 2

    print(f'🔍 ตรวจ metadata ของ spec files ใน {root}/')
    issues = check(root)

    if not issues:
        print('✓ metadata ครบถ้วน')
        return 0

    print(f'\n⚠️  พบ {len(issues)} ปัญหา:')
    for line in issues:
        print(f'  - {line}')

    return 1 if args.strict else 0


if __name__ == '__main__':
    sys.exit(main())
