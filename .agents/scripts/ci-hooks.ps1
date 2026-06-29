# ci-hooks.ps1 - Continuous integration hooks for .agents (PowerShell version)
# Part of LCBP3-DMS Phase 3 enhancements

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("pre-commit", "pre-push", "ci-pipeline", "install-hooks", "help")]
    [string]$Command = "help"
)

# Configuration
$BaseDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$AgentsDir = Join-Path $BaseDir ".agents"
$CILogDir = Join-Path $AgentsDir "logs\ci"
$CIReportDir = Join-Path $AgentsDir "reports\ci"

# Ensure directories exist
if (-not (Test-Path $CILogDir)) { New-Item -ItemType Directory -Path $CILogDir -Force | Out-Null }
if (-not (Test-Path $CIReportDir)) { New-Item -ItemType Directory -Path $CIReportDir -Force | Out-Null }

# Colors for output
$Colors = @{
    Red = "`e[0;31m"
    Green = "`e[0;32m"
    Yellow = "`e[1;33m"
    Blue = "`e[0;34m"
    NoColor = "`e[0m"
}

# Logging function
function Write-CILog {
    param(
        [string]$Level,
        [string]$Message
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logFile = Join-Path $CILogDir "ci-$(Get-Date -Format 'yyyy-MM-dd').log"
    "$timestamp [$Level] $Message" | Out-File -FilePath $logFile -Append
    
    # Console output with colors
    switch ($Level) {
        "INFO"  { Write-Host $Message -ForegroundColor $Colors.Blue }
        "PASS"  { Write-Host $Message -ForegroundColor $Colors.Green }
        "WARN"  { Write-Host $Message -ForegroundColor $Colors.Yellow }
        "FAIL"  { Write-Host $Message -ForegroundColor $Colors.Red }
        default { Write-Host $Message }
    }
}

# Pre-commit hook
function Invoke-PreCommitHook {
    Write-CILog "INFO" "Running pre-commit validation..."
    
    $exitCode = 0
    
    # 1. Run version validation
    Write-CILog "INFO" "Checking version consistency..."
    $versionScript = Join-Path $AgentsDir "scripts\powershell\validate-versions.ps1"
    if (Test-Path $versionScript) {
        try {
            & $versionScript | Out-File -FilePath (Join-Path $CILogDir "pre-commit-versions.log") -Append
            Write-CILog "PASS" "Version validation passed"
        } catch {
            Write-CILog "FAIL" "Version validation failed"
            $exitCode = 1
        }
    } else {
        Write-CILog "WARN" "Version validation script not found"
    }
    
    # 2. Run skill audit
    Write-CILog "INFO" "Auditing skills..."
    $auditScript = Join-Path $AgentsDir "scripts\powershell\audit-skills.ps1"
    if (Test-Path $auditScript) {
        try {
            & $auditScript | Out-File -FilePath (Join-Path $CILogDir "pre-commit-skills.log") -Append
            Write-CILog "PASS" "Skill audit passed"
        } catch {
            Write-CILog "FAIL" "Skill audit failed"
            $exitCode = 1
        }
    } else {
        Write-CILog "WARN" "Skill audit script not found"
    }
    
    # 3. Run integration tests (if Node.js available)
    if (Get-Command node -ErrorAction SilentlyContinue) {
        Write-CILog "INFO" "Running integration tests..."
        $testScript = Join-Path $AgentsDir "tests\skill-integration.test.js"
        if (Test-Path $testScript) {
            try {
                node $testScript | Out-File -FilePath (Join-Path $CILogDir "pre-commit-tests.log") -Append
                Write-CILog "PASS" "Integration tests passed"
            } catch {
                Write-CILog "WARN" "Integration tests failed (non-blocking)"
            }
        } else {
            Write-CILog "WARN" "Integration test script not found"
        }
    } else {
        Write-CILog "WARN" "Node.js not available, skipping integration tests"
    }
    
    # 4. Check for forbidden patterns
    Write-CILog "INFO" "Checking for forbidden patterns..."
    $forbiddenPatterns = @("TODO", "FIXME", "XXX", "HACK")
    $foundForbidden = $false
    
    foreach ($pattern in $forbiddenPatterns) {
        $skillsDir = Join-Path $AgentsDir "skills"
        if (Test-Path $skillsDir) {
            $matches = Select-String -Path $skillsDir\*.md -Pattern $pattern -Recurse
            if ($matches) {
                Write-CILog "WARN" "Found forbidden pattern: $pattern"
                $foundForbidden = $true
            }
        }
    }
    
    if (-not $foundForbidden) {
        Write-CILog "PASS" "No forbidden patterns found"
    }
    
    # Generate pre-commit report
    $reportFile = Join-Path $CIReportDir "pre-commit-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    $report = @{
        timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz")
        hook_type = "pre-commit"
        exit_code = $exitCode
        checks_performed = @(
            "version_validation",
            "skill_audit", 
            "integration_tests",
            "forbidden_patterns"
        )
        log_files = @(
            "pre-commit-versions.log",
            "pre-commit-skills.log",
            "pre-commit-tests.log"
        )
    }
    $report | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportFile
    
    Write-CILog "INFO" "Pre-commit report saved to: $reportFile"
    
    if ($exitCode -eq 0) {
        Write-CILog "PASS" "Pre-commit validation completed successfully"
    } else {
        Write-CILog "FAIL" "Pre-commit validation failed"
    }
    
    return $exitCode
}

