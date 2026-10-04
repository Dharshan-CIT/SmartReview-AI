@echo off
REM Starts the SmartReview AI website on http://127.0.0.1:5173
cd /d "%~dp0frontend"
if exist "%~dp0frontend\node_modules" goto run
echo Installing website packages first (one time, needs internet)...
call npm install
:run
call npm run dev -- --host 127.0.0.1 --port 5173
pause
