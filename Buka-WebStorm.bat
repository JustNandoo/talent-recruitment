@echo off
setlocal
cd /d "%~dp0"
where webstorm >nul 2>nul
if not errorlevel 1 (
  call webstorm "%CD%"
  exit /b 0
)
for /d %%D in ("%ProgramFiles%\JetBrains\WebStorm*") do (
  if exist "%%~D\bin\webstorm64.exe" (
    start "" "%%~D\bin\webstorm64.exe" "%CD%"
    exit /b 0
  )
)
echo WebStorm belum ditemukan otomatis. Buka WebStorm, pilih File - Open,
echo lalu pilih folder proyek ini. Panduan: BUKA-DI-WEBSTORM.md
pause
exit /b 1
