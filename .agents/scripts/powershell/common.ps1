# PowerShell equivalents for key .agents bash scripts
# These provide Windows-native alternatives for the most commonly used functions

<#
.SYNOPSIS
    Common utility functions for Spec-Kit PowerShell scripts.
.DESCRIPTION
    PowerShell equivalent of .agents/scripts/bash/common.sh
    Provides repository root detection, branch identification, and feature path resolution.
#>

function Get-RepoRoot {
    try {
        $root = git rev-parse --show-toplevel 2>$null
        if ($LASTEXITCODE -eq 0) { return $root.Trim() }
    } catch {}
    # Fallback: navigate up from script location
    return (Resolve-Path "$PSScriptRoot\..\..\..").Path
}

function Get-CurrentBranch {
    # Check environment variable first
    if ($env:SPECIFY_FEATURE) { return $env:SPECIFY_FEATURE }

    try {
        $branch = git rev-parse --abbrev-ref HEAD 2>$null
        if ($LASTEXITCODE -eq 0) { return $branch.Trim() }
    } catch {}

    # Fallback: find latest feature directory
    $repoRoot = Get-RepoRoot
    $specsDir = Join-Path $repoRoot "specs"
    if (Test-Path $specsDir) {
        $latest = Get-ChildItem -Path $specsDir -Directory |
            Where-Object { $_.Name -match '^\d{3}-' } |
            Sort-Object Name -Descending |
            Select-Object -First 1
        if ($latest) { return $latest.Name }
    }
    return "main"
}

function Test-HasGit {
    try {
        git rev-parse --show-toplevel 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    } catch { return $false }
}

function Test-FeatureBranch {
    param([string]$Branch, [bool]$HasGit)
    if (-not $HasGit) {
        Write-Warning "[specify] Git repository not detected; skipped branch validation"
        return $true
    }
    if ($Branch -notmatch '^\d{3}-') {
        Write-Error "Not on a feature branch. Current branch: $Branch"
        Write-Error "Feature branches should be named like: 001-feature-name"
        return $false
    }
    return $true
}

function Find-FeatureDir {
    param([string]$RepoRoot, [string]$BranchName)
    $specsDir = Join-Path $RepoRoot "specs"

    if ($BranchName -match '^(\d{3})-') {
        $prefix = $Matches[1]
        $matches = Get-ChildItem -Path $specsDir -Directory -Filter "$prefix-*" -ErrorAction SilentlyContinue
        if ($matches.Count -eq 1) { return $matches[0].FullName }
        if ($matches.Count -gt 1) {
            Write-Warning "Multiple spec dirs with prefix '$prefix': $($matches.Name -join ', ')"
        }
    }
    return Join-Path $specsDir $BranchName
}

function Get-FeaturePaths {
    $repoRoot = Get-RepoRoot
    $branch = Get-CurrentBranch
    $hasGit = Test-HasGit
    $featureDir = Find-FeatureDir -RepoRoot $repoRoot -BranchName $branch

    return [PSCustomObject]@{
        RepoRoot     = $repoRoot
        Branch       = $branch
        HasGit       = $hasGit
        FeatureDir   = $featureDir
        FeatureSpec  = Join-Path $featureDir "spec.md"
        ImplPlan     = Join-Path $featureDir "plan.md"
        Tasks        = Join-Path $featureDir "tasks.md"
        Research     = Join-Path $featureDir "research.md"
        DataModel    = Join-Path $featureDir "data-model.md"
        Quickstart   = Join-Path $featureDir "quickstart.md"
        ContractsDir = Join-Path $featureDir "contracts"
    }
}

<#
.SYNOPSIS
    Check prerequisites for Spec-Kit workflows.
.DESCRIPTION
    PowerShell equivalent of .agents/scripts/bash/check-prerequisites.sh
.PARAMETER RequireTasks
    Require tasks.md to exist (for implementation phase)
.PARAMETER IncludeTasks
    Include tasks.md in available docs list
.PARAMETER PathsOnly
    Only output paths, no validation
.EXAMPLE
    .\common.ps1
    $result = Check-Prerequisites -RequireTasks
#>
function Check-Prerequisites {
    param(
        [switch]$RequireTasks,
        [switch]$IncludeTasks,
        [switch]$PathsOnly
    )

    $paths = Get-FeaturePaths
    $valid = Test-FeatureBranch -Branch $paths.Branch -HasGit $paths.HasGit
    if (-not $valid) { throw "Not on a feature branch" }

    if ($PathsOnly) { return $paths }

    # Validate required files
    if (-not (Test-Path $paths.FeatureDir)) {
        throw "Feature directory not found: $($paths.FeatureDir). Run /speckit.specify first."
    }
    if (-not (Test-Path $paths.ImplPlan)) {
        throw "plan.md not found. Run /speckit.plan first."
    }
    if ($RequireTasks -and -not (Test-Path $paths.Tasks)) {
        throw "tasks.md not found. Run /speckit.tasks first."
    }

    # Build available docs list
    $docs = @()
    if (Test-Path $paths.Research)  { $docs += "research.md" }
    if (Test-Path $paths.DataModel) { $docs += "data-model.md" }
    if ((Test-Path $paths.ContractsDir) -and (Get-ChildItem $paths.ContractsDir -ErrorAction SilentlyContinue)) {
        $docs += "contracts/"
    }
    if (Test-Path $paths.Quickstart) { $docs += "quickstart.md" }
    if ($IncludeTasks -and (Test-Path $paths.Tasks)) { $docs += "tasks.md" }

    return [PSCustomObject]@{
        FeatureDir    = $paths.FeatureDir
        AvailableDocs = $docs
        Paths         = $paths
    }
}

# Export functions when dot-sourced
Export-ModuleMember -Function * -ErrorAction SilentlyContinue 2>$null
