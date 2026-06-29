#!/bin/bash

# ci-hooks.sh - Continuous integration hooks for .agents
# Part of LCBP3-DMS Phase 3 enhancements

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

# CI configuration
CI_LOG_DIR="$AGENTS_DIR/logs/ci"
CI_REPORT_DIR="$AGENTS_DIR/reports/ci"

# Ensure directories exist
mkdir -p "$CI_LOG_DIR" "$CI_REPORT_DIR"

# Logging function
ci_log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_file="$CI_LOG_DIR/ci-$(date '+%Y-%m-%d').log"
    
    echo "[$timestamp] [$level] $message" | tee -a "$log_file"
    
    # Console output with colors
    case "$level" in
        "INFO")  echo -e "${BLUE}$message${NC}" ;;
        "PASS")  echo -e "${GREEN}$message${NC}" ;;
        "WARN")  echo -e "${YELLOW}$message${NC}" ;;
        "FAIL")  echo -e "${RED}$message${NC}" ;;
        *) echo "$message" ;;
    esac
}

# Pre-commit hook
pre_commit_hook() {
    ci_log "INFO" "Running pre-commit validation..."
    
    local exit_code=0
    
    # 1. Run version validation
    ci_log "INFO" "Checking version consistency..."
    if "$AGENTS_DIR/scripts/bash/validate-versions.sh" >> "$CI_LOG_DIR/pre-commit-versions.log" 2>&1; then
        ci_log "PASS" "Version validation passed"
    else
        ci_log "FAIL" "Version validation failed"
        exit_code=1
    fi
    
    # 2. Run skill audit
    ci_log "INFO" "Auditing skills..."
    if "$AGENTS_DIR/scripts/bash/audit-skills.sh" >> "$CI_LOG_DIR/pre-commit-skills.log" 2>&1; then
        ci_log "PASS" "Skill audit passed"
    else
        ci_log "FAIL" "Skill audit failed"
        exit_code=1
    fi
    
    # 3. Run integration tests (if Node.js available)
    if command -v node >/dev/null 2>&1; then
        ci_log "INFO" "Running integration tests..."
        if node "$AGENTS_DIR/tests/skill-integration.test.js" >> "$CI_LOG_DIR/pre-commit-tests.log" 2>&1; then
            ci_log "PASS" "Integration tests passed"
        else
            ci_log "WARN" "Integration tests failed (non-blocking)"
        fi
    else
        ci_log "WARN" "Node.js not available, skipping integration tests"
    fi
    
    # 4. Check for forbidden patterns
    ci_log "INFO" "Checking for forbidden patterns..."
    local forbidden_patterns=("TODO" "FIXME" "XXX" "HACK")
    local found_forbidden=false
    
    for pattern in "${forbidden_patterns[@]}"; do
        if grep -r "$pattern" "$AGENTS_DIR/skills" --include="*.md" >/dev/null 2>&1; then
            ci_log "WARN" "Found forbidden pattern: $pattern"
            found_forbidden=true
        fi
    done
    
    if [ "$found_forbidden" = false ]; then
        ci_log "PASS" "No forbidden patterns found"
    fi
    
    # Generate pre-commit report
    local report_file="$CI_REPORT_DIR/pre-commit-$(date '+%Y%m%d-%H%M%S').json"
    cat > "$report_file" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "hook_type": "pre-commit",
    "exit_code": $exit_code,
    "checks_performed": [
        "version_validation",
        "skill_audit", 
        "integration_tests",
        "forbidden_patterns"
    ],
    "log_files": [
        "pre-commit-versions.log",
        "pre-commit-skills.log",
        "pre-commit-tests.log"
    ]
}
EOF
    
    ci_log "INFO" "Pre-commit report saved to: $report_file"
    
    if [ $exit_code -eq 0 ]; then
        ci_log "PASS" "Pre-commit validation completed successfully"
    else
        ci_log "FAIL" "Pre-commit validation failed"
    fi
    
    return $exit_code
}

