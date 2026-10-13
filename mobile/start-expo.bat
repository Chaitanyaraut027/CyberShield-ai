@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
echo ========================================================
echo   Starting CyberShield AI Mobile App (Expo SDK 57)
echo ========================================================
npx.cmd expo start -c
pause
