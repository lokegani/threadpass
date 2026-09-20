@echo off
REM ThreadPass - start the local web server and open the site.
REM Double-click this file. Close the window (or press Ctrl+C) to stop.

start "" http://localhost:8000
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0serve.ps1"
