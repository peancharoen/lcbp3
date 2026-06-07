# File: .vscode/setup-terminal.ps1
# Change Log:
# - 2026-06-07: Initial creation - bypass PSReadline history restoration

param(
    [Parameter(Mandatory=$true)]
    [string]$TargetPath
)

# Disable PSReadline history for this session
Set-PSReadlineOption -HistorySaveStyle SaveNothing

# Change to target directory
Set-Location $TargetPath
