#!/bin/bash
# File: 2git.sh
# Change Log:
# - 2026-08-26: เพิ่ม squash commits ก่อน push — รวม commits ที่นำ origin/main เป็น commit เดียว
# - 2026-08-20: ตัด push ไป GitHub ออก เนื่องจาก Gitea ตั้งค่า mirror ไป GitHub แล้ว
# - 2026-07-02: Ported from 2git.ps1 for Linux server

MESSAGE="${1:-Upadte}"

TIMESTAMP=$(date +"%y%m%d:%H%M")
COMMIT_MSG="$TIMESTAMP $MESSAGE"

echo -e "\033[36m📦 $COMMIT_MSG\033[0m"

git add .

# Commit ถ้ามีการเปลี่ยนแปลงใน working tree
STATUS=$(git status --porcelain)
if [ -n "$STATUS" ]; then
    git commit -m "$COMMIT_MSG"
    if [ $? -ne 0 ]; then
        echo -e "\033[31m❌ Commit failed\033[0m"
        read -p "Press Enter to continue..."
        exit 1
    fi
fi

# ตรวจ commits ที่นำ origin/main
AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null)
if [ -z "$AHEAD" ] || [ "$AHEAD" -eq 0 ]; then
    echo -e "\033[33m⚠️ Nothing to push\033[0m"
    read -p "Press Enter to continue..."
    exit 0
fi

# Squash commits ถ้านำมากกว่า 1 commit
if [ "$AHEAD" -gt 1 ]; then
    echo -e "\033[36m🔀 Squashing $AHEAD commits into one...\033[0m"
    # เก็บ commit messages เดิมไว้ใน body เพื่อ audit trail
    SQUASH_BODY=$(git log origin/main..HEAD --format='%h %s' | sed 's/^/  - /')
    git reset --soft origin/main
    git commit -m "$COMMIT_MSG" -m "Squashed commits:" -m "$SQUASH_BODY"
    if [ $? -ne 0 ]; then
        echo -e "\033[31m❌ Squash failed\033[0m"
        read -p "Press Enter to continue..."
        exit 1
    fi
fi

echo -e "\033[36m🚀 Pushing to Gitea...\033[0m"
git push origin main
if [ $? -ne 0 ]; then
    echo -e "\033[31m❌ Push to Gitea failed\033[0m"
    read -p "Press Enter to continue..."
    exit 1
fi

echo -e "\033[32m✅ Done!\033[0m"
