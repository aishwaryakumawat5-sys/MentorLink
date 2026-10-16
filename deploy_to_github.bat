@echo off
title Deploy MentorLink to GitHub
color 0B

echo ========================================================
echo        MentorLink - Push to GitHub
echo ========================================================
echo.
echo Target Repository: https://github.com/aishwaryakumawat5-sys/MentorLink
echo Branch: main
echo.
echo Pushing latest commits to GitHub...
git push -u origin main

if errorlevel 1 (
    echo.
    echo ========================================================
    echo  [NOTE] If repository does not exist on GitHub yet:
    echo  1. Please open: https://github.com/new
    echo  2. Repository name: MentorLink
    echo  3. Choose Public (or Private) and click "Create repository"
    echo  4. Then double-click this deploy_to_github.bat script again!
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo  [SUCCESS] Successfully pushed to GitHub!
    echo  Next Step: Connect to Vercel at https://vercel.com/new
    echo ========================================================
)

echo.
pause
