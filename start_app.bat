@echo off
REM One-click demo: starts the backend and the website, waits until BOTH answer, then opens the browser.
REM Full paths (%~dp0) are used on purpose: with the Windows setting NoDefaultCurrentDirectoryInExePath=1,
REM a bare "start_backend.bat" is not found even though it sits in the same folder.
cd /d "%~dp0"
echo Starting SmartReview AI...
start "SmartReview AI - Backend" cmd /k ""%~dp0start_backend.bat""
start "SmartReview AI - Frontend" cmd /k ""%~dp0start_frontend.bat""
echo Waiting for the app to be ready (up to 2 minutes)...
powershell -NoProfile -Command "$ok=$false; 1..60 | ForEach-Object { if(-not $ok){ try { $a=(Invoke-WebRequest 'http://127.0.0.1:8000/api/health' -UseBasicParsing -TimeoutSec 2).StatusCode; $b=(Invoke-WebRequest 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 2).StatusCode; if($a -eq 200 -and $b -eq 200){$ok=$true} } catch {}; if(-not $ok){Start-Sleep 2} } }; if($ok){exit 0}else{exit 1}"
if errorlevel 1 goto failed
start "" http://127.0.0.1:5173
echo.
echo Ready:  http://127.0.0.1:5173     API docs: http://127.0.0.1:8000/docs
echo Keep the two server windows open. Close them to stop the app.
goto end
:failed
echo.
echo The app did not start in time. Look at the two server windows for an error message.
:end
pause
