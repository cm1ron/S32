@echo off
:: 날짜/시간으로 기본 파일명 생성
set timestamp=qa_%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%
set timestamp=%timestamp: =0%

:: -- 기기 1 녹화 (파일명 끝에 _DEV1) --
start "Recording Device 1" .\scrcpy -s R3CT105TEHV --record "%timestamp%_DEV1.mp4" --show-touches --max-fps 30 -m 1024 --time-limit 5400

:: 2초 대기 (충돌 방지)
timeout /t 2 >nul

:: -- 기기 2 녹화 (파일명 끝에 _DEV2) --
start "Recording Device 2" .\scrcpy -s R5CT20PFK1L --record "%timestamp%_DEV2.mp4" --show-touches --max-fps 30 -m 1024 --time-limit 5400