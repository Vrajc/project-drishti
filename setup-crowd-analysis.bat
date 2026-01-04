@echo off
REM Crowd Flow Analysis Setup Script for Windows

echo ================================
echo Crowd Flow Analysis Setup
echo ================================
echo.

REM Check Python installation
echo Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X Python is not installed. Please install Python 3.8 or higher.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo [OK] Python found: %PYTHON_VERSION%
echo.

REM Install Python dependencies
echo Installing Python dependencies...
cd backend
python -m pip install -r requirements.txt

if %errorlevel% equ 0 (
    echo [OK] Python dependencies installed successfully
) else (
    echo [X] Failed to install Python dependencies
    pause
    exit /b 1
)

cd ..
echo.
echo ================================
echo Setup Complete!
echo ================================
echo.
echo Next steps:
echo 1. Ensure MongoDB is running
echo 2. Configure .env file in backend folder
echo 3. Start backend: cd backend ^&^& npm run dev
echo 4. Start frontend: cd frontend ^&^& npm run dev
echo 5. Navigate to Crowd Flow Analysis page
echo 6. Upload video footage to start analyzing
echo.
pause
