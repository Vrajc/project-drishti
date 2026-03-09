@echo off
echo ========================================
echo  DRISHTI - Installing Dependencies
echo ========================================
echo.

echo Installing npm packages (including Prisma 5.x)...
call npm install

echo.
echo ========================================
echo  Prisma Setup
echo ========================================
echo.

echo Generating Prisma Client...
call npx prisma generate

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Make sure PostgreSQL is running (locally or via Docker)
echo 2. Update backend\.env with your DATABASE_URL
echo 3. Run migrations: npx prisma migrate dev
echo 4. Start Prisma Studio: npx prisma studio
echo.
pause