# Pre-push hook
pre_push_hook() {
    ci_log "INFO" "Running pre-push validation..."
    
    local exit_code=0
    
    # 1. Full health check
    ci_log "INFO" "Running full health check..."
    if command -v node >/dev/null 2>&1; then
        if node "$AGENTS_DIR/scripts/health-monitor.js" >> "$CI_LOG_DIR/pre-push-health.log" 2>&1; then
            ci_log "PASS" "Health check passed"
        else
            ci_log "FAIL" "Health check failed"
            exit_code=1
        fi
    else
        ci_log "WARN" "Node.js not available, using basic health check"
        if "$AGENTS_DIR/scripts/bash/audit-skills.sh" >> "$CI_LOG_DIR/pre-push-basic.log" 2>&1; then
            ci_log "PASS" "Basic health check passed"
        else
            ci_log "FAIL" "Basic health check failed"
            exit_code=1
        fi
    fi
    
    # 2. Advanced validation (if available)
    if command -v node >/dev/null 2>&1 && [ -f "$AGENTS_DIR/scripts/advanced-validator.js" ]; then
        ci_log "INFO" "Running advanced validation..."
        if node "$AGENTS_DIR/scripts/advanced-validator.js" >> "$CI_LOG_DIR/pre-push-advanced.log" 2>&1; then
            ci_log "PASS" "Advanced validation passed"
        else
            ci_log "WARN" "Advanced validation found issues (non-blocking)"
        fi
    fi
    
    # 3. Dependency validation
    if command -v node >/dev/null 2>&1 && [ -f "$AGENTS_DIR/scripts/dependency-validator.js" ]; then
        ci_log "INFO" "Running dependency validation..."
        if node "$AGENTS_DIR/scripts/dependency-validator.js" >> "$CI_LOG_DIR/pre-push-dependencies.log" 2>&1; then
            ci_log "PASS" "Dependency validation passed"
        else
            ci_log "WARN" "Dependency validation found issues (non-blocking)"
        fi
    fi
    
    # 4. Performance monitoring
    if command -v node >/dev/null 2>&1 && [ -f "$AGENTS_DIR/scripts/performance-monitor.js" ]; then
        ci_log "INFO" "Running performance monitoring..."
        if node "$AGENTS_DIR/scripts/performance-monitor.js" >> "$CI_LOG_DIR/pre-push-performance.log" 2>&1; then
            ci_log "PASS" "Performance monitoring passed"
        else
            ci_log "WARN" "Performance monitoring found issues (non-blocking)"
        fi
    fi
    
    # Generate pre-push report
    local report_file="$CI_REPORT_DIR/pre-push-$(date '+%Y%m%d-%H%M%S').json"
    cat > "$report_file" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "hook_type": "pre-push",
    "exit_code": $exit_code,
    "checks_performed": [
        "health_check",
        "advanced_validation",
        "dependency_validation",
        "performance_monitoring"
    ],
    "log_files": [
        "pre-push-health.log",
        "pre-push-advanced.log",
        "pre-push-dependencies.log",
        "pre-push-performance.log"
    ]
}
EOF
    
    ci_log "INFO" "Pre-push report saved to: $report_file"
    
    if [ $exit_code -eq 0 ]; then
        ci_log "PASS" "Pre-push validation completed successfully"
    else
        ci_log "FAIL" "Pre-push validation failed"
    fi
    
    return $exit_code
}

# CI pipeline hook
ci_pipeline_hook() {
    ci_log "INFO" "Running CI pipeline validation..."
    
    local exit_code=0
    local pipeline_start=$(date +%s)
    
    # Create pipeline workspace
    local workspace="$CI_REPORT_DIR/pipeline-$(date '+%Y%m%d-%H%M%S')"
    mkdir -p "$workspace"
    
    # 1. Environment validation
    ci_log "INFO" "Validating CI environment..."
    
    # Check required tools
    local required_tools=("node" "npm")
    for tool in "${required_tools[@]}"; do
        if command -v "$tool" >/dev/null 2>&1; then
            ci_log "PASS" "Tool available: $tool"
        else
            ci_log "FAIL" "Tool missing: $tool"
            exit_code=1
        fi
    done
    
    # Check Node.js modules
    if [ -f "$AGENTS_DIR/package.json" ]; then
        cd "$AGENTS_DIR"
        if npm list --depth=0 >/dev/null 2>&1; then
            ci_log "PASS" "Node.js dependencies installed"
        else
            ci_log "WARN" "Installing Node.js dependencies..."
            npm install >> "$workspace/npm-install.log" 2>&1 || {
                ci_log "FAIL" "Failed to install Node.js dependencies"
                exit_code=1
            }
        fi
        cd "$BASE_DIR"
    fi
    
    # 2. Full test suite
    ci_log "INFO" "Running full test suite..."
    
    # Integration tests
    if node "$AGENTS_DIR/tests/skill-integration.test.js" >> "$workspace/integration-tests.log" 2>&1; then
        ci_log "PASS" "Integration tests passed"
    else
        ci_log "FAIL" "Integration tests failed"
        exit_code=1
    fi
    
    # Workflow validation tests
    if node "$AGENTS_DIR/tests/workflow-validation.test.js" >> "$workspace/workflow-tests.log" 2>&1; then
        ci_log "PASS" "Workflow validation tests passed"
    else
        ci_log "FAIL" "Workflow validation tests failed"
        exit_code=1
    fi
    
    # 3. Comprehensive validation
    ci_log "INFO" "Running comprehensive validation..."
    
    # Health monitoring
    if node "$AGENTS_DIR/scripts/health-monitor.js" >> "$workspace/health-check.log" 2>&1; then
        ci_log "PASS" "Health monitoring passed"
    else
        ci_log "FAIL" "Health monitoring failed"
        exit_code=1
    fi
    
    # Advanced validation
    if node "$AGENTS_DIR/scripts/advanced-validator.js" >> "$workspace/advanced-validation.log" 2>&1; then
        ci_log "PASS" "Advanced validation passed"
    else
        ci_log "WARN" "Advanced validation found issues"
    fi
    
    # Dependency validation
    if node "$AGENTS_DIR/scripts/dependency-validator.js" >> "$workspace/dependency-validation.log" 2>&1; then
        ci_log "PASS" "Dependency validation passed"
    else
        ci_log "WARN" "Dependency validation found issues"
    fi
    
    # Performance monitoring
    if node "$AGENTS_DIR/scripts/performance-monitor.js" >> "$workspace/performance-monitor.log" 2>&1; then
        ci_log "PASS" "Performance monitoring passed"
    else
        ci_log "WARN" "Performance monitoring found issues"
    fi
    
    # 4. Generate artifacts
    ci_log "INFO" "Generating CI artifacts..."
    
    local pipeline_end=$(date +%s)
    local duration=$((pipeline_end - pipeline_start))
    
    # Consolidated report
    local report_file="$workspace/ci-pipeline-report.json"
    cat > "$report_file" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "pipeline_type": "full_ci",
    "duration_seconds": $duration,
    "exit_code": $exit_code,
    "environment": {
        "node_version": "$(node --version)",
        "platform": "$(uname -s)",
        "working_directory": "$BASE_DIR"
    },
    "checks_performed": [
        "environment_validation",
        "integration_tests",
        "workflow_validation_tests",
        "health_monitoring",
        "advanced_validation",
        "dependency_validation",
        "performance_monitoring"
    ],
    "artifacts": [
        "integration-tests.log",
        "workflow-tests.log",
        "health-check.log",
        "advanced-validation.log",
        "dependency-validation.log",
        "performance-monitor.log",
        "npm-install.log"
    ],
    "workspace": "$workspace"
}
EOF
    
    ci_log "INFO" "CI pipeline report saved to: $report_file"
    ci_log "INFO" "CI artifacts saved to: $workspace"
    ci_log "INFO" "Pipeline duration: ${duration}s"
    
    if [ $exit_code -eq 0 ]; then
        ci_log "PASS" "CI pipeline completed successfully"
    else
        ci_log "FAIL" "CI pipeline failed"
    fi
    
    return $exit_code
}

