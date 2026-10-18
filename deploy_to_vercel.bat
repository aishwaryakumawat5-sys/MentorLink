@echo off
title Deploy MentorLink to Vercel
color 0A

echo ========================================================
echo             Deploy MentorLink to Vercel
echo ========================================================
echo.

echo [Step 1] Checking Vercel authentication...
call vercel whoami >nul 2>&1
if errorlevel 1 (
    echo.
    echo You are not logged in to Vercel yet.
    echo Please log in below (Select "Continue with GitHub"):
    echo.
    call vercel login
)

echo.
echo ========================================================
echo [Step 2] Deploying MentorLink to Vercel Production...
echo ========================================================
echo.
call vercel --prod --yes

echo.
echo ========================================================
echo  Deployment complete! Check your live URL above.
echo ========================================================
echo.
pause