# Pre-push hook
function Invoke-PrePushHook {
    Write-CILog "INFO" "Running pre-push validation..."
    
    $exitCode = 0
    
    # 1. Full health check
    Write-CILog "INFO" "Running full health check..."
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $healthScript = Join-Path $AgentsDir "scripts\health-monitor.js"
        if (Test-Path $healthScript) {
            try {
                node $healthScript | Out-File -FilePath (Join-Path $CILogDir "pre-push-health.log") -Append
                Write-CILog "PASS" "Health check passed"
            } catch {
                Write-CILog "FAIL" "Health check failed"
                $exitCode = 1
            }
        } else {
            Write-CILog "WARN" "Health monitor script not found"
        }
    } else {
        Write-CILog "WARN" "Node.js not available, using basic health check"
        $auditScript = Join-Path $AgentsDir "scripts\powershell\audit-skills.ps1"
        if (Test-Path $auditScript) {
            try {
                & $auditScript | Out-File -FilePath (Join-Path $CILogDir "pre-push-basic.log") -Append
                Write-CILog "PASS" "Basic health check passed"
            } catch {
                Write-CILog "FAIL" "Basic health check failed"
                $exitCode = 1
            }
        }
    }
    
    # 2. Advanced validation (if available)
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $advancedScript = Join-Path $AgentsDir "scripts\advanced-validator.js"
        if (Test-Path $advancedScript) {
            Write-CILog "INFO" "Running advanced validation..."
            try {
                node $advancedScript | Out-File -FilePath (Join-Path $CILogDir "pre-push-advanced.log") -Append
                Write-CILog "PASS" "Advanced validation passed"
            } catch {
                Write-CILog "WARN" "Advanced validation found issues (non-blocking)"
            }
        }
    }
    
    # 3. Dependency validation
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $dependencyScript = Join-Path $AgentsDir "scripts\dependency-validator.js"
        if (Test-Path $dependencyScript) {
            Write-CILog "INFO" "Running dependency validation..."
            try {
                node $dependencyScript | Out-File -FilePath (Join-Path $CILogDir "pre-push-dependencies.log") -Append
                Write-CILog "PASS" "Dependency validation passed"
            } catch {
                Write-CILog "WARN" "Dependency validation found issues (non-blocking)"
            }
        }
    }
    
    # 4. Performance monitoring
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $performanceScript = Join-Path $AgentsDir "scripts\performance-monitor.js"
        if (Test-Path $performanceScript) {
            Write-CILog "INFO" "Running performance monitoring..."
            try {
                node $performanceScript | Out-File -FilePath (Join-Path $CILogDir "pre-push-performance.log") -Append
                Write-CILog "PASS" "Performance monitoring passed"
            } catch {
                Write-CILog "WARN" "Performance monitoring found issues (non-blocking)"
            }
        }
    }
    
    # Generate pre-push report
    $reportFile = Join-Path $CIReportDir "pre-push-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    $report = @{
        timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz")
        hook_type = "pre-push"
        exit_code = $exitCode
        checks_performed = @(
            "health_check",
            "advanced_validation",
            "dependency_validation",
            "performance_monitoring"
        )
        log_files = @(
            "pre-push-health.log",
            "pre-push-advanced.log",
            "pre-push-dependencies.log",
            "pre-push-performance.log"
        )
    }
    $report | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportFile
    
    Write-CILog "INFO" "Pre-push report saved to: $reportFile"
    
    if ($exitCode -eq 0) {
        Write-CILog "PASS" "Pre-push validation completed successfully"
    } else {
        Write-CILog "FAIL" "Pre-push validation failed"
    }
    
    return $exitCode
}

