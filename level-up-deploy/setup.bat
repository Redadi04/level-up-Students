@echo off
setlocal
cd /d "%~dp0"

echo ================================================
echo   Level-Up Interview - one-time setup (Windows)
echo ================================================
echo.

REM ---- Backend ----
echo [1/4] Creating backend virtual environment...
cd backend
python -m venv venv
if errorlevel 1 (
    echo.
    echo ERROR: "python" was not found. Install Python from python.org
    echo and make sure to check "Add python.exe to PATH" during install.
    pause
    exit /b 1
)

echo [2/4] Installing backend packages (this can take a minute)...
venv\Scripts\python.exe -m pip install --upgrade pip >nul
venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo ERROR: backend package install failed. See the message above.
    pause
    exit /b 1
)

if not exist ".env" (
    copy .env.example .env >nul
    echo Created backend\.env - open it and paste in your real OpenAI API key.
)
cd ..

REM ---- Frontend ----
echo [3/4] Installing frontend packages (this can take a minute)...
cd frontend
call npm install
if errorlevel 1 (
    echo.
    echo ERROR: "npm" was not found, or install failed. Install Node.js from
    echo nodejs.org (LTS version), then run this script again.
    pause
    exit /b 1
)

if not exist ".env" (
    copy .env.example .env >nul
    echo Created frontend\.env with default local settings.
)
cd ..

echo [4/4] Setup complete!
echo.
echo NEXT STEP: open backend\.env and paste in your real OpenAI API key,
echo then double-click start.bat to launch the app.
echo.
pause
