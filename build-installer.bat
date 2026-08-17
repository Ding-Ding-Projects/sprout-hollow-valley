@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 (
  >&2 echo ERROR: Could not change to the repository directory "%~dp0".
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  >&2 echo ERROR: Node.js was not found on PATH. Install Node.js 22 or newer and try again.
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  >&2 echo ERROR: npm was not found on PATH. Install npm and try again.
  exit /b 1
)

if not exist "package-lock.json" (
  >&2 echo ERROR: package-lock.json is required for a reproducible installer build.
  exit /b 1
)

echo Installing locked dependencies...
call npm ci --no-audit
set "exit_code=%errorlevel%"
if not "%exit_code%"=="0" (
  >&2 echo ERROR: npm ci failed with exit code %exit_code%.
  exit /b %exit_code%
)

echo Packaging Sprout Hollow Valley...
call npm run package
set "exit_code=%errorlevel%"
if not "%exit_code%"=="0" (
  >&2 echo ERROR: npm run package failed with exit code %exit_code%.
  exit /b %exit_code%
)

set "APP_VERSION="
for /f "usebackq delims=" %%V in (`node -p "require('./package.json').version"`) do set "APP_VERSION=%%V"
if not defined APP_VERSION (
  >&2 echo ERROR: Could not read a nonempty version from package.json.
  exit /b 1
)

set "SQUIRREL_DIR=release\squirrel-windows"
set "SETUP_PATH=%SQUIRREL_DIR%\Sprout-Hollow-Valley-Setup-%APP_VERSION%.exe"
set "PACKAGE_PATH=%SQUIRREL_DIR%\sprout-hollow-valley-%APP_VERSION%-full.nupkg"
set "RELEASES_PATH=%SQUIRREL_DIR%\RELEASES"

call :require_nonempty "%SETUP_PATH%" "Squirrel.Windows installer"
set "exit_code=%errorlevel%"
if not "%exit_code%"=="0" exit /b %exit_code%

call :require_nonempty "%PACKAGE_PATH%" "Squirrel.Windows full package"
set "exit_code=%errorlevel%"
if not "%exit_code%"=="0" exit /b %exit_code%

call :require_nonempty "%RELEASES_PATH%" "Squirrel.Windows RELEASES manifest"
set "exit_code=%errorlevel%"
if not "%exit_code%"=="0" exit /b %exit_code%

echo Installer build completed successfully for version %APP_VERSION%.
echo Installer: "%CD%\%SETUP_PATH%"
echo Full package: "%CD%\%PACKAGE_PATH%"
echo RELEASES manifest: "%CD%\%RELEASES_PATH%"
exit /b 0

:require_nonempty
if not exist "%~1" (
  >&2 echo ERROR: Expected %~2 was not created: "%~1"
  exit /b 1
)
for %%F in ("%~1") do if %%~zF LEQ 0 (
  >&2 echo ERROR: Expected %~2 is empty: "%~1"
  exit /b 1
)
exit /b 0
