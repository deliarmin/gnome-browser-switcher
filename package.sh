#!/bin/bash

# Browser Switcher Extension Packaging Script
# Creates a zip file ready for upload to extensions.gnome.org

EXTENSION_UUID="browser-switcher@deliarmin"
BUILD_DIR="build"
ZIP_NAME="browser-switcher.shell-extension.zip"

echo "Packaging Browser Switcher extension..."

# Clean up previous build
rm -rf "$BUILD_DIR"
rm -f "$ZIP_NAME"

# Create build directory
mkdir -p "$BUILD_DIR"

# Copy necessary files
echo "Copying files..."
cp extension.js "$BUILD_DIR/"
cp prefs.js "$BUILD_DIR/"
cp metadata.json "$BUILD_DIR/"
cp -r schemas "$BUILD_DIR/"

# Compile schemas
echo "Compiling schemas..."
glib-compile-schemas "$BUILD_DIR/schemas/"

# Create zip file
echo "Creating zip file..."
cd "$BUILD_DIR"
zip -r "../$ZIP_NAME" ./*
cd ..

# Clean up build directory
rm -rf "$BUILD_DIR"

echo "✓ Package created: $ZIP_NAME"
echo ""
echo "Next steps:"
echo "1. Update metadata.json"
echo "2. Test the extension: gnome-extensions install $ZIP_NAME"
echo "3. Upload to extensions.gnome.org"
echo ""
echo "File size:"
ls -lh "$ZIP_NAME"
