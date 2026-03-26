@echo off
start scrcpy -s R3CT105TEHV --window-title "Device 1 (R3CT)"
timeout /t 2 >nul
start scrcpy -s R5CT20PFK1L --window-title "Device 2 (R5CT)"