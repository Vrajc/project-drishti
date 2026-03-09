#!/bin/bash

echo "========================================"
echo "  DRISHTI - PostgreSQL + Prisma Setup"
echo "========================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo ""
    echo "Please edit .env file with your configuration!"
    echo "Then run this script again."
    exit 1
fi

echo "Starting Docker services (PostgreSQL + Prisma Studio)..."
docker-compose up -d

echo ""
echo "Waiting for PostgreSQL to be ready..."
sleep 10

echo ""
echo "Running Prisma migrations..."
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "Services running:"
echo "  - PostgreSQL:    http://localhost:5432"
echo "  - Prisma Studio: http://localhost:5555"
echo "  - Redis:         http://localhost:6379"
echo ""
echo "Opening Prisma Studio..."
if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:5555
elif command -v open > /dev/null; then
    open http://localhost:5555
fi
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop:      docker-compose down"
echo ""
