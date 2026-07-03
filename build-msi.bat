@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
set PATH=%USERPROFILE%\.cargo\bin;%USERPROFILE%\AppData\Local\Microsoft\WindowsApps;C:\Program Files\nodejs;%PATH%

echo [1/4] Building Vite frontend...
cd /d "C:\Users\preet\Documents\projects\personal-translator\apps\desktop"
call npx vite build
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

echo [2/4] Compiling server TypeScript...
cd /d "C:\Users\preet\Documents\projects\personal-translator\apps\server"
call npx tsc
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

echo [3/4] Bundling server sidecar...
call npx pkg dist/index.js --target node22-win-x64 --output "..\desktop\src-tauri\binaries\server-x86_64-pc-windows-msvc.exe"
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

echo [4/4] Building Tauri .msi installer...
cd /d "C:\Users\preet\Documents\projects\personal-translator\apps\desktop"
call npx tauri build --target x86_64-pc-windows-msvc
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

echo Done! .msi should be at:
echo apps\desktop\src-tauri\target\release\bundle\msi\
