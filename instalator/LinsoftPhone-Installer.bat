@echo off
rem LinsoftPhone Installer pre Windows: spusti instalator ako spravca (zapis na USB/SD to vyzaduje).
rem Potrebuje Python 3.8+ (python.org alebo Microsoft Store).
where python >nul 2>nul || (
  echo Python nie je nainstalovany. Stiahni ho z https://www.python.org/downloads/
  pause
  exit /b 1
)
powershell -NoProfile -Command "Start-Process python -ArgumentList '\"%~dp0linsoft_instalator.py\"' -Verb RunAs"
