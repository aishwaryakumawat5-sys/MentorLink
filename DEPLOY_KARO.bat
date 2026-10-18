@echo off
title MentorLink - GitHub + Vercel Deploy Karo
color 0A

echo.
echo ========================================================
echo    MentorLink - GitHub and Vercel Deployment Helper
echo ========================================================
echo.
echo Yeh script aapki website ko permanently online karegi.
echo.
echo --------------------------------------------------------
echo STEP 1: GitHub Repository Create Karo
echo --------------------------------------------------------
echo.
echo  1. Browser mein yeh link OPEN KARO:
echo     https://github.com/new
echo.
echo  2. Repository Name type karo:  MentorLink
echo  3. PUBLIC select karo
echo  4. "Create repository" button par click karo
echo  5. Wapas aao aur koi bhi key press karo
echo.
pause

echo.
echo --------------------------------------------------------
echo STEP 2: Code GitHub par Upload Ho Raha Hai...
echo --------------------------------------------------------
echo.
git push -u origin main

if errorlevel 1 (
    echo.
    echo  [ERROR] GitHub push fail hua!
    echo  Kya aapne repository banaayi? Agar nahi, toh upar ka Step 1 dobara karo.
    echo.
    pause
    exit /b 1
)

echo.
echo  [SUCCESS] Code GitHub par upload ho gaya!
echo.

echo.
echo --------------------------------------------------------
echo STEP 3: Vercel par Deploy Ho Raha Hai...
echo --------------------------------------------------------
echo.

vercel login
vercel --prod --yes

echo.
echo ========================================================
echo  DEPLOYMENT COMPLETE! 
echo  Upar diya gaya URL copy karo - woh aapki live website hai!
echo ========================================================
echo.
pause
