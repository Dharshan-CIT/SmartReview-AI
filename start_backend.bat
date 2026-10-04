@echo off
REM Starts the SmartReview AI API (FastAPI) on http://127.0.0.1:8000
cd /d "%~dp0"
if not exist "%~dp0venv\Scripts\python.exe" goto noenv
set HF_HUB_DISABLE_SYMLINKS_WARNING=1
echo Starting backend... (loading the BERT models takes about 10 seconds)
"%~dp0venv\Scripts\python.exe" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
goto end
:noenv
echo Python environment not found. Run:  python -m venv venv   then   venv\Scripts\pip install -r requirements.txt
:end
pause
