#!/bin/bash
# File: 2git.sh
# Change Log:
# - 2026-07-02: Ported from 2git.ps1 for Linux server

MESSAGE="${1:-Backup}"

TIMESTAMP=$(date +"%y%m%d:%H%M")
COMMIT_MSG="$TIMESTAMP $MESSAGE"

echo -e "\033[36m📦 $COMMIT_MSG\033[0m"

git add .

# Check if anything to commit
STATUS=$(git status --porcelain)
if [ -z "$STATUS" ]; then
    echo -e "\033[33m⚠️ Nothing to commit\033[0m"
    read -p "Press Enter to continue..."
    exit 0
fi

git commit -m "$COMMIT_MSG"
if [ $? -ne 0 ]; then
    echo -e "\033[31m❌ Commit failed\033[0m"
    read -p "Press Enter to continue..."
    exit 1
fi

echo -e "\033[36m🚀 Pushing to Gitea...\033[0m"
git push origin main
if [ $? -ne 0 ]; then
    echo -e "\033[31m❌ Push to Gitea failed\033[0m"
fi

echo -e "\033[36m🚀 Pushing to GitHub...\033[0m"
git push github main
if [ $? -ne 0 ]; then
    echo -e "\033[31m❌ Push to GitHub failed\033[0m"
fi

echo -e "\033[32m✅ Done!\033[0m"
