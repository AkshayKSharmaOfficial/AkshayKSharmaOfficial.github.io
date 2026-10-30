@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nahi mila. Pehle https://nodejs.org se LTS version install karo, phir dobara double-click karo.
  pause
  exit /b
)
echo Site aur news start ho rahe hain (har 15 minute me nayi news aati hai). Browser me kholo: http://localhost:8080/cyber-news/
echo Is window ko band mat karo. Band karne par news update ruk jayega.
start "" http://localhost:8080/cyber-news/
node news-tools\serve.mjs
pause