# CI pipeline hook
function Invoke-CIPipelineHook {
    Write-CILog "INFO" "Running CI pipeline validation..."
    
    $exitCode = 0
    $pipelineStart = Get-Date
    
    # Create pipeline workspace
    $workspace = Join-Path $CIReportDir "pipeline-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    New-Item -ItemType Directory -Path $workspace -Force | Out-Null
    
    # 1. Environment validation
    Write-CILog "INFO" "Validating CI environment..."
    
    # Check required tools
    $requiredTools = @("node", "npm")
    foreach ($tool in $requiredTools) {
        if (Get-Command $tool -ErrorAction SilentlyContinue) {
            Write-CILog "PASS" "Tool available: $tool"
        } else {
            Write-CILog "FAIL" "Tool missing: $tool"
            $exitCode = 1
        }
    }
    
    # Check Node.js modules
    $packageJson = Join-Path $AgentsDir "package.json"
    if (Test-Path $packageJson) {
        Push-Location $AgentsDir
        try {
            npm list --depth=0 | Out-Null
            Write-CILog "PASS" "Node.js dependencies installed"
        } catch {
            Write-CILog "WARN" "Installing Node.js dependencies..."
            npm install | Out-File -FilePath (Join-Path $workspace "npm-install.log")
            if ($LASTEXITCODE -ne 0) {
                Write-CILog "FAIL" "Failed to install Node.js dependencies"
                $exitCode = 1
            }
        }
        Pop-Location
    }
    
    # 2. Full test suite
    Write-CILog "INFO" "Running full test suite..."
    
    # Integration tests
    $integrationTest = Join-Path $AgentsDir "tests\skill-integration.test.js"
    if (Test-Path $integrationTest) {
        try {
            node $integrationTest | Out-File -FilePath (Join-Path $workspace "integration-tests.log")
            Write-CILog "PASS" "Integration tests passed"
        } catch {
            Write-CILog "FAIL" "Integration tests failed"
            $exitCode = 1
        }
    }
    
    # Workflow validation tests
    $workflowTest = Join-Path $AgentsDir "tests\workflow-validation.test.js"
    if (Test-Path $workflowTest) {
        try {
            node $workflowTest | Out-File -FilePath (Join-Path $workspace "workflow-tests.log")
            Write-CILog "PASS" "Workflow validation tests passed"
        } catch {
            Write-CILog "FAIL" "Workflow validation tests failed"
            $exitCode = 1
        }
    }
    
    # 3. Comprehensive validation
    Write-CILog "INFO" "Running comprehensive validation..."
    
    # Health monitoring
    $healthScript = Join-Path $AgentsDir "scripts\health-monitor.js"
    if (Test-Path $healthScript) {
        try {
            node $healthScript | Out-File -FilePath (Join-Path $workspace "health-check.log")
            Write-CILog "PASS" "Health monitoring passed"
        } catch {
            Write-CILog "FAIL" "Health monitoring failed"
            $exitCode = 1
        }
    }
    
    # Advanced validation
    $advancedScript = Join-Path $AgentsDir "scripts\advanced-validator.js"
    if (Test-Path $advancedScript) {
        try {
            node $advancedScript | Out-File -FilePath (Join-Path $workspace "advanced-validation.log")
            Write-CILog "PASS" "Advanced validation passed"
        } catch {
            Write-CILog "WARN" "Advanced validation found issues"
        }
    }
    
    # Dependency validation
    $dependencyScript = Join-Path $AgentsDir "scripts\dependency-validator.js"
    if (Test-Path $dependencyScript) {
        try {
            node $dependencyScript | Out-File -FilePath (Join-Path $workspace "dependency-validation.log")
            Write-CILog "PASS" "Dependency validation passed"
        } catch {
            Write-CILog "WARN" "Dependency validation found issues"
        }
    }
    
    # Performance monitoring
    $performanceScript = Join-Path $AgentsDir "scripts\performance-monitor.js"
    if (Test-Path $performanceScript) {
        try {
            node $performanceScript | Out-File -FilePath (Join-Path $workspace "performance-monitor.log")
            Write-CILog "PASS" "Performance monitoring passed"
        } catch {
            Write-CILog "WARN" "Performance monitoring found issues"
        }
    }
    
    # 4. Generate artifacts
    Write-CILog "INFO" "Generating CI artifacts..."
    
    $pipelineEnd = Get-Date
    $duration = ($pipelineEnd - $pipelineStart).TotalSeconds
    
    # Consolidated report
    $reportFile = Join-Path $workspace "ci-pipeline-report.json"
    $report = @{
        timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz")
        pipeline_type = "full_ci"
        duration_seconds = [int]$duration
        exit_code = $exitCode
        environment = @{
            node_version = (node --version)
            platform = $env:OS
            working_directory = $BaseDir
        }
        checks_performed = @(
            "environment_validation",
            "integration_tests",
            "workflow_validation_tests",
            "health_monitoring",
            "advanced_validation",
            "dependency_validation",
            "performance_monitoring"
        )
        artifacts = @(
            "integration-tests.log",
            "workflow-tests.log",
            "health-check.log",
            "advanced-validation.log",
            "dependency-validation.log",
            "performance-monitor.log",
            "npm-install.log"
        )
        workspace = $workspace
    }
    $report | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportFile
    
    Write-CILog "INFO" "CI pipeline report saved to: $reportFile"
    Write-CILog "INFO" "CI artifacts saved to: $workspace"
    Write-CILog "INFO" "Pipeline duration: $([int]$duration)s"
    
    if ($exitCode -eq 0) {
        Write-CILog "PASS" "CI pipeline completed successfully"
    } else {
        Write-CILog "FAIL" "CI pipeline failed"
    }
    
    return $exitCode
}

