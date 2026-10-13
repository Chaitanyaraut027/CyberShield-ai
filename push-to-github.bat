@echo off
set "PATH=%LOCALAPPDATA%\MinGit\cmd;%PATH%"
cd /d "%~dp0"
echo ========================================================
echo   Pushing CyberShield AI to GitHub
echo ========================================================
echo Remote: https://github.com/Chaitanyaraut027/CyberShield-ai.git
echo.
git push -u origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================================
    echo   [SUCCESS] Code pushed to GitHub successfully!
    echo ========================================================
) else (
    echo ========================================================
    echo   Push encountered an error. If prompted for password,
    echo   please use a GitHub Personal Access Token (PAT).
    echo ========================================================
)
pause
