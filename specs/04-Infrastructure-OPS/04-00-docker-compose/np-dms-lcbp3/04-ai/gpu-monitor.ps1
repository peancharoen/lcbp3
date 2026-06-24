# GPU Monitor for LCBP3 DMS
# Usage: powershell -ExecutionPolicy Bypass -File gpu-monitor.ps1

while($true) {
    Clear-Host
    Write-Host "=== GPU Monitor ===" -ForegroundColor Cyan
    Write-Host "$(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Yellow
    Write-Host ""
    
    nvidia-smi --query-gpu=name,memory.used,memory.total,temperature.gpu,utilization.gpu,power.draw,power.limit --format=csv,noheader | ForEach-Object {
        $parts = $_ -split ','
        Write-Host "GPU: $($parts[0].Trim())" -ForegroundColor Cyan
        Write-Host "Memory: $($parts[1].Trim()) / $($parts[2].Trim())" -ForegroundColor Yellow
        Write-Host "Temp: $($parts[3].Trim()) | Util: $($parts[4].Trim()) | Power: $($parts[5].Trim()) / $($parts[6].Trim())" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "Ctrl+C to stop" -ForegroundColor Gray
    Start-Sleep -Seconds 1
}
