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
    echo "Initializing database..."
    python3 -c "from app import create_app, db; app=create_app(); ctx=app.app_context(); ctx.push(); db.create_all()"
fi

# Run Gunicorn
echo "Starting Production Server (Gunicorn)..."
gunicorn -w 4 -b 0.0.0.0:8000 "app:create_app()"
