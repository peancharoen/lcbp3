@echo off
REM File: e:/np-dms/lcbp3/run-codebase-dashboards.bat
REM Change Log:
REM - 2026-06-13: สร้างสคริปต์สำหรับเปิดแดชบอร์ดแผนที่โค้ด (Codebase Map) แยกหน้าต่างอัตโนมัติ

echo ==========================================================
echo       Starting Codebase Map Dashboards (Understand)       
echo ==========================================================
echo.

echo [1/2] กำลังเปิดแดชบอร์ดฝั่ง Backend (พอร์ต 5173)...
start "Backend Map Dashboard" cmd /c "set GRAPH_DIR=e:\np-dms\lcbp3\backend\src && cd /d C:\Users\peanc\.understand-anything\repo\understand-anything-plugin\packages\dashboard && npx vite --host 127.0.0.1 --port 5173"

echo [2/2] กำลังเปิดแดชบอร์ดฝั่ง Frontend (พอร์ต 5174)...
start "Frontend Map Dashboard" cmd /c "set GRAPH_DIR=e:\np-dms\lcbp3\frontend && cd /d C:\Users\peanc\.understand-anything\repo\understand-anything-plugin\packages\dashboard && npx vite --host 127.0.0.1 --port 5174"

echo.
echo ----------------------------------------------------------
echo แดชบอร์ดทั้งสองฝั่งกำลังเปิดทำงานในหน้าต่าง cmd แยกต่างหาก
echo กรุณาตรวจสอบ Token จากแต่ละหน้าต่างเพื่อเข้าใช้งานผ่านเว็บเบราว์เซอร์
echo ----------------------------------------------------------
echo.
pause
