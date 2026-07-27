#!/bin/bash
set -e

echo "================================================"
echo "  Level-Up Interview - one-time setup (Mac/Linux)"
echo "================================================"
echo

# ---- Backend ----
echo "[1/4] Creating backend virtual environment..."
cd backend
python3 -m venv venv

echo "[2/4] Installing backend packages (this can take a minute)..."
venv/bin/python -m pip install --upgrade pip >/dev/null
venv/bin/python -m pip install -r requirements.txt

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "Created backend/.env - open it and paste in your real OpenAI API key."
fi
cd ..

# ---- Frontend ----
echo "[3/4] Installing frontend packages (this can take a minute)..."
cd frontend
npm install

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "Created frontend/.env with default local settings."
fi
cd ..

echo "[4/4] Setup complete!"
echo
echo "NEXT STEP: open backend/.env and paste in your real OpenAI API key,"
echo "then run ./start.sh to launch the app."
