@echo off
setlocal EnableExtensions
set "SHV_SILENT=0"
if /I "%~1"=="/s" set "SHV_SILENT=1"
if /I "%~1"=="--silent" set "SHV_SILENT=1"
if /I "%SILENT%"=="1" set "SHV_SILENT=1"

set "SHV_ROOT=%~dp0"
set "SHV_ARGS="
if "%SHV_SILENT%"=="1" set "SHV_ARGS=-Silent"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SHV_ROOT%scripts\download-dependencies.ps1" %SHV_ARGS%
exit /b %ERRORLEVEL%
