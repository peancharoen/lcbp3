param([string]$Message = "Backup")

$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$CommitMsg = "Backup: $Message | $Timestamp"

Write-Host "Backup: $CommitMsg" -ForegroundColor Cyan

git add .
git commit -m $CommitMsg
git push origin main
git push github main

Write-Host "Done!" -ForegroundColor Green
pause
