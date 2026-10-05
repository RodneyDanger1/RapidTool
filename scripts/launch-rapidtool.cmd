@echo off
rem Desktop entry point: double-click to start (or restart) RapidTool, then close.
node "%~dp0launch-rapidtool.mjs" %*
if errorlevel 1 (
  echo.
  echo RapidTool failed to start. See .grok\preview.log
  pause
)
