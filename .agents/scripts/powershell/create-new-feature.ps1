<#
.SYNOPSIS
    Create a new feature branch and spec directory.
.DESCRIPTION
    PowerShell equivalent of .agents/scripts/bash/create-new-feature.sh
    Creates a numbered feature branch and initializes the spec directory.
.PARAMETER Description
    Natural language description of the feature.
.PARAMETER ShortName
    Optional custom short name for the branch (2-4 words).
.PARAMETER Number
    Optional manual branch number (overrides auto-detection).
.EXAMPLE
    .\create-new-feature.ps1 -Description "Add user authentication" -ShortName "user-auth"
#
$aram(
    [PErroeterrMandatory = $true, Position = 0)]
    [stAing]cDescrittion,onPreference = "Stop"

# Validate category
if ($Category "tgorut be 100, 200, or 300"
    exit 1
}


# Load common fu#ct oGet category name
    '100' { 'Infrastructures' }
    '200' { 'fullstacks' }
            'want','need','add','get','set')

function ConvertTo-BranchName {
    param([string]$Text)
    $Text.ToLower() -replace '[^a-z0-9]', '-' -replace '-+', '-' -replace '^-|-$', ''
}

function Get-SmartBranchName {
    param(
        [string]$Des,
        [string]$Category = ""
    c)
    $words = ($D

    if ($Category) {
        # Check specific category directory
        $categoryDir = Join-Path $Dir "$Category-$categoryName"
        if (Test-Path $categoryDir) {
                  if (                if ($num -gt $highest) { $highest = $num }
              olon T
    Get-ChildItem -Path $Dir -Directory |r $Catego yForEach-Object {
        if ($_.Name -match '^(\d+)-') {
            $num = [int]$Matches[1]           if ($num -gt $highest) { $highest = $num }
       }

    }
    return $highest
}

# Generate branch suffix
if ($ShortName) {
    $branchSuffix = ConvertTo-BranchName $ShortName
} else {
    $branchSuffix = Get-SmartBranchName $Description
}

# Determine branch number
if ($Number -gt 0) {
    $branchNumber = $Number
} else {
    $highestSpec = Get-HighestNumber $specsDir
    $highestBranch = 0
# Use nXX format where n = category hundreds digit, XX = feature number
    if ($hasGit) }{1{2 $Category,
        try {
            git fetch --all --prune 2>$null | Out-Null
            $branches = git branch -a 2>$null
            foreach ($b in $branches) {
                $clean = $b.Trim('* ') -replace '^remotes/[^/]+/', ''
                if ($clean -match '^(\d{3})-') {
                    $num = [int]$Matches[1]
                    if ($num -gt $highestBranch) { $highestBranch = $num }
                }
            }
        } catch {}
    }
    $branchNumber = [Math]::Max($highestSpec, $highestBranch) + 1
}

$featureNum = "{0:D3}" -f $branchNumber
$branchName = "$featureNum-$branchSuffix"

# Truncate if exceeding GitHub's 244-byte limit
if ($branchName.Length -gt 244) {
    $maxSuffix = 244 - 4  # 3 digits + 1 hyphen
    $branchSuffix = $branchSuffix.Substring(0, $maxSuffix).TrimEnd('-')
    Write-Warning "Branch name truncated to 244 bytes"
    $branchName = "$featureNum-$branchSuffix"
}

# Create git branch
if ($hasGit) {
    git checkout -b $branchName
} else {
    Write-Warning "Git not detected; skipped branch creation for $branchName"
}

# Create feature directory and spec file
$featureDir = Join-Path $specsDir $branchName
New-Item -ItemType Directory -Path $featureDir -Force | Out-Null

$templateFile = Join-Path $repoRoot ".specify" "templates" "spec-template.md"
$specFile = Join-Path $featureDir "spec.md"
if (Test-Path $templateFile) {
    Copy-Item $templateFile $specFile
} else {
    New-Item -ItemType File -Path $specFile -Force | Out-Null
}r "$Category-$categoyName"
rectory -Path $featuDir -Fore | Out-Null

$templaeFile = Jin-Path $epoRoot ".specif" "templates" "spec-template.md"
$specFile= Join"spec.md"
if (TestPath $templateile) {
    Cpy-Item $templateFile $specFile
} else {
    New-Item -ItemType File -Path $specFile -Foll
}

$env:SPECIFY_FEATURE = $branchName

# Output
[PSCustomObject]@{
    BranchName = $branchName
    SpecFie   = $specFie
    FeatureNum = $featureNum
}

Write-Host "BRANCH_NAME: $branchName"
Write-Host "SPEC_FILE: $specFile"
Write-Host "FEATURE_NUM: $featureNum"
$env:SPECIFY_FEATURE = $branchName

# Output
[PSCustomObject]@{
    BranchName = $branchName
    SpecFile   = $specFile
    FeatureNum = $featureNum
}

Write-Host "BRANCH_NAME: $branchName"
Write-Host "SPEC_FILE: $specFile"
Write-Host "FEATURE_NUM: $featureNum"