# Install Git hooks
function Install-GitHooks {
    Write-CILog "INFO" "Installing Git hooks..."
    
    $hooksDir = Join-Path $BaseDir ".git\hooks"
    $agentsHooksDir = Join-Path $AgentsDir "scripts\git-hooks"
    
    # Create git-hooks directory
    if (-not (Test-Path $agentsHooksDir)) {
        New-Item -ItemType Directory -Path $agentsHooksDir -Force | Out-Null
    }
    
    # Create pre-commit hook
    $preCommitContent = @'
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
'@
    $preCommitContent | Out-File -FilePath (Join-Path $agentsHooksDir "pre-commit") -Encoding UTF8
    
    # Create pre-push hook
    $prePushContent = @'
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
'@
    $prePushContent | Out-File -FilePath (Join-Path $agentsHooksDir "pre-push") -Encoding UTF8
    
    # Install hooks if .git directory exists
    if (Test-Path $hooksDir) {
        Copy-Item (Join-Path $agentsHooksDir "pre-commit") $hooksDir -Force
        Copy-Item (Join-Path $agentsHooksDir "pre-push") $hooksDir -Force
        Write-CILog "PASS" "Git hooks installed successfully"
    } else {
        Write-CILog "WARN" "Git repository not found, hooks copied to .agents\scripts\git-hooks"
    }
}

# Main execution
switch ($Command) {
    "pre-commit" {
        exit (Invoke-PreCommitHook)
    }
    "pre-push" {
        exit (Invoke-PrePushHook)
    }
    "ci-pipeline" {
        exit (Invoke-CIPipelineHook)
    }
    "install-hooks" {
        Install-GitHooks
    }
    "help" {
        Write-Host "Usage: .\ci-hooks.ps1 -Command {pre-commit|pre-push|ci-pipeline|install-hooks|help}"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  pre-commit    - Run pre-commit validation"
        Write-Host "  pre-push      - Run pre-push validation"
        Write-Host "  ci-pipeline   - Run full CI pipeline"
        Write-Host "  install-hooks - Install Git hooks"
        Write-Host "  help          - Show this help"
    }
    default {
        Write-Host "Unknown command: $Command"
        Write-Host "Use 'help' to see available commands"
        exit 1
    }
}
