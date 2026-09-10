@echo off
rem Launches ClaudeTown from WSL. This file may live on a WSL UNC path
rem (\\wsl.localhost\...), which cmd.exe cannot use as a current
rem directory - pushd maps a temp drive to work around that. The actual
rem launch is handed off to ClaudeTown.vbs so no console window is left.
pushd "%~dp0" >nul 2>&1
wscript.exe "%~dp0ClaudeTown.vbs"
popd >nul 2>&1
