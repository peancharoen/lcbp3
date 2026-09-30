#!/bin/bash
# File: 2git.sh
# Change Log:
# - 2026-09-30: Fix --skip-ci no-op เมื่อ HEAD ถูก commit ไว้ก่อนแล้ว (amend marker ก่อน push)
#   + strip [skip CI] ออกจาก squash body — marker ต้องมาจาก flag เท่านั้น (กัน leak → code push โดน skip)
# - 2026-09-08: Add --skip-ci flag for docs/memory commits (appends [skip CI] to message)
# - 2026-09-08: Fix default message typo, support multi-word message, add branch guard, fetch origin/main, show status summary, remove interactive read on error
# - 2026-08-26: เพิ่ม squash commits ก่อน push — รวม commits ที่นำ origin/main เป็น commit เดียว
# - 2026-08-20: ตัด push ไป GitHub ออก เนื่องจาก Gitea ตั้งค่า mirror ไป GitHub แล้ว
# - 2026-07-02: Ported from 2git.ps1 for Linux server

set -e

# ตรวจ --skip-ci flag (สำหรับ docs/memory commits — ไม่ trigger CI)
SKIP_CI=""
if [ "$1" = "--skip-ci" ]; then
    SKIP_CI=" [skip CI]"
    shift
fi

# รองรับ message หลายคำ ถ้าไม่ใส่ให้ใช้ Update
MESSAGE="${*:-Update}"

TIMESTAMP=$(date +"%y%m%d:%H%M")
COMMIT_MSG="$TIMESTAMP $MESSAGE$SKIP_CI"

# ตรวจสอบว่าอยู่บน main
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "\033[31m❌ ต้องอยู่บน branch 'main' ปัจจุบันอยู่บน '$CURRENT_BRANCH'\033[0m"
    exit 1
fi

# Fetch origin/main ก่อนวัดสถานะ
if ! git fetch origin main 2>/dev/null; then
    echo -e "\033[31m❌ ไม่สามารถ fetch origin/main ได้\033[0m"
    exit 1
fi

# แสดงสรุปไฟล์ที่กำลังจะ commit
STATUS=$(git status --short)
if [ -n "$STATUS" ]; then
    echo -e "\033[36m📝 ไฟล์ที่กำลังจะ stage:\033[0m"
    echo "$STATUS"
    echo ""
fi

echo -e "\033[36m📦 $COMMIT_MSG\033[0m"

# Stage ทั้งหมด
if [ -n "$STATUS" ]; then
    git add .

    # Commit ถ้ามีการเปลี่ยนแปลงใน working tree
    git commit -m "$COMMIT_MSG"
fi

# ตรวจ commits ที่นำ origin/main
AHEAD=$(git rev-list --count origin/main..HEAD)
if [ -z "$AHEAD" ] || [ "$AHEAD" -eq 0 ]; then
    echo -e "\033[33m⚠️ Nothing to push\033[0m"
    exit 0
fi

# Squash commits ถ้านำมากกว่า 1 commit
if [ "$AHEAD" -gt 1 ]; then
    echo -e "\033[36m🔀 Squashing $AHEAD commits into one...\033[0m"
    # เก็บ commit messages เดิมไว้ใน body เพื่อ audit trail
    # strip [skip CI] ออกเสมอ — marker ต้องอยู่ใน subject ผ่าน flag เท่านั้น
    # (incident 2026-09-22: marker ใน body ทำ code push โดน CI skip โดยไม่ตั้งใจ)
    SQUASH_BODY=$(git log origin/main..HEAD --format='%h %s' | sed 's/\[skip CI\]//g; s/^/  - /')
    git reset --soft origin/main
    git commit -m "$COMMIT_MSG" -m "Squashed commits:" -m "$SQUASH_BODY"
fi

# --skip-ci guard: COMMIT_MSG ถูกใช้เฉพาะตอน script commit เอง (uncommitted changes
# หรือ squash) — ถ้า HEAD เป็น commit เดิมที่ผู้ใช้ commit ไว้ก่อน marker จะไม่ติด
# → amend เพิ่ม [skip CI] เข้า HEAD ก่อน push
if [ "$AHEAD" -eq 1 ] && [ -n "$SKIP_CI" ]; then
    if ! git log -1 --format=%B HEAD | grep -q '\[skip CI\]'; then
        echo -e "\033[36m🏷️  Appending [skip CI] marker to HEAD commit...\033[0m"
        git commit --amend -m "$(git log -1 --format=%B HEAD)$SKIP_CI"
    fi
fi

echo -e "\033[36m🚀 Pushing to Gitea...\033[0m"
if ! git push origin main; then
    echo -e "\033[31m❌ Push to Gitea failed\033[0m"
    exit 1
fi

echo -e "\033[32m✅ Done!\033[0m"
