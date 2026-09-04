@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 (
  >&2 echo ERROR: Could not change to the repository directory "%~dp0".
  exit /b 1
)

set "SHV_ROOT=%~dp0"
call "%SHV_ROOT%download-dependencies.bat" /s
if errorlevel 1 exit /b %ERRORLEVEL%
set "PATH=%SHV_ROOT%.tools\node-v22.23.2-win-x64;%PATH%"

if not exist "package-lock.json" (
  >&2 echo ERROR: package-lock.json is required for a reproducible build.
  exit /b 1
)

echo Installing locked dependencies...
call npm ci --no-audit
set "exit_code=%errorlevel%"
if not "%exit_code%"=="0" (
  >&2 echo ERROR: npm ci failed with exit code %exit_code%.
  exit /b %exit_code%
)

echo Building Sprout Hollow Valley...
call npm run build
set "exit_code=%errorlevel%"
if not "%exit_code%"=="0" (
  >&2 echo ERROR: npm run build failed with exit code %exit_code%.
  exit /b %exit_code%
)

echo Build completed successfully.
echo Renderer output: "%CD%\dist"
echo Electron output: "%CD%\dist-electron"
exit /b 0
