#!/bin/bash

# Browser Switcher Extension Installation Script

EXT_DIR="$HOME/.local/share/gnome-shell/extensions/browser-switcher@deliarmin"

echo "Installing Browser Switcher extension..."

# Create extension directory if it doesn't exist
mkdir -p "$EXT_DIR"
mkdir -p "$EXT_DIR/schemas"

# Copy files
echo "Copying files..."
cp -f extension.js "$EXT_DIR/"
cp -f metadata.json "$EXT_DIR/"
cp -f prefs.js "$EXT_DIR/"
cp -f schemas/org.gnome.shell.extensions.browser-switcher.gschema.xml "$EXT_DIR/schemas/"

# Compile schema
echo "Compiling schema..."
glib-compile-schemas "$EXT_DIR/schemas/"

# Check if compilation was successful
if [ $? -eq 0 ]; then
    echo "✓ Extension installed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Restart GNOME Shell (Press Alt+F2, type 'r', press Enter)"
    echo "   OR log out and log back in"
    echo "2. Enable the extension:"
    echo "   gnome-extensions enable browser-switcher@deliarmin"
    echo ""
    echo "To check for errors, run:"
    echo "   journalctl -f -o cat | grep -i 'browser-switcher'"
else
    echo "✗ Error compiling schema!"
    exit 1
fi
