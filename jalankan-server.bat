@echo off
rem Menjalankan server lokal Estimasi Material di http://localhost:3000
rem Tutup jendela ini untuk menghentikan server.
cd /d "%~dp0apps\web"
if not exist ".env.local" (
  echo .env.local belum ada. Salin .env.example menjadi .env.local lalu isi.
  pause
  exit /b 1
)
start "" http://localhost:3000
call npm run dev -- -p 3000
pause
