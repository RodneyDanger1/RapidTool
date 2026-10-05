@echo off
setlocal
rem Desktop entry point: double-click to start (or relaunch) RapidTool.
rem It builds if there is no build output, starts the preview server on
rem 127.0.0.1:8081, opens the app in the default browser, and returns.
rem Stop it any time with:  npm run launch:stop
rem                    or:  "%~f0" stop
rem See LAUNCH.md for the full start / use / close / relaunch guide.
echo Starting RapidTool...
node "%~dp0launch-rapidtool.mjs" %*
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo RapidTool failed to start. See .grok\preview.log for details.
  pause
  exit /b %RC%
)
if "%~1"=="" (
  echo.
  echo RapidTool is running. This window can be closed.
  echo To stop it:  npm run launch:stop
)
endlocal
