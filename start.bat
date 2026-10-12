@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Pasang Node.js 24 atau lebih baru sebelum menjalankan ujian HRD.
  pause
  exit /b 1
)
node scripts\check-runtime.cjs
if errorlevel 1 (
  pause
  exit /b 1
)
echo HRD Division PT Serviam Group Shipyard: buka browser pada port 3000 atau PORT yang Anda atur.
echo Biarkan jendela ini tetap terbuka selama aplikasi digunakan.
node server.js
if errorlevel 1 pause
