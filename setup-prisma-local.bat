@echo off
echo ========================================
echo  DRISHTI - Prisma Setup (No Docker)
echo ========================================
echo.

cd backend

echo Installing dependencies...
call npm install

echo.
echo Generating Prisma Client...
call npx prisma generate

echo.
echo Running database migrations...
call npx prisma migrate dev --name init

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Starting Prisma Studio...
echo.
echo Prisma Studio will open at: http://localhost:5555
echo.
echo Press Ctrl+C to stop Prisma Studio
echo.
call npx prisma studio
