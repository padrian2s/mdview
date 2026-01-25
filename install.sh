#!/bin/bash

set -e

echo "Installing mdview..."

# Install dependencies
npm install --silent

# Link globally
npm link --silent

echo "Done! Run 'mdview' to start."
