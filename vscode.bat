@echo off
title Opening Hermes Project in VS Code
echo 🖥️ Connecting to WSL and Opening VS Code...

:: สั่งให้ wsl เรียกคำสั่ง code เพื่อเปิด Folder โปรเจกต์โดยตรง
:: วิธีนี้จะเปิด VS Code ฝั่ง Windows ให้โดยอัตโนมัติใน Mode Remote-WSL จ้า
wsl code /mnt/d/InvestmentDashboard/

if %errorlevel% neq 0 (
    echo ❌ โอ๊ะโอ! เหมือนจะหาคำสั่ง 'code' ไม่เจอใน WSL จ้า
    echo ลองเช็คดูว่าใน VS Code ลง Extension "WSL" หรือยังนะจ๊ะ
    pause
)