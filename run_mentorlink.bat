@echo off
title MentorLink Local Server
color 0A

echo ========================================================
echo           MentorLink Platform Launcher
echo ========================================================
echo.
echo Checking Python installation...
python --version
if errorlevel 1 (
    echo [ERROR] Python is not found in PATH! Please install Python 3.
    pause
    exit /b 1
)

echo.
echo Checking database status...
if not exist "instance\mentorlink.db" (
    echo Database not found. Initializing and seeding demo data...
    python seed.py
)

echo.
echo Starting MentorLink Server on http://127.0.0.1:5000 ...
echo Opening Microsoft Edge...

:: Open Microsoft Edge with the local server address
start msedge "http://127.0.0.1:5000"

echo.
echo ========================================================
echo  Server is running! Do NOT close this command window.
echo  Access URL: http://127.0.0.1:5000
echo ========================================================
echo.

python app.py
pause
