param([string]$Message = "Backup")

$Timestamp = Get-Date -Format "yyMMdd:HHmm"
$CommitMsg = "$Timestamp $Message"

Write-Host "📦 $CommitMsg" -ForegroundColor Cyan

git add .

# Check if anything to commit
$status = git status --porcelain
if (-not $status) {
    Write-Host "⚠️ Nothing to commit" -ForegroundColor Yellow
    pause
    exit
}

git commit -m $CommitMsg
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Commit failed" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "🚀 Pushing to Gitea..." -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Push to Gitea failed" -ForegroundColor Red
}

Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Cyan
git push github main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Push to GitHub failed" -ForegroundColor Red
}

Write-Host "✅ Done!" -ForegroundColor Green
pause
