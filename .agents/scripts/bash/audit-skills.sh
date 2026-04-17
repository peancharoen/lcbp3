#!/bin/bash

# audit-skills.sh - Verify skill completeness and health
# Part of LCBP3-DMS Phase 2 improvements

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AGENTS_DIR="$BASE_DIR/.agents"
SKILLS_DIR="$AGENTS_DIR/skills"

echo "=== Skills Health Audit ==="
echo "Base directory: $BASE_DIR"
echo

# Function to check if skill has required files
check_skill_health() {
    local skill_dir="$1"
    local skill_name="$(basename "$skill_dir")"
    
    local issues=0
    
    # Check for SKILL.md
    if [[ -f "$skill_dir/SKILL.md" ]]; then
        echo -e "${GREEN}  OK${NC}: $skill_name/SKILL.md"
    else
        echo -e "${RED}  MISSING${NC}: $skill_name/SKILL.md"
        ((issues++))
    fi
    
    # Check for templates directory (optional)
    if [[ -d "$skill_dir/templates" ]]; then
        template_count=$(find "$skill_dir/templates" -name "*.md" -type f | wc -l)
        if [[ $template_count -gt 0 ]]; then
            echo -e "${GREEN}  OK${NC}: $skill_name/templates ($template_count files)"
        else
            echo -e "${YELLOW}  EMPTY${NC}: $skill_name/templates (no files)"
        fi
    fi
    
    # Check SKILL.md content if exists
    local skill_file="$skill_dir/SKILL.md"
    if [[ -f "$skill_file" ]]; then
        # Check for required front matter fields
        local required_fields=("name" "description" "version")
        for field in "${required_fields[@]}"; do
            if grep -q "^$field:" "$skill_file"; then
                echo -e "    ${GREEN}  FIELD${NC}: $field"
            else
                echo -e "    ${RED}  MISSING FIELD${NC}: $field"
                ((issues++))
            fi
        done
        
        # Check for Role section
        if grep -q "^## Role$" "$skill_file"; then
            echo -e "    ${GREEN}  SECTION${NC}: Role"
        else
            echo -e "    ${YELLOW}  MISSING SECTION${NC}: Role"
            ((issues++))
        fi
        
        # Check for Task section
        if grep -q "^## Task$" "$skill_file"; then
            echo -e "    ${GREEN}  SECTION${NC}: Task"
        else
            echo -e "    ${YELLOW}  MISSING SECTION${NC}: Task"
            ((issues++))
        fi
    fi
    
    return $issues
}

# Function to get skill version from SKILL.md
get_skill_version() {
    local skill_file="$1"
    if [[ -f "$skill_file" ]]; then
        grep "^version:" "$skill_file" | head -1 | sed 's/version: *//' || echo "unknown"
    else
        echo "no_file"
    fi
}

# Check skills directory
if [[ ! -d "$SKILLS_DIR" ]]; then
    echo -e "${RED}ERROR: Skills directory not found${NC}"
    exit 1
fi

echo "Scanning skills directory: $SKILLS_DIR"
echo

# Get all skill directories
SKILL_DIRS=()
while IFS= read -r -d '' dir; do
    SKILL_DIRS+=("$dir")
done < <(find "$SKILLS_DIR" -maxdepth 1 -type d -not -path "$SKILLS_DIR" -print0 | sort -z)

echo "Found ${#SKILL_DIRS[@]} skill directories"
echo

# Audit each skill
TOTAL_ISSUES=0
SKILL_SUMMARY=()

for skill_dir in "${SKILL_DIRS[@]}"; do
    skill_name="$(basename "$skill_dir")"
    echo "Auditing: $skill_name"
    echo "------------------------"
    
    check_skill_health "$skill_dir"
    issues=$?
    
    skill_version=$(get_skill_version "$skill_dir/SKILL.md")
    SKILL_SUMMARY+=("$skill_name:$issues:$skill_version")
    
    TOTAL_ISSUES=$((TOTAL_ISSUES + issues))
    echo
done

# Summary report
echo "=== Skills Audit Summary ==="
echo

echo "Skill Status:"
echo "-----------"
for summary in "${SKILL_SUMMARY[@]}"; do
    IFS=':' read -r name issues version <<< "$summary"
    if [[ $issues -eq 0 ]]; then
        echo -e "${GREEN}  HEALTHY${NC}: $name (v$version)"
    else
        echo -e "${RED}  ISSUES${NC}: $name (v$version) - $issues issues"
    fi
done

echo

# Check skills.md version consistency
SKILLS_VERSION_FILE="$SKILLS_DIR/VERSION"
if [[ -f "$SKILLS_VERSION_FILE" ]]; then
    global_version=$(grep "^version:" "$SKILLS_VERSION_FILE" | sed 's/version: *//')
    echo "Global skills version: v$global_version"
    echo
    
    # Check for version mismatches
    echo "Version Consistency Check:"
    echo "------------------------"
    VERSION_MISMATCHES=0
    
    for summary in "${SKILL_SUMMARY[@]}"; do
        IFS=':' read -r name issues version <<< "$summary"
        if [[ "$version" != "unknown" && "$version" != "no_file" && "$version" != "$global_version" ]]; then
            echo -e "${YELLOW}  MISMATCH${NC}: $name is v$version, global is v$global_version"
            ((VERSION_MISMATCHES++))
        fi
    done
    
    if [[ $VERSION_MISMATCHES -eq 0 ]]; then
        echo -e "${GREEN}  All skills match global version${NC}"
    fi
fi

echo

# Overall health
if [[ $TOTAL_ISSUES -eq 0 ]]; then
    echo -e "${GREEN}=== SUCCESS: All skills healthy ===${NC}"
    echo "Total skills: ${#SKILL_DIRS[@]}"
    exit 0
else
    echo -e "${RED}=== ISSUES FOUND: $TOTAL_ISSUES total issues ===${NC}"
    echo
    echo "Recommendations:"
    echo "1. Fix missing SKILL.md files"
    echo "2. Add required front matter fields"
    echo "3. Ensure Role and Task sections exist"
    echo "4. Align skill versions with global version"
    exit 1
fi
