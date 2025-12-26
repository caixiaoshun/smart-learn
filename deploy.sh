#!/bin/bash

# Setup virtual environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Initialize DB if not exists
if [ ! -f "app.db" ]; then
    echo "Initializing database and seeding data..."
    python3 seed.py
fi

# Run Gunicorn
echo "Starting Production Server (Gunicorn)..."
gunicorn -w 4 -b 0.0.0.0:8000 "app:create_app()"
