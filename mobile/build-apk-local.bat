@echo off
setlocal
set "PATH=C:\Program Files\nodejs;%PATH%"
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"

echo ========================================================
echo   Building CyberShield AI .apk Locally on this Laptop
echo ========================================================
echo Java Home:    %JAVA_HOME%
echo Android SDK:  %ANDROID_HOME%
echo.

cd /d "%~dp0"

echo [Step 1/3] Generating Android native project files...
call npx expo prebuild --platform android --clean
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Expo prebuild failed.
    goto :fail
)

echo.
echo [Step 2/3] Compiling standalone Android APK with Gradle...
cd android
call gradlew.bat assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gradle build failed.
    goto :fail
)

echo.
echo [Step 3/3] Locating generated .apk file...
set "APK_PATH=%~dp0android\app\build\outputs\apk\debug\app-debug.apk"
if exist "%APK_PATH%" (
    echo ========================================================
    echo   [SUCCESS] APK created successfully!
    echo   File: %APK_PATH%
    echo ========================================================
    echo Opening folder in Windows Explorer...
    explorer /select,"%APK_PATH%"
) else (
    echo [ERROR] APK not found at %APK_PATH%
    goto :fail
)

goto :end

:fail
echo.
echo ========================================================
echo Build failed. If you encounter issues with local Android SDK,
echo you can alternatively use EAS Cloud Build:
echo   Double-click: mobile\build-apk.bat
echo ========================================================

:end
pause
