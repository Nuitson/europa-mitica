@echo off
rem Arranca la web en local (ver servir.ps1). Doble clic o: servir.bat [puerto]
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servir.ps1" %*
