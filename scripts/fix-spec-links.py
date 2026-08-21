#!/usr/bin/env python3
"""
Fix broken internal links in specs/**/*.md

แก้ไข links ที่เสียจากการ restructure โฟลเดอร์:
- Case fix: 02-Architecture → 02-architecture, 00-Overview → 00-overview, 01-Requirements → 01-requirements
- 03-implementation/ → 05-Engineering-Guidelines/ (or 99-archives/)
- 04-operations/ → 04-Infrastructure-OPS/ (or 99-archives/)
- 05-decisions/ → 06-Decision-Records/ (or 99-archives/, 06-Decision-Records/archive/)
- 06-tasks/ → 08-Tasks/
- 07-database/ → 03-Data-and-Storage/
- Desk-5439/ → np-dms-lcbp3/ (ADR-041 server consolidation)
- File renumbering in 01-requirements/
- Schema version v1.8.0 → v1.9.0

Usage:
  python3 scripts/fix-spec-links.py [--dry-run]
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# ── Mapping ของ path เก่า → ใหม่ ──────────────────────────────────────────────
# เรียงจาก specific → general (longest first) เพื่อกัน partial match
PATH_MAPPINGS: list[tuple[str, str]] = [
    # ── Case fixes (Windows → Linux) ──
    ('../02-Architecture/', '../02-architecture/'),
    ('../00-Overview/', '../00-overview/'),
    ('../01-Requirements/', '../01-requirements/'),

    # ── 01-requirements restructure ──
    ('../01-requirements/01-03.10-file-handling.md',
     '../99-archives/01-03.10-file-handling.md'),
    ('../01-requirements/01-04-access-control.md',
     '../99-archives/01-04-access-control.md'),
    ('../01-requirements/01-03.11-document-numbering.md',
     '../99-archives/01-03.11-document-numbering.md'),
    ('../01-requirements/03.11-document-numbering.md',
     '../99-archives/01-03.11-document-numbering.md'),
    ('../01-requirements/01-03-functional-requirements.md',
     '../01-requirements/01-03-modules/01-03-00-index.md'),
    ('../01-requirements/21-document-numbering-requirements.md',
     '../99-archives/01-03.11-document-numbering.md'),
    ('../01-requirements/03.2-correspondence.md',
     '../01-requirements/01-03-modules/01-03-02-correspondence.md'),
    ('../01-requirements/03.3-rfa.md',
     '../01-requirements/01-03-modules/01-03-03-rfa.md'),
    ('../01-requirements/03.4-contract-drawing.md',
     '../01-requirements/01-03-modules/01-03-04-contract-drawing.md'),
    ('../01-requirements/03.6-unified-workflow.md',
     '../01-requirements/01-03-modules/01-03-06-unified-workflow.md'),
    ('../01-requirements/03.7-transmittals.md',
     '../01-requirements/01-03-modules/01-03-07-transmittals.md'),
    ('../01-requirements/03.8-circulation-sheet.md',
     '../01-requirements/01-03-modules/01-03-08-circulation-sheet.md'),
    ('../01-requirements/01-02-architecture.md',
     '../02-architecture/02-02-software-architecture.md'),

    # ── 02-architecture restructure ──
    ('../02-architecture/02-01-system-architecture.md',
     '../02-architecture/02-02-software-architecture.md'),
    ('../02-architecture/02-02-api-design.md',
     '../02-architecture/02-04-api-design.md'),
    ('../02-architecture/02-03-data-model.md',
     '../99-archives/02-03-data-model.md'),
    ('../02-architecture/data-model.md',
     '../99-archives/02-03-data-model.md'),
    ('../02-architecture/system-architecture.md',
     '../02-architecture/02-02-software-architecture.md'),

    # ── 03-implementation → 05-Engineering-Guidelines ──
    ('../03-implementation/03-01-fullftack-js-v1.7.0.md',
     '../05-Engineering-Guidelines/05-01-fullstack-js-guidelines.md'),
    ('../03-implementation/03-02-backend-guidelines.md',
     '../05-Engineering-Guidelines/05-02-backend-guidelines.md'),
    ('../03-implementation/03-03-frontend-guidelines.md',
     '../05-Engineering-Guidelines/05-03-frontend-guidelines.md'),
    ('../03-implementation/03-04-document-numbering.md',
     '../99-archives/03-04-document-numbering.md'),
    ('../03-implementation/03-05-testing-strategy.md',
     '../05-Engineering-Guidelines/05-04-testing-strategy.md'),
    ('../03-implementation/backend-guidelines.md',
     '../05-Engineering-Guidelines/05-02-backend-guidelines.md'),
    ('../03-implementation/frontend-guidelines.md',
     '../05-Engineering-Guidelines/05-03-frontend-guidelines.md'),
    ('../03-implementation/README.md',
     '../05-Engineering-Guidelines/README.md'),
    ('../03-implementation/', '../05-Engineering-Guidelines/'),
    ('../../03-implementation/frontend-guidelines.md',
     '../../05-Engineering-Guidelines/05-03-frontend-guidelines.md'),

    # ── 04-operations → 04-Infrastructure-OPS ──
    ('../04-operations/04-01-deployment-guide.md',
     '../04-Infrastructure-OPS/04-04-deployment-guide.md'),
    ('../04-operations/04-02-environment-setup.md',
     '../99-archives/04-02-environment-setup.md'),
    ('../04-operations/04-03-monitoring-alerting.md',
     '../04-Infrastructure-OPS/04-03-monitoring.md'),
    ('../04-operations/04-04-backup-recovery.md',
     '../04-Infrastructure-OPS/04-02-backup-recovery.md'),
    ('../04-operations/04-05-maintenance-procedures.md',
     '../04-Infrastructure-OPS/04-05-maintenance-procedures.md'),
    ('../04-operations/04-06-security-operations.md',
     '../04-Infrastructure-OPS/04-06-security-operations.md'),
    ('../04-operations/04-07-incident-response.md',
     '../04-Infrastructure-OPS/04-07-incident-response.md'),
    ('../04-operations/04-08-document-numbering-operations.md',
     '../99-archives/04-08-document-numbering-operations.md'),
    ('../04-operations/README.md',
     '../04-Infrastructure-OPS/README.md'),
    ('../04-operations/', '../04-Infrastructure-OPS/'),

    # ── 05-decisions → 06-Decision-Records (or 99-archives, or archive/) ──
    # ADRs that moved to 99-archives (old/superseded)
    ('../05-decisions/ADR-003-file-storage-approach.md',
     '../99-archives/ADR-003-file-storage-approach.md'),
    ('../05-decisions/ADR-004-rbac-implementation.md',
     '../99-archives/ADR-004-rbac-implementation.md'),
    ('../05-decisions/ADR-007-api-design-error-handling.md',
     '../99-archives/ADR-007-api-design-error-handling.md'),
    ('../05-decisions/adr-018-document-numbering.md',
     '../06-Decision-Records/ADR-018-ai-boundary.md'),

    # ADRs that moved to 06-Decision-Records/archive/ (archived AI ADRs)
    ('../05-decisions/ADR-017-ollama-data-migration.md',
     '../06-Decision-Records/archive/ADR-017-ollama-data-migration.md'),
    ('../05-decisions/ADR-017B-ai-document-classification.md',
     '../06-Decision-Records/archive/ADR-017B-ai-document-classification.md'),
    ('../05-decisions/ADR-018-ai-boundary.md',
     '../06-Decision-Records/archive/ADR-018-ai-boundary.md'),
    ('../05-decisions/ADR-020-ai-intelligence-integration.md',
     '../06-Decision-Records/archive/ADR-020-ai-intelligence-integration.md'),
    ('../05-decisions/ADR-022-retrieval-augmented-generation.md',
     '../06-Decision-Records/archive/ADR-022-retrieval-augmented-generation.md'),

    # ADRs that moved to 06-Decision-Records/ (active)
    ('../05-decisions/README.md', '../06-Decision-Records/README.md'),
    ('../05-decisions/ADR-001-unified-workflow-engine.md',
     '../06-Decision-Records/ADR-001-unified-workflow-engine.md'),
    ('../05-decisions/ADR-002-document-numbering-strategy.md',
     '../06-Decision-Records/ADR-002-document-numbering-strategy.md'),
    ('../05-decisions/ADR-005-technology-stack.md',
     '../06-Decision-Records/ADR-005-technology-stack.md'),
    ('../05-decisions/ADR-006-redis-caching-strategy.md',
     '../06-Decision-Records/ADR-006-redis-caching-strategy.md'),
    ('../05-decisions/ADR-010-logging-monitoring-strategy.md',
     '../06-Decision-Records/ADR-010-logging-monitoring-strategy.md'),
    ('../05-decisions/ADR-011-nextjs-app-router.md',
     '../06-Decision-Records/ADR-011-nextjs-app-router.md'),
    ('../05-decisions/ADR-012-ui-component-library.md',
     '../06-Decision-Records/ADR-012-ui-component-library.md'),
    ('../05-decisions/ADR-013-form-handling-validation.md',
     '../06-Decision-Records/ADR-013-form-handling-validation.md'),
    ('../05-decisions/ADR-014-state-management.md',
     '../06-Decision-Records/ADR-014-state-management.md'),
    ('../05-decisions/ADR-015-deployment-infrastructure.md',
     '../06-Decision-Records/ADR-015-deployment-infrastructure.md'),
    ('../05-decisions/', '../06-Decision-Records/'),
    ('../../05-decisions/', '../../06-Decision-Records/'),

    # ── 06-tasks → 08-Tasks ──
    ('../06-tasks/README.md', '../08-Tasks/'),
    ('../06-tasks/', '../08-Tasks/'),

    # ── 07-database → 03-Data-and-Storage ──
    ('../07-database/data-dictionary-v1.7.0.md',
     '../03-Data-and-Storage/03-01-data-dictionary.md'),
    ('../07-database/data-dictionary-v1.6.0.md',
     '../03-Data-and-Storage/03-01-data-dictionary.md'),
    ('../07-database/lcbp3-v1.6.0-schema.sql',
     '../03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql'),
    ('../07-database/lcbp3-v1.7.0-schema.sql',
     '../03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql'),
    ('../specs/07-database/data-dictionary-v1.7.0.md',
     '../03-Data-and-Storage/03-01-data-dictionary.md'),
    ('../specs/07-database/lcbp3-v1.7.0-schema.sql',
     '../03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql'),

    # ── Schema version upgrade ──
    ('../03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql',
     '../03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql'),
    ('./lcbp3-v1.8.0-migration.sql',
     '../03-Data-and-Storage/lcbp3-v1.9.0-migration.sql'),

    # ── Desk-5439 → np-dms-lcbp3 (ADR-041) ──
    ('04-00-docker-compose/Desk-5439/',
     '04-00-docker-compose/np-dms-lcbp3/'),
    # ocr-sidecar path: np-dms-lcbp3/ocr-sidecar → np-dms-lcbp3/04-ai/ocr-sidecar
    ('np-dms-lcbp3/ocr-sidecar/', 'np-dms-lcbp3/04-ai/ocr-sidecar/'),

    # ── 03-Data-and-Storage old paths ──
    ('../03-Data-and-Storage/03-05-n8n-migration-setup-guide.md',
     '../03-Data-and-Storage/03-05-n8n-migration-setup-guide.md'),  # already correct, no-op
    ('../03-Data-and-Storage/03-04-legacy-data-migration.md',
     '../03-Data-and-Storage/03-04-legacy-data-migration.md'),  # already correct, no-op

    # ── Old specs/ prefix links (from repo root perspective) ──
    ('../specs/01-requirements/03.11-document-numbering.md',
     '../99-archives/01-03.11-document-numbering.md'),
    ('../specs/03-implementation/document-numbering.md',
     '../99-archives/03-04-document-numbering.md'),

    # ── 08-Tasks old task files → 99-archives ──
    ('../08-Tasks/TASK-BE-015-schema-v160-migration.md',
     '../99-archives/tasks/TASK-BE-015-schema-v160-migration.md'),
    ('../08-Tasks/TASK-FE-017-document-numbering-refactor.md',
     '../99-archives/tasks/TASK-FE-017-document-numbering-refactor.md'),

    # ── Subdirectory depth fix: files in 99-archives/history/, 99-archives/docs/,
    # 99-archives/tasks/, 03-Data-and-Storage/archive/, 08-Tasks/ADR-*/
    # ใช้ ../ แต่ต้องการ ../../ เพื่อขึ้นไป specs/ root
    # (เหล่านี้จะถูก apply เฉพาะใน apply_subdir_depth_fixes)

    # ── %20 encoding fix (trailing space in URL) ──
    ('ADR-021-integrated-workflow-context.md%20.md',
     'ADR-021-integrated-workflow-context.md'),

    # ── 01-requirements/01-03-modules/README.md → 01-03-00-index.md ──
    ('../01-requirements/01-03-modules/README.md',
     '../01-requirements/01-03-modules/01-03-00-index.md'),

    # ── Bare filename fixes (no prefix) in 05-Engineering-Guidelines/ ──
    # 03-02-backend-guidelines.md → 05-02-backend-guidelines.md
    # (these are bare filenames referenced from within 05-Engineering-Guidelines/)
]

# ── File-specific regex fixes ──────────────────────────────────────────────────

# สำหรับ 01-03-00-index.md: 01-02-XX → 01-03-XX
INDEX_FILE = 'specs/01-requirements/01-03-modules/01-03-00-index.md'
INDEX_PREFIX_RE = re.compile(r'\(01-02-(\d{2}-[^)]+)\)')

# สำหรับ 01-requirements/README.md: ./01-02-modules/01-02-XX → ./01-03-modules/01-03-XX
README_MODULES_RE = re.compile(r'\./01-02-modules/01-02-(\d{2}-[^)]+)\)')
README_OLD_DOT_RE = re.compile(r'\./01-03\.(\d+-[^)]+)\.md\)')
# ./01-03-XX-*.md → ./01-03-modules/01-03-XX-*.md (ใน README.md)
README_DIRECT_RE = re.compile(r'\./01-03-(\d{2}-[^)]+)\.md\)')
# ./01-03-011 → ./01-03-modules/01-03-11 (special case: 011 → 11)
README_011_RE = re.compile(r'\./01-03-011-document-numbering\.md\)')
# ./01-03-functional-requirements → ./01-03-modules/01-03-00-index
README_FUNC_REQ_RE = re.compile(r'\./01-03-functional-requirements\.md\)')
# 01-06-non-functional.md (no ./ prefix) → ./01-02-business-rules/01-02-04-non-functional-rules.md
README_BARE_NONFUNC_RE = re.compile(r'(?<![\w/])01-06-non-functional\.md\)')

# สำหรับ 01-requirements/README.md: ./01-01-business-rules/ → ./01-02-business-rules/
README_BIZ_RULES_RE = re.compile(r'\./01-01-business-rules/01-(01|02)-(\d{2}-[^)]+)\.md\)')

# สำหรับ 01-requirements/README.md: ./01-07-testing → ./01-02-business-rules/01-02-05-testing-rules
# และ ./01-06-non-functional → ./01-02-business-rules/01-02-04-non-functional-rules
README_TESTING_RE = re.compile(r'\./01-07-testing\.md\)')
README_NONFUNC_RE = re.compile(r'\./01-06-non-functional\.md\)')

# สำหรับ 02-architecture/README.md: ./02-01-system-architecture → ./02-02-software-architecture
# และ ./02-02-api-design → ./02-04-api-design, ./02-03-data-model → ../99-archives/02-03-data-model
# รวมแบบไม่มี ./ prefix
ARCH_README_RE_01 = re.compile(r'(?:\./|/)?02-01-system-architecture\.md\)')
ARCH_README_RE_02 = re.compile(r'(?:\./|/)?02-02-api-design\.md\)')
ARCH_README_RE_03 = re.compile(r'(?:\./|/)?02-03-data-model\.md\)')

# สำหรับ 04-Infrastructure-OPS/*.md: ./04-01-deployment-guide → ./04-04-deployment-guide
# และ ./04-03-monitoring-alerting → ./04-03-monitoring, ./04-04-backup-recovery → ./04-02-backup-recovery
# รวมทั้งแบบไม่มี ./ prefix (04-03-monitoring-alerting.md)
OPS_DEPLOY_RE = re.compile(r'(?:\./|/)?04-01-deployment-guide\.md\)')
OPS_MONITOR_RE = re.compile(r'(?:\./|/)?04-03-monitoring-alerting\.md\)')
OPS_BACKUP_RE = re.compile(r'(?:\./|/)?04-04-backup-recovery\.md\)')
OPS_ENV_RE = re.compile(r'(?:\./|/)?04-02-environment-setup\.md\)')

# สำหรับ 06-Decision-Records/*.md: ./ADR-017B-ollama → ./archive/ADR-017B-ai-document-classification
# และ ./ADR-037-active-prompt-system → ./ADR-037-unified-prompt-management-ux-ui
ADR_017B_RE = re.compile(r'\./ADR-017B-ollama\.md\)')
ADR_037_RE = re.compile(r'\./ADR-037-active-prompt-system\.md\)')

# สำหรับ 08-Tasks/*.md: ./TASK-BE-004 → ../99-archives/history/TASK-BE-004
TASK_BE_004_RE = re.compile(r'\./TASK-BE-004-document-numbering\.md\)')

# ── Local ADR mappings (within 06-Decision-Records/) ──
# ADRs ที่ย้ายไป archive/
LOCAL_ADR_TO_ARCHIVE = [
    ('./ADR-017-ollama-data-migration.md)', './archive/ADR-017-ollama-data-migration.md)'),
    ('./ADR-017B-ai-document-classification.md)', './archive/ADR-017B-ai-document-classification.md)'),
    ('./ADR-018-ai-boundary.md)', './archive/ADR-018-ai-boundary.md)'),
    ('./ADR-020-ai-intelligence-integration.md)', './archive/ADR-020-ai-intelligence-integration.md)'),
    ('./ADR-022-retrieval-augmented-generation.md)', './archive/ADR-022-retrieval-augmented-generation.md)'),
]
# ADRs ที่ย้ายไป 99-archives/
LOCAL_ADR_TO_ARCHIVES = [
    ('./ADR-004-rbac-implementation.md)', '../99-archives/ADR-004-rbac-implementation.md)'),
    ('./ADR-007-api-design-error-handling.md)', '../99-archives/ADR-007-api-design-error-handling.md)'),
]
# ADRs ที่ถูกเปลี่ยนชื่อ
LOCAL_ADR_RENAMED = [
    ('./ADR-005-redis-usage-strategy.md)', './ADR-006-redis-caching-strategy.md)'),
    ('./ADR-006-security-best-practices.md)', './ADR-016-security-authentication.md)'),
    ('./ADR-007-deployment-strategy.md)', './ADR-015-deployment-infrastructure.md)'),
]

# ── Subdirectory depth fix ──
# ไฟล์ใน subdirectory ของ specs/ ที่ใช้ ../ แต่ต้องการ ../../
# ตรวจสอบจาก path ของไฟล์ต้นทาง
SUBDIR_PREFIXES = [
    'specs/99-archives/history/',
    'specs/99-archives/docs/',
    'specs/99-archives/tasks/',
    'specs/99-archives/old-workflows-wrapper/',
    'specs/03-Data-and-Storage/archive/',
    'specs/03-Data-and-Storage/deltas/',
    'specs/06-Decision-Records/archive/',
    'specs/08-Tasks/ADR-021-workflow-context/',
    'specs/08-Tasks/ADR-022-Retrieval-Augmented-Generation/',
    'specs/04-Infrastructure-OPS/04-00-docker-compose/',
    'specs/100-Infrastructures/144-rclone-gdrive-sync/',
    'specs/200-fullstacks/227-ai-admin-console/',
    'specs/200-fullstacks/230-context-aware-prompt-templates/',
    'specs/200-fullstacks/232-typhoon-ocr-integration/',
    'specs/200-fullstacks/233-ai-model-ocr-runner-management/',
    'specs/200-fullstacks/235-ai-runtime-policy-refactor/',
    'specs/200-fullstacks/240-ai-console-collapsible-cards/',
    'specs/300-others/301-unified-ai-arch/',
]

# Paths ที่ต้องเพิ่ม ../ (จาก ../ → ../../)
# ใช้ regex เพื่อกัน double-application: ตรวจว่า ../ ไม่ได้ถูกนำหน้าด้วย ../ อีก
SUBDIR_DEPTH_FIXES = [
    (re.compile(r'(?<!\.\./)\.\./99-archives/'), '../../99-archives/'),
    (re.compile(r'(?<!\.\./)\.\./06-Decision-Records/'), '../../06-Decision-Records/'),
    (re.compile(r'(?<!\.\./)\.\./03-Data-and-Storage/'), '../../03-Data-and-Storage/'),
    (re.compile(r'(?<!\.\./)\.\./05-Engineering-Guidelines/'), '../../05-Engineering-Guidelines/'),
    (re.compile(r'(?<!\.\./)\.\./02-architecture/'), '../../02-architecture/'),
    (re.compile(r'(?<!\.\./)\.\./01-requirements/'), '../../01-requirements/'),
    (re.compile(r'(?<!\.\./)\.\./00-overview/'), '../../00-overview/'),
    (re.compile(r'(?<!\.\./)\.\./04-Infrastructure-OPS/'), '../../04-Infrastructure-OPS/'),
    (re.compile(r'(?<!\.\./)\.\./08-Tasks/'), '../../08-Tasks/'),
]


def apply_path_mappings(text: str) -> tuple[str, int]:
    """แทนที่ path เก่าด้วย path ใหม่ คืน (text, จำนวนที่แทนที่)"""
    count = 0
    for old, new in PATH_MAPPINGS:
        if old == new:
            continue  # skip no-ops
        occurrences = text.count(old)
        if occurrences > 0:
            text = text.replace(old, new)
            count += occurrences
    return text, count


def apply_regex_fixes(text: str, filepath: str) -> tuple[str, int]:
    """แก้ไขด้วย regex ที่ specific ต่อไฟล์"""
    count = 0

    # index file: 01-02-XX → 01-03-XX
    if filepath == INDEX_FILE:
        def index_replacer(m: re.Match) -> str:
            nonlocal count
            count += 1
            return f'(01-03-{m.group(1)})'
        text = INDEX_PREFIX_RE.sub(index_replacer, text)

    # 01-requirements/README.md fixes
    if filepath.endswith('01-requirements/README.md'):
        # ./01-02-modules/01-02-XX → ./01-03-modules/01-03-XX
        def modules_replacer(m: re.Match) -> str:
            nonlocal count
            count += 1
            return f'./01-03-modules/01-03-{m.group(1)})'
        text = README_MODULES_RE.sub(modules_replacer, text)

        # ./01-03.X-xxx → ./01-03-0X-xxx
        def old_dot_replacer(m: re.Match) -> str:
            nonlocal count
            count += 1
            return f'./01-03-0{m.group(1)}.md)'
        text = README_OLD_DOT_RE.sub(old_dot_replacer, text)

        # ./01-03-011-document-numbering → ./01-03-modules/01-03-11-document-numbering
        # (special: 011 → 11)
        if README_011_RE.search(text):
            text = README_011_RE.sub(
                './01-03-modules/01-03-11-logs.md)', text)  # closest match
            count += 1

        # ./01-03-functional-requirements → ./01-03-modules/01-03-00-index
        if README_FUNC_REQ_RE.search(text):
            text = README_FUNC_REQ_RE.sub(
                './01-03-modules/01-03-00-index.md)', text)
            count += 1

        # ./01-03-XX-*.md → ./01-03-modules/01-03-XX-*.md (direct, no modules/ prefix)
        def direct_replacer(m: re.Match) -> str:
            nonlocal count
            count += 1
            return f'./01-03-modules/01-03-{m.group(1)})'
        text = README_DIRECT_RE.sub(direct_replacer, text)

        # ./01-01-business-rules/01-XX-YY → ./01-02-business-rules/01-02-YY
        def bizrules_replacer(m: re.Match) -> str:
            nonlocal count
            count += 1
            return f'./01-02-business-rules/01-02-{m.group(2)}.md)'
        text = README_BIZ_RULES_RE.sub(bizrules_replacer, text)

        # ./01-07-testing → ./01-02-business-rules/01-02-05-testing-rules
        if README_TESTING_RE.search(text):
            text = README_TESTING_RE.sub(
                './01-02-business-rules/01-02-05-testing-rules.md)', text)
            count += 1

        # ./01-06-non-functional → ./01-02-business-rules/01-02-04-non-functional-rules
        if README_NONFUNC_RE.search(text):
            text = README_NONFUNC_RE.sub(
                './01-02-business-rules/01-02-04-non-functional-rules.md)', text)
            count += 1

        # 01-06-non-functional.md (no ./ prefix) → ./01-02-business-rules/01-02-04-non-functional-rules.md
        if README_BARE_NONFUNC_RE.search(text):
            text = README_BARE_NONFUNC_RE.sub(
                './01-02-business-rules/01-02-04-non-functional-rules.md)', text)
            count += 1

    # 02-architecture/README.md fixes
    if filepath.endswith('02-architecture/README.md'):
        if ARCH_README_RE_01.search(text):
            text = ARCH_README_RE_01.sub('./02-02-software-architecture.md)', text)
            count += 1
        if ARCH_README_RE_02.search(text):
            text = ARCH_README_RE_02.sub('./02-04-api-design.md)', text)
            count += 1
        if ARCH_README_RE_03.search(text):
            text = ARCH_README_RE_03.sub('../99-archives/02-03-data-model.md)', text)
            count += 1

    # 04-Infrastructure-OPS/*.md local links (รวมแบบมีและไม่มี ./ prefix)
    if '04-Infrastructure-OPS/' in filepath and '04-00-docker-compose' not in filepath:
        if OPS_DEPLOY_RE.search(text):
            text = OPS_DEPLOY_RE.sub('./04-04-deployment-guide.md)', text)
            count += 1
        if OPS_MONITOR_RE.search(text):
            text = OPS_MONITOR_RE.sub('./04-03-monitoring.md)', text)
            count += 1
        if OPS_BACKUP_RE.search(text):
            text = OPS_BACKUP_RE.sub('./04-02-backup-recovery.md)', text)
            count += 1
        if OPS_ENV_RE.search(text):
            text = OPS_ENV_RE.sub('../99-archives/04-02-environment-setup.md)', text)
            count += 1

    # 06-Decision-Records/*.md local ADR links
    if '06-Decision-Records/' in filepath and 'archive' not in filepath:
        if ADR_017B_RE.search(text):
            text = ADR_017B_RE.sub('./archive/ADR-017B-ai-document-classification.md)', text)
            count += 1
        if ADR_037_RE.search(text):
            text = ADR_037_RE.sub('./ADR-037-unified-prompt-management-ux-ui.md)', text)
            count += 1

    # 08-Tasks/*.md local task links
    if '08-Tasks/' in filepath:
        if TASK_BE_004_RE.search(text):
            text = TASK_BE_004_RE.sub(
                '../99-archives/history/TASK-BE-004-document-numbering.md)', text)
            count += 1

    # ── Local ADR fixes (within 06-Decision-Records/ but NOT in archive/) ──
    if '06-Decision-Records/' in filepath and 'archive' not in filepath:
        # ADRs → archive/
        for old, new in LOCAL_ADR_TO_ARCHIVE:
            if old in text:
                n = text.count(old)
                text = text.replace(old, new)
                count += n
        # ADRs → 99-archives/
        for old, new in LOCAL_ADR_TO_ARCHIVES:
            if old in text:
                n = text.count(old)
                text = text.replace(old, new)
                count += n
        # Renamed ADRs
        for old, new in LOCAL_ADR_RENAMED:
            if old in text:
                n = text.count(old)
                text = text.replace(old, new)
                count += n

    # ── 06-Decision-Records/ (not archive/): ../../../ → ../../ (depth fix) ──
    if '06-Decision-Records/' in filepath and 'archive' not in filepath:
        # ../../../CONTEXT.md → ../../CONTEXT.md (files directly in 06-Decision-Records/)
        # ../../../docs/ → ../../docs/
        n1 = text.count('../../../')
        if n1 > 0:
            text = text.replace('../../../', '../../')
            count += n1

    # ── Archive: ./ADR-XXX → ../ADR-XXX for ADRs NOT in archive/ ──
    # ADRs in archive/: 017, 017B, 018, 020, 022
    # All other ADRs referenced with ./ should be ../ (parent directory)
    if '06-Decision-Records/archive/' in filepath:
        # Match ./ADR-XXX.md) where XXX is NOT 017, 017B, 018, 020, 022, XXX, YYY
        text_new, n = re.subn(
            r'\./ADR-(?!017-|017B-|018-|020-|022-|XXX|YYY)(\d+[A-Z]?-[^)]+)\.md\)',
            r'../ADR-\1.md)',
            text,
        )
        if n > 0:
            text = text_new
            count += n

    # ── 99-archives/ ADR files: local ADR refs → ../06-Decision-Records/ ──
    if '99-archives/' in filepath and 'ADR-' in filepath.split('/')[-1]:
        # ./ADR-005-technology-stack → ../06-Decision-Records/ADR-005-technology-stack
        text_new, n = re.subn(
            r'\./ADR-005-technology-stack\.md\)',
            r'../06-Decision-Records/ADR-005-technology-stack.md)',
            text,
        )
        if n > 0:
            text = text_new
            count += n
        # ./ADR-006-security-best-practices → ../06-Decision-Records/ADR-016-security-authentication
        text_new, n = re.subn(
            r'\./ADR-006-security-best-practices\.md\)',
            r'../06-Decision-Records/ADR-016-security-authentication.md)',
            text,
        )
        if n > 0:
            text = text_new
            count += n
        # ./ADR-005-redis-usage-strategy → ../06-Decision-Records/ADR-006-redis-caching-strategy
        text_new, n = re.subn(
            r'\./ADR-005-redis-usage-strategy\.md\)',
            r'../06-Decision-Records/ADR-006-redis-caching-strategy.md)',
            text,
        )
        if n > 0:
            text = text_new
            count += n
        # ./ADR-001-unified-workflow-engine → ../06-Decision-Records/ADR-001-unified-workflow-engine
        text_new, n = re.subn(
            r'\./ADR-001-unified-workflow-engine\.md\)',
            r'../06-Decision-Records/ADR-001-unified-workflow-engine.md)',
            text,
        )
        if n > 0:
            text = text_new
            count += n

    # ── Archive subdirectory: ../ADR-XXX → ./ADR-XXX (same directory within archive/) ──
    # เฉพาะ ADRs ที่อยู่ใน archive/ เท่านั้น — ไม่รวม ADR-023/043 ที่อยู่ใน parent
    if '06-Decision-Records/archive/' in filepath:
        # ADRs ที่อยู่ใน archive/: 017, 017B, 018, 020, 022
        for adr_num in ['017', '017B', '018', '020', '022']:
            old = f'../ADR-{adr_num}-'
            # หา pattern ../ADR-017-xxx.md) → ./ADR-017-xxx.md)
            text_new, n = re.subn(
                rf'\.\./ADR-{adr_num}-([^)]+)\.md\)',
                rf'./ADR-{adr_num}-\1.md)',
                text,
            )
            if n > 0:
                text = text_new
                count += n
        # Fix ../ADR-017B-ollama → ./ADR-017B-ai-document-classification
        text_new, n = re.subn(
            r'\.\./ADR-017B-ollama\.md\)',
            r'./ADR-017B-ai-document-classification.md)',
            text,
        )
        if n > 0:
            text = text_new
            count += n

    # ── Fix missing .md extension in 01-requirements/README.md table links ──
    # ./01-03-modules/01-03-XX-xxx) → ./01-03-modules/01-03-XX-xxx.md)
    if filepath.endswith('01-requirements/README.md'):
        text_new, n = re.subn(
            r'\(./01-03-modules/01-03-(\d{2}-[a-z-]+)\)',
            r'(./01-03-modules/01-03-\1.md)',
            text,
        )
        if n > 0:
            text = text_new
            count += n

    # ── Fix unencoded parentheses in markdown links ──
    # frontend/app/(admin)/... → frontend/app/%28admin%29/...
    # Markdown links can't contain raw ) in the URL part
    text_new, n = re.subn(
        r'\]\(frontend/app/\(admin\)/',
        '](frontend/app/%28admin%29/',
        text,
    )
    if n > 0:
        text = text_new
        count += n

    # ── Subdirectory depth fixes ──
    # ไฟล์ใน subdirectory ของ specs/ ที่ใช้ ../ แต่ต้องการ ../../
    for prefix in SUBDIR_PREFIXES:
        if filepath.startswith(prefix):
            for pattern, replacement in SUBDIR_DEPTH_FIXES:
                text_new, n = pattern.subn(replacement, text)
                if n > 0:
                    text = text_new
                    count += n
            break

    return text, count


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true',
                        help='แสดงผลลัพธ์โดยไม่เขียนไฟล์')
    args = parser.parse_args()

    root = Path('specs')
    if not root.is_dir():
        print(f'✗ ไม่พบโฟลเดอร์ {root}', file=sys.stderr)
        return 2

    total_fixed = 0
    files_fixed = 0

    for md in sorted(root.rglob('*.md')):
        try:
            original = md.read_text(encoding='utf-8')
        except OSError as exc:
            print(f'⚠️  อ่านไม่ได้: {md} ({exc})', file=sys.stderr)
            continue

        text = original
        count = 0

        # path mappings (ทุกไฟล์)
        text, n = apply_path_mappings(text)
        count += n

        # file-specific regex fixes
        text, n = apply_regex_fixes(text, str(md))
        count += n

        if count > 0:
            files_fixed += 1
            total_fixed += count
            rel = md.relative_to(Path('.'))
            if args.dry_run:
                print(f'  [DRY] {rel}: {count} replacements')
            else:
                md.write_text(text, encoding='utf-8')
                print(f'  ✓ {rel}: {count} replacements')

    print(f'\n{"="*50}')
    print(f'  แก้ไข {files_fixed} ไฟล์, รวม {total_fixed} replacements')
    if args.dry_run:
        print('  (dry-run — ไม่ได้เขียนไฟล์จริง)')
    print(f'{"="*50}')

    return 0


if __name__ == '__main__':
    sys.exit(main())
