# audit-skills.ps1 - Verify skill completeness and health
# Part of LCBP3-DMS Phase 2 improvements

param(
    [string]$BaseDir = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
)

# Colors for output
$Colors = @{
    Red = "`e[0;31m"
    Green = "`e[0;32m"
    Yellow = "`e[1;33m"
    Blue = "`e[0;34m"
    NoColor = "`e[0m"
}

$AgentsDir = Join-Path $BaseDir ".agents"
$SkillsDir = Join-Path $AgentsDir "skills"

Write-Host "=== Skills Health Audit ===" -ForegroundColor Cyan
Write-Host "Base directory: $BaseDir"
Write-Host ""

# Function to check if skill has required files
function Test-SkillHealth {
    param(
        [string]$SkillDir
    )
    
    $skillName = Split-Path $SkillDir -Leaf
    $issues = 0
    
    # Check for SKILL.md
    $skillFile = Join-Path $SkillDir "SKILL.md"
    if (Test-Path $skillFile) {
        Write-Host "  OK: $skillName/SKILL.md" -ForegroundColor $Colors.Green
    } else {
        Write-Host "  MISSING: $skillName/SKILL.md" -ForegroundColor $Colors.Red
        $issues++
    }
    
    # Check for templates directory (optional)
    $templatesDir = Join-Path $SkillDir "templates"
    if (Test-Path $templatesDir) {
        $templateCount = (Get-ChildItem -Path $templatesDir -Filter "*.md" -File | Measure-Object).Count
        if ($templateCount -gt 0) {
            Write-Host "  OK: $skillName/templates ($templateCount files)" -ForegroundColor $Colors.Green
        } else {
            Write-Host "  EMPTY: $skillName/templates (no files)" -ForegroundColor $Colors.Yellow
        }
    }
    
    # Check SKILL.md content if exists
    if (Test-Path $skillFile) {
        $content = Get-Content $skillFile -Raw
        
        # Check for required front matter fields
        $requiredFields = @("name", "description", "version")
        foreach ($field in $requiredFields) {
            if ($content -match "^$field:") {
                Write-Host "    FIELD: $field" -ForegroundColor $Colors.Green
            } else {
                Write-Host "    MISSING FIELD: $field" -ForegroundColor $Colors.Red
                $issues++
            }
        }
        
        # Check for Role section
        if ($content -match "^## Role$") {
            Write-Host "    SECTION: Role" -ForegroundColor $Colors.Green
        } else {
            Write-Host "    MISSING SECTION: Role" -ForegroundColor $Colors.Yellow
            $issues++
        }
        
        # Check for Task section
        if ($content -match "^## Task$") {
            Write-Host "    SECTION: Task" -ForegroundColor $Colors.Green
        } else {
            Write-Host "    MISSING SECTION: Task" -ForegroundColor $Colors.Yellow
            $issues++
        }
    }
    
    return $issues
}

# Function to get skill version from SKILL.md
function Get-SkillVersion {
    param(
        [string]$SkillFile
    )
    
    if (Test-Path $SkillFile) {
        try {
            $content = Get-Content $SkillFile -Raw
            if ($content -match "^version:\s*(.+)") {
                return $matches[1].Trim()
            }
        } catch {
            return "error"
        }
    }
    return "no_file"
}

# Check skills directory
if (-not (Test-Path $SkillsDir)) {
    Write-Host "ERROR: Skills directory not found" -ForegroundColor $Colors.Red
    exit 1
}

Write-Host "Scanning skills directory: $SkillsDir"
Write-Host ""

# Get all skill directories
$skillDirs = Get-ChildItem -Path $SkillsDir -Directory | Sort-Object Name

Write-Host "Found $($skillDirs.Count) skill directories"
Write-Host ""

# Audit each skill
$totalIssues = 0
$skillSummary = @()

foreach ($skillDir in $skillDirs) {
    $skillName = $skillDir.Name
    Write-Host "Auditing: $skillName"
    Write-Host "------------------------"
    
    $issues = Test-SkillHealth -SkillDir $skillDir.FullName
    
    $skillVersion = Get-SkillVersion -SkillFile (Join-Path $skillDir.FullName "SKILL.md")
    $skillSummary += @{
        Name = $skillName
        Issues = $issues
        Version = $skillVersion
    }
    
    $totalIssues += $issues
    Write-Host ""
}

# Summary report
Write-Host "=== Skills Audit Summary ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Skill Status:"
Write-Host "-----------"
foreach ($summary in $skillSummary) {
    if ($summary.Issues -eq 0) {
        Write-Host "  HEALTHY: $($summary.Name) (v$($summary.Version))" -ForegroundColor $Colors.Green
    } else {
        Write-Host "  ISSUES: $($summary.Name) (v$($summary.Version)) - $($summary.Issues) issues" -ForegroundColor $Colors.Red
    }
}

Write-Host ""

# Check skills.md version consistency
$skillsVersionFile = Join-Path $SkillsDir "VERSION"
if (Test-Path $skillsVersionFile) {
    $content = Get-Content $skillsVersionFile -Raw
    if ($content -match "^version:\s*(.+)") {
        $globalVersion = $matches[1].Trim()
        Write-Host "Global skills version: v$globalVersion"
        Write-Host ""
        
        # Check for version mismatches
        Write-Host "Version Consistency Check:"
        Write-Host "------------------------"
        $versionMismatches = 0
        
        foreach ($summary in $skillSummary) {
            if ($summary.Version -ne "unknown" -and $summary.Version -ne "no_file" -and $summary.Version -ne $globalVersion) {
                Write-Host "  MISMATCH: $($summary.Name) is v$($summary.Version), global is v$globalVersion" -ForegroundColor $Colors.Yellow
                $versionMismatches++
            }
        }
        
        if ($versionMismatches -eq 0) {
            Write-Host "  All skills match global version" -ForegroundColor $Colors.Green
        }
    }
}

Write-Host ""

# Overall health
if ($totalIssues -eq 0) {
    Write-Host "=== SUCCESS: All skills healthy ===" -ForegroundColor $Colors.Green
    Write-Host "Total skills: $($skillDirs.Count)"
    exit 0
} else {
    Write-Host "=== ISSUES FOUND: $totalIssues total issues ===" -ForegroundColor $Colors.Red
    Write-Host ""
    Write-Host "Recommendations:"
    Write-Host "1. Fix missing SKILL.md files"
    Write-Host "2. Add required front matter fields"
    Write-Host "3. Ensure Role and Task sections exist"
    Write-Host "4. Align skill versions with global version"
    exit 1
}
