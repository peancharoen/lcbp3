@echo off
chcp 65001 >nul
echo.

:: Check if in Git repository
git status >nul 2>&1
if errorlevel 1 (
    echo ERROR: Not a Git repository!
    exit /b 1
)

:: Get commit message from argument
set "MSG=%*"
if "%MSG%"=="" set "MSG=Auto backup"

:: Get date and time
for /f "tokens=2 delims==" %%I in ('wmic OS Get localdatetime /value') do set "dt=%%I"
set "YYYY=!dt:~0,4!"
set "MM=!dt:~4,2!"
set "DD=!dt:~6,2!"
set "HH=!dt:~8,2!"
set "MIN=!dt:~10,2!"
set "SEC=!dt:~12,2!"

set "TIMESTAMP=!YYYY!-!MM!-!DD! !HH!:!MIN!:!SEC!"
set "COMMIT_MSG=Backup: %MSG% | !TIMESTAMP!"

echo [START] Git Backup
echo Message: !COMMIT_MSG!
echo.

:: Stage changes
echo [1/4] Staging changes...
git add .
if errorlevel 1 (
    echo ERROR: Failed to stage
    exit /b 1
)

:: Commit
echo [2/4] Committing...
git commit -m "!COMMIT_MSG!"
if errorlevel 1 echo [INFO] No changes to commit

:: Push to Gitea
echo [3/4] Pushing to Gitea...
git push origin main
if errorlevel 1 (
    echo [WARN] Failed to push to Gitea
) else (
    echo [OK] Pushed to Gitea
)

:: Push to GitHub
echo [4/4] Pushing to GitHub...
git push github main
if errorlevel 1 (
    echo [WARN] Failed to push to GitHub
) else (
    echo [OK] Pushed to GitHub
)

echo.
echo [DONE] Backup completed!
timeout /t 3 >nul
