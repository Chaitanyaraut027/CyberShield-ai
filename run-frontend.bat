@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0frontend"
echo ========================================================
echo   Starting CyberShield AI Web Frontend
echo   Connecting to: https://cybershield-ai-1-apmx.onrender.com
echo ========================================================
echo.
npm run dev
pause
