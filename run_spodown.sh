#!/bin/bash

# Create necessary directories if they don't exist
mkdir -p data
mkdir -p static/uploads/profile_images
mkdir -p static/uploads/chat_media
mkdir -p downloads

# Start the Flask application
python app.py