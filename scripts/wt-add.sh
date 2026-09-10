#!/bin/bash
# File: scripts/wt-add.sh
# Git Worktree Bootstrap — สร้าง worktree + provision .env + pnpm install ในคำสั่งเดียว
#
# หลักการ:
#   - แต่ละ conversation ทำงานบน worktree ของตัวเอง ไม่ต้อง checkout สลับ
#   - primary worktree (/opt/np-dms-lcbp3) อยู่บน main เสมอ
#   - worktree ทั้งหมดอยู่ใน /opt/np-dms-wt/<branch-slug> (flat naming, ห้าม leading -)
#   - .env: symlink frontend/.env จาก primary, copy backend/.env จาก .env.example
#   - pnpm: รันที่ workspace root เพื่อให้ patches/overrides มีผล (frozen-lockfile เหมือน CI)
#
# Usage:
#   ./scripts/wt-add.sh <branch> [base]
#   ./scripts/wt-add.sh 256-new-feature           # สร้าง branch ใหม่จาก main
#   ./scripts/wt-add.sh 253-unified-doc-crud-complete  # เชื่อม branch ที่มีอยู่แล้ว
#   ./scripts/wt-add.sh 256-sub-task 253-unified-doc-crud-complete  # สร้างจาก base อื่น
#
# Change Log:
# - 2026-09-10: Initial creation

set -euo pipefail

BRANCH="${1:?Usage: wt-add.sh <branch> [base]}"
BASE="${2:-main}"
SLUG="${BRANCH//\//-}"
PRIMARY="/opt/np-dms-lcbp3"
WT_ROOT="/opt/np-dms-wt"
WT="$WT_ROOT/$SLUG"

# ตรวจสอบว่า primary มีอยู่
if [ ! -d "$PRIMARY/.git" ]; then
  echo "ERROR: primary worktree ไม่พบที่ $PRIMARY" >&2
  exit 1
fi

# ตรวจสอบว่า worktree นี้มีอยู่แล้ว
if [ -d "$WT" ]; then
  echo "ERROR: worktree มีอยู่แล้วที่ $WT" >&2
  exit 1
fi

# ตรวจสอบว่า branch มีอยู่แล้วหรือไม่ — ถ้ามีให้เชื่อม, ถ้าไม่มีให้สร้างใหม่
if git -C "$PRIMARY" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "→ เชื่อม branch ที่มีอยู่: $BRANCH"
  git -C "$PRIMARY" worktree add "$WT" "$BRANCH"
else
  echo "→ สร้าง branch ใหม่: $BRANCH (จาก $BASE)"
  git -C "$PRIMARY" worktree add -b "$BRANCH" "$WT" "$BASE"
fi

echo "→ Provisioning .env"
# frontend/.env — symlink จาก primary (ไฟล์จริงอยู่ที่นั่น)
if [ -f "$PRIMARY/frontend/.env" ]; then
  ln -sf "$PRIMARY/frontend/.env" "$WT/frontend/.env"
  echo "  frontend/.env → symlink จาก primary"
else
  echo "  WARNING: ไม่พบ frontend/.env ใน primary — คัดลอกจาก .env.example"
  cp "$WT/frontend/.env.example" "$WT/frontend/.env" 2>/dev/null || true
fi

# backend/.env — copy จาก .env.example (primary ไม่มี .env จริง)
if [ ! -f "$WT/backend/.env" ]; then
  cp "$WT/backend/.env.example" "$WT/backend/.env"
  echo "  backend/.env → copy จาก .env.example (แก้ secrets ตามต้องการ)"
else
  echo "  backend/.env มีอยู่แล้ว"
fi

echo "→ pnpm install (frozen-lockfile, workspace root)"
pnpm -C "$WT" install --frozen-lockfile

echo ""
echo "✅ พร้อมใช้งาน: cd $WT"
echo "   branch: $BRANCH"
echo "   base:   $BASE"
