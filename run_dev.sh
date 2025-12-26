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

# Run Flask in Development Mode
echo "Starting Flask Development Server..."
export FLASK_APP=app
export FLASK_ENV=development
export FLASK_DEBUG=1
flask run --host=0.0.0.0 --port=5000
