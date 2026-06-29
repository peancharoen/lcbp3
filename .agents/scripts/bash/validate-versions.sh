#!/bin/bash

# validate-versions.sh - Check version consistency across .agents files
# Part of LCBP3-DMS Phase 2 improvements

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
AGENTS_DIR="$BASE_DIR/.agents"

# Expected version (should match LCBP3 version)
EXPECTED_VERSION="1.8.9"

echo "=== .agents Version Validation ==="
echo "Base directory: $BASE_DIR"
echo "Expected version: $EXPECTED_VERSION"
echo

# Function to extract version from file
extract_version() {
    local file="$1"
    local pattern="$2"

    if [[ -f "$file" ]]; then
        grep -o "$pattern" "$file" | head -1 | sed 's/.*\([0-9]\+\.[0-9]\+\.[0-9]\+\).*/\1/' || echo "NOT_FOUND"
    else
        echo "FILE_NOT_FOUND"
    fi
}

# Files to check
declare -A FILES_TO_CHECK=(
    ["$AGENTS_DIR/skills/VERSION"]="version: \([0-9]\+\.[0-9]\+\.[0-9]\+\)"
    ["$AGENTS_DIR/skills/skills.md"]="[Vv]\([0-9]\+\.[0-9]\+\.[0-9]\+\)"
)

# Track issues
ISSUES=0

echo "Checking version consistency..."
echo

for file in "${!FILES_TO_CHECK[@]}"; do
    pattern="${FILES_TO_CHECK[$file]}"
    relative_path="${file#$BASE_DIR/}"

    version=$(extract_version "$file" "$pattern")

    if [[ "$version" == "NOT_FOUND" ]] || [[ "$version" == "FILE_NOT_FOUND" ]]; then
        echo -e "${RED}  ERROR${NC}: $relative_path - Version not found"
        ((ISSUES++))
    elif [[ "$version" != "$EXPECTED_VERSION" ]]; then
        echo -e "${RED}  ERROR${NC}: $relative_path - Found v$version, expected v$EXPECTED_VERSION"
        ((ISSUES++))
    else
        echo -e "${GREEN}  OK${NC}: $relative_path - v$version"
    fi
done

echo

# Check for version mismatches in skill files
echo "Checking skill file versions..."
SKILL_VERSIONS_FILE="$AGENTS_DIR/skills/VERSION"
if [[ -f "$SKILL_VERSIONS_FILE" ]]; then
    skills_version=$(extract_version "$SKILL_VERSIONS_FILE" "version: \([0-9]\+\.[0-9]\+\.[0-9]\+\)")
    echo "Skills version file: v$skills_version"
fi

# Check workflow versions (in .windsurf/workflows)
WORKFLOWS_DIR="$BASE_DIR/.windsurf/workflows"
if [[ -d "$WORKFLOWS_DIR" ]]; then
    echo "Checking workflow files..."
    workflow_count=0
    for workflow in "$WORKFLOWS_DIR"/*.md; do
        if [[ -f "$workflow" ]]; then
            workflow_count=$((workflow_count + 1))
        fi
    done
    echo -e "${GREEN}  OK${NC}: Found $workflow_count workflow files"
else
    echo -e "${YELLOW}  WARNING${NC}: Workflows directory not found at $WORKFLOWS_DIR"
fi

echo

# Summary
if [[ $ISSUES -eq 0 ]]; then
    echo -e "${GREEN}=== SUCCESS: All versions consistent ===${NC}"
    exit 0
else
    echo -e "${RED}=== FAILED: $ISSUES version issues found ===${NC}"
    echo
    echo "To fix version issues:"
    echo "1. Update files to use v$EXPECTED_VERSION"
    echo "2. Ensure LCBP3 project version matches"
    echo "3. Run this script again to verify"
    exit 1
fi
