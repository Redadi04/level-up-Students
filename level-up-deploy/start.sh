#!/bin/bash

echo "Starting Level-Up Interview..."
echo "(Press Ctrl+C to stop both servers.)"
echo

cleanup() {
    echo
    echo "Stopping servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup INT TERM

(cd backend && venv/bin/python app.py) &
BACKEND_PID=$!

(cd frontend && npm run dev) &
FRONTEND_PID=$!

sleep 3
# Open the browser (works on most Mac/Linux setups; ignore if it fails)
( command -v open >/dev/null && open http://localhost:5173 ) || \
( command -v xdg-open >/dev/null && xdg-open http://localhost:5173 ) || true

wait $BACKEND_PID $FRONTEND_PID