# Install Git hooks
install_git_hooks() {
    ci_log "INFO" "Installing Git hooks..."
    
    local hooks_dir="$BASE_DIR/.git/hooks"
    local agents_hooks_dir="$AGENTS_DIR/scripts/git-hooks"
    
    # Create git-hooks directory
    mkdir -p "$agents_hooks_dir"
    
    # Create pre-commit hook
    cat > "$agents_hooks_dir/pre-commit" << 'EOF'
#!/bin/bash
# Pre-commit hook for .agents validation
echo "Running .agents pre-commit validation..."
if bash .agents/scripts/ci-hooks.sh pre-commit; then
    echo "Pre-commit validation passed"
    exit 0
else
    echo "Pre-commit validation failed"
    exit 1
fi
EOF
    
    # Create pre-push hook
    cat > "$agents_hooks_dir/pre-push" << 'EOF'
#!/bin/bash
# Pre-push hook for .agents validation
echo "Running .agents pre-push validation..."
if bash .agents/scripts/ci-hooks.sh pre-push; then
    echo "Pre-push validation passed"
    exit 0
else
    echo "Pre-push validation failed"
    exit 1
fi
EOF
    
    # Make hooks executable
    chmod +x "$agents_hooks_dir/pre-commit"
    chmod +x "$agents_hooks_dir/pre-push"
    
    # Install hooks if .git directory exists
    if [ -d "$hooks_dir" ]; then
        cp "$agents_hooks_dir/pre-commit" "$hooks_dir/"
        cp "$agents_hooks_dir/pre-push" "$hooks_dir/"
        ci_log "PASS" "Git hooks installed successfully"
    else
        ci_log "WARN" "Git repository not found, hooks copied to .agents/scripts/git-hooks"
    fi
}

# Main function
main() {
    local command="${1:-help}"
    
    case "$command" in
        "pre-commit")
            pre_commit_hook
            ;;
        "pre-push")
            pre_push_hook
            ;;
        "ci-pipeline")
            ci_pipeline_hook
            ;;
        "install-hooks")
            install_git_hooks
            ;;
        "help"|*)
            echo "Usage: $0 {pre-commit|pre-push|ci-pipeline|install-hooks|help}"
            echo ""
            echo "Commands:"
            echo "  pre-commit    - Run pre-commit validation"
            echo "  pre-push      - Run pre-push validation"
            echo "  ci-pipeline   - Run full CI pipeline"
            echo "  install-hooks - Install Git hooks"
            echo "  help          - Show this help"
            ;;
    esac
}

# Run main function with all arguments
main "$@"
