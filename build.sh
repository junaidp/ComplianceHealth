#!/bin/bash
set -e

echo "==> Building frontend..."
npm run build

echo "==> Installing server dependencies..."
cd server
npm install

echo "==> Building server..."
npm run build

echo "==> Build complete!"
