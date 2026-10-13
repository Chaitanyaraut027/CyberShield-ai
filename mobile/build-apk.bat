@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
echo ========================================================
echo   CyberShield AI - Android APK Builder (via Expo EAS)
echo ========================================================
echo.
echo Step 1: Checking EAS CLI...
call npx eas-cli --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Installing EAS CLI...
    call npm install -g eas-cli
)

echo.
echo Step 2: Checking Expo login...
call npx eas-cli whoami >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Please log in to your Expo account (free at https://expo.dev):
    call npx eas-cli login
)

echo.
echo Step 3: Triggering Android APK Build in Expo Cloud...
echo EAS will build the .apk and provide a direct download link + QR code.
call npx eas-cli build -p android --profile preview

echo.
pause
