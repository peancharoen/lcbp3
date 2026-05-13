# File: scripts/sync-agent-configs.ps1
# Change Log:
# - 2026-05-13: Initial script to sync .agents to .windsurf

$rootDir = Get-Location
$agentsDir = Join-Path $rootDir ".agents"
$windsurfDir = Join-Path $rootDir ".windsurf"

Write-Host "🚀 Syncing .agents to .windsurf (v1.9.0)..." -ForegroundColor Cyan

# 1. Sync Rules (with YAML header)
Write-Host "📂 Syncing Rules..." -ForegroundColor Yellow
$rulesSrc = Join-Path $agentsDir "rules"
$rulesDest = Join-Path $windsurfDir "rules"

if (!(Test-Path $rulesDest)) { New-Item -ItemType Directory -Path $rulesDest }

Get-ChildItem -Path $rulesSrc -Filter *.md | ForEach-Object {
    $content = Get-Content $_.FullName
    $targetFile = Join-Path $rulesDest $_.Name
    
    # Check if YAML header already exists
    if ($content[0] -ne "---") {
        $newContent = @("---", "trigger: always_on", "---", "") + $content
        $newContent | Set-Content $targetFile
    } else {
        $content | Set-Content $targetFile
    }
}

# 2. Sync Workflows (Mirror/Copy)
Write-Host "📂 Syncing Workflows..." -ForegroundColor Yellow
$workflowsSrc = Join-Path $agentsDir "workflows"
$workflowsDest = Join-Path $windsurfDir "workflows"

if (!(Test-Path $workflowsDest)) { New-Item -ItemType Directory -Path $workflowsDest }
Copy-Item -Path "$workflowsSrc\*" -Destination $workflowsDest -Force -Recurse

# 3. Sync Skills (Mirror/Copy)
Write-Host "📂 Syncing Skills..." -ForegroundColor Yellow
$skillsSrc = Join-Path $agentsDir "skills"
$skillsDest = Join-Path $windsurfDir "skills"

if (!(Test-Path $skillsDest)) { New-Item -ItemType Directory -Path $skillsDest }
Copy-Item -Path "$skillsSrc\*" -Destination $skillsDest -Force -Recurse

Write-Host "✅ Sync Complete!" -ForegroundColor Green
