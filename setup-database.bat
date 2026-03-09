@echo off
echo ========================================
echo  DRISHTI - PostgreSQL + Prisma Setup
echo ========================================
echo.

REM Check if .env exists
if not exist .env (
    echo Creating .env file from .env.example...
    copy .env.example .env
    echo.
    echo Please edit .env file with your configuration!
    echo Then run this script again.
    pause
    exit /b
)

echo Starting Docker services (PostgreSQL + Prisma Studio)...
docker-compose up -d

echo.
echo Waiting for PostgreSQL to be ready...
timeout /t 10 /nobreak > nul

echo.
echo Running Prisma migrations...
cd backend
call npm install
call npx prisma generate
call npx prisma migrate dev --name init

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Services running:
echo  - PostgreSQL:    http://localhost:5432
echo  - Prisma Studio: http://localhost:5555
echo  - Redis:         http://localhost:6379
echo.
echo Opening Prisma Studio in browser...
start http://localhost:5555
echo.
echo To view logs: docker-compose logs -f
echo To stop:      docker-compose down
echo.
pause
