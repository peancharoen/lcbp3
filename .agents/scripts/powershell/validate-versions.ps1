# validate-versions.ps1 - Check version consistency across .agents files
# Part of LCBP3-DMS Phase 2 improvements

param(
    [string]$BaseDir = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
    [string]$ExpectedVersion = "1.8.6"
)

# Colors for output
$Colors = @{
    Red = "`e[0;31m"
    Green = "`e[0;32m"
    Yellow = "`e[1;33m"
    NoColor = "`e[0m"
}

$AgentsDir = Join-Path $BaseDir ".agents"

Write-Host "=== .agents Version Validation ===" -ForegroundColor Cyan
Write-Host "Base directory: $BaseDir"
Write-Host "Expected version: $ExpectedVersion"
Write-Host ""

# Function to extract version from file
function Get-VersionFromFile {
    param(
        [string]$FilePath,
        [string]$Pattern
    )
    
    if (Test-Path $FilePath) {
        try {
            $content = Get-Content $FilePath -Raw
            if ($content -match $Pattern) {
                return $matches[1]
            } else {
                return "NOT_FOUND"
            }
        } catch {
            return "ERROR"
        }
    } else {
        return "FILE_NOT_FOUND"
    }
}

# Files to check
$FilesToCheck = @{
    (Join-Path $AgentsDir "README.md") = "Version: ([0-9]+\.[0-9]+\.[0-9]+)"
    (Join-Path $AgentsDir "skills\VERSION") = "version: ([0-9]+\.[0-9]+\.[0-9]+)"
    (Join-Path $AgentsDir "rules\00-project-context.md") = "Version: ([0-9]+\.[0-9]+\.[0-9]+)"
    (Join-Path $AgentsDir "skills\skills.md") = "V([0-9]+\.[0-9]+\.[0-9]+)"
}

# Track issues
$Issues = 0

Write-Host "Checking version consistency..."
Write-Host ""

foreach ($file in $FilesToCheck.Keys) {
    $pattern = $FilesToCheck[$file]
    $relativePath = $file.Replace($BaseDir + "\", "")
    
    $version = Get-VersionFromFile -FilePath $file -Pattern $pattern
    
    if ($version -eq "NOT_FOUND" -or $version -eq "FILE_NOT_FOUND") {
        Write-Host "  ERROR: $relativePath - Version not found" -ForegroundColor $Colors.Red
        $Issues++
    } elseif ($version -ne $ExpectedVersion) {
        Write-Host "  ERROR: $relativePath - Found v$version, expected v$ExpectedVersion" -ForegroundColor $Colors.Red
        $Issues++
    } else {
        Write-Host "  OK: $relativePath - v$version" -ForegroundColor $Colors.Green
    }
}

Write-Host ""

# Check for version mismatches in skill files
Write-Host "Checking skill file versions..."
$SkillsVersionFile = Join-Path $AgentsDir "skills\VERSION"
if (Test-Path $SkillsVersionFile) {
    $skillsVersion = Get-VersionFromFile -FilePath $SkillsVersionFile -Pattern "version: ([0-9]+\.[0-9]+\.[0-9]+)"
    Write-Host "Skills version file: v$skillsVersion"
}

# Check workflow versions (in .windsurf\workflows)
$WorkflowsDir = Join-Path $BaseDir ".windsurf\workflows"
if (Test-Path $WorkflowsDir) {
    Write-Host "Checking workflow files..."
    $workflowCount = (Get-ChildItem -Path $WorkflowsDir -Filter "*.md" -File | Measure-Object).Count
    Write-Host "  OK: Found $workflowCount workflow files" -ForegroundColor $Colors.Green
} else {
    Write-Host "  WARNING: Workflows directory not found at $WorkflowsDir" -ForegroundColor $Colors.Yellow
}

Write-Host ""

# Summary
if ($Issues -eq 0) {
    Write-Host "=== SUCCESS: All versions consistent ===" -ForegroundColor $Colors.Green
    exit 0
} else {
    Write-Host "=== FAILED: $Issues version issues found ===" -ForegroundColor $Colors.Red
    Write-Host ""
    Write-Host "To fix version issues:"
    Write-Host "1. Update files to use v$ExpectedVersion"
    Write-Host "2. Ensure LCBP3 project version matches"
    Write-Host "3. Run this script again to verify"
    exit 1
}
