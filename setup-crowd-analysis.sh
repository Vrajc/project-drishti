#!/bin/bash

# Crowd Flow Analysis Setup Script

echo "================================"
echo "Crowd Flow Analysis Setup"
echo "================================"
echo ""

# Check Python installation
echo "Checking Python installation..."
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null
then
    echo "❌ Python is not installed. Please install Python 3.8 or higher."
    exit 1
fi

PYTHON_CMD="python"
if command -v python3 &> /dev/null
then
    PYTHON_CMD="python3"
fi

echo "✅ Python found: $($PYTHON_CMD --version)"
echo ""

# Install Python dependencies
echo "Installing Python dependencies..."
cd backend
$PYTHON_CMD -m pip install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✅ Python dependencies installed successfully"
else
    echo "❌ Failed to install Python dependencies"
    exit 1
fi

echo ""
echo "================================"
echo "Setup Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Ensure MongoDB is running"
echo "2. Configure .env file in backend folder"
echo "3. Start backend: cd backend && npm run dev"
echo "4. Start frontend: cd frontend && npm run dev"
echo "5. Navigate to Crowd Flow Analysis page"
echo "6. Upload video footage to start analyzing"
echo ""
