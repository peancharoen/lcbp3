#!/bin/bash

# sync-workflows.sh - Sync workflow references between .agents and .windsurf
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
WINDSURF_DIR="$BASE_DIR/.windsurf"
WORKFLOWS_DIR="$WINDSURF_DIR/workflows"

echo "=== Workflow Synchronization Check ==="
echo "Base directory: $BASE_DIR"
echo

# Function to check if workflow exists
check_workflow() {
    local workflow_name="$1"
    local workflow_file="$WORKFLOWS_DIR/$workflow_name"
    
    if [[ -f "$workflow_file" ]]; then
        echo -e "${GREEN}  EXISTS${NC}: $workflow_name"
        return 0
    else
        echo -e "${RED}  MISSING${NC}: $workflow_name"
        return 1
    fi
}

# Function to list all workflows
list_workflows() {
    if [[ -d "$WORKFLOWS_DIR" ]]; then
        find "$WORKFLOWS_DIR" -name "*.md" -type f | sort
    else
        echo "No workflows directory found"
    fi
}

# Check directories
echo "Checking directory structure..."
if [[ -d "$AGENTS_DIR" ]]; then
    echo -e "${GREEN}  OK${NC}: .agents directory exists"
else
    echo -e "${RED}  ERROR${NC}: .agents directory not found"
    exit 1
fi

if [[ -d "$WINDSURF_DIR" ]]; then
    echo -e "${GREEN}  OK${NC}: .windsurf directory exists"
else
    echo -e "${RED}  ERROR${NC}: .windsurf directory not found"
    exit 1
fi

if [[ -d "$WORKFLOWS_DIR" ]]; then
    echo -e "${GREEN}  OK${NC}: workflows directory exists"
else
    echo -e "${RED}  ERROR${NC}: workflows directory not found"
    exit 1
fi

echo

# Expected workflows based on README documentation
echo "Checking expected workflows..."
EXPECTED_WORKFLOWS=(
    "00-speckit.all.md"
    "01-speckit.constitution.md"
    "02-speckit.specify.md"
    "03-speckit.clarify.md"
    "04-speckit.plan.md"
    "05-speckit.tasks.md"
    "06-speckit.analyze.md"
    "07-speckit.implement.md"
    "08-speckit.checker.md"
    "09-speckit.tester.md"
    "10-speckit.reviewer.md"
    "11-speckit.validate.md"
    "speckit.prepare.md"
    "schema-change.md"
    "create-backend-module.md"
    "create-frontend-page.md"
    "deploy.md"
    "review.md"
    "util-speckit.checklist.md"
    "util-speckit.diff.md"
    "util-speckit.migrate.md"
    "util-speckit.quizme.md"
    "util-speckit.status.md"
    "util-speckit.taskstoissues.md"
)

MISSING_WORKFLOWS=0

for workflow in "${EXPECTED_WORKFLOWS[@]}"; do
    if ! check_workflow "$workflow"; then
        ((MISSING_WORKFLOWS++))
    fi
done

echo

# List all actual workflows
echo "All workflows in $WORKFLOWS_DIR:"
echo "--------------------------------"
while IFS= read -r workflow; do
    echo "  $(basename "$workflow")"
done < <(list_workflows)

echo

# Check for orphaned workflows (unexpected ones)
echo "Checking for unexpected workflows..."
ACTUAL_WORKFLOWS=()
while IFS= read -r workflow; do
    ACTUAL_WORKFLOWS+=("$(basename "$workflow")")
done < <(list_workflows)

for actual_workflow in "${ACTUAL_WORKFLOWS[@]}"; do
    if [[ ! " ${EXPECTED_WORKFLOWS[*]} " =~ " ${actual_workflow} " ]]; then
        echo -e "${YELLOW}  UNEXPECTED${NC}: $actual_workflow"
    fi
done

echo

# Summary
if [[ $MISSING_WORKFLOWS -eq 0 ]]; then
    echo -e "${GREEN}=== SUCCESS: All expected workflows present ===${NC}"
    echo "Total workflows: ${#ACTUAL_WORKFLOWS[@]}"
    exit 0
else
    echo -e "${RED}=== FAILED: $MISSING_WORKFLOWS workflows missing ===${NC}"
    echo
    echo "To fix missing workflows:"
    echo "1. Create missing workflow files in $WORKFLOWS_DIR"
    echo "2. Use existing workflows as templates"
    echo "3. Run this script again to verify"
    exit 1
fi
