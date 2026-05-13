#!/bin/bash
# File: scripts/sync-agent-configs.sh
# Change Log:
# - 2026-05-13: Initial script to sync .agents to .windsurf

echo "🚀 Syncing .agents to .windsurf (v1.9.0)..."

AGENTS_DIR="./.agents"
WINDSURF_DIR="./.windsurf"

# 1. Sync Rules (with YAML header)
echo "📂 Syncing Rules..."
mkdir -p "$WINDSURF_DIR/rules"

for file in "$AGENTS_DIR/rules/"*.md; do
    filename=$(basename "$file")
    dest_file="$WINDSURF_DIR/rules/$filename"
    
    # Read first line
    first_line=$(head -n 1 "$file")
    
    if [ "$first_line" != "---" ]; then
        echo -e "---\ntrigger: always_on\n---\n" > "$dest_file"
        cat "$file" >> "$dest_file"
    else
        cat "$file" > "$dest_file"
    fi
done

# 2. Sync Workflows
echo "📂 Syncing Workflows..."
mkdir -p "$WINDSURF_DIR/workflows"
cp -r "$AGENTS_DIR/workflows/"* "$WINDSURF_DIR/workflows/"

# 3. Sync Skills
echo "📂 Syncing Skills..."
mkdir -p "$WINDSURF_DIR/skills"
cp -r "$AGENTS_DIR/skills/"* "$WINDSURF_DIR/skills/"

echo "✅ Sync Complete!"
