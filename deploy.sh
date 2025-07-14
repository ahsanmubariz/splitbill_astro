#!/bin/bash

# Production deployment script for Split Bill App
# This script builds and deploys the application using Docker

set -e  # Exit on any error

echo "🚀 Starting deployment of Split Bill App..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.example to .env and configure your environment variables."
    exit 1
fi

# Check if OPENROUTER_API_KEY is set
if ! grep -q "OPENROUTER_API_KEY=" .env || grep -q "OPENROUTER_API_KEY=your_openrouter_api_key_here" .env; then
    echo "❌ Error: OPENROUTER_API_KEY not configured in .env file!"
    echo "Please set your OpenRouter API key in the .env file."
    exit 1
fi

echo "✅ Environment configuration validated"

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -t split-bill-app:latest .

echo "✅ Docker image built successfully"

# Stop existing container if running
echo "🛑 Stopping existing container..."
docker-compose down || true

# Start the application
echo "🚀 Starting application..."
docker-compose up -d

# Wait for health check
echo "⏳ Waiting for application to be healthy..."
sleep 10

# Check if the application is running
if curl -f http://localhost:4321/health > /dev/null 2>&1; then
    echo "✅ Application is running and healthy!"
    echo "🌐 Access your application at: http://localhost:4321"
else
    echo "❌ Application health check failed!"
    echo "📋 Checking logs..."
    docker-compose logs
    exit 1
fi

echo "🎉 Deployment completed successfully!"
