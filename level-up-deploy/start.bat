@echo off
cd /d "%~dp0"
echo Starting Level-Up Interview...
echo (Two new windows will open - one for the backend, one for the frontend.
echo  Close both windows, or press Ctrl+C in each, to stop.)
echo.

start "Level-Up Interview - Backend" cmd /k "cd backend && venv\Scripts\python.exe app.py"
start "Level-Up Interview - Frontend" cmd /k "cd frontend && npm run dev"

timeout /t 4 /nobreak >nul
start http://localhost:5173
