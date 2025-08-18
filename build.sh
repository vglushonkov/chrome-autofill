#!/bin/bash

# Build script for Fields Autofill Extension
# Prepares the extension for publication to Chrome Web Store

# Extract version from manifest.json
VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": "\([^"]*\)".*/\1/')

echo "🚀 Building Fields Autofill Extension v$VERSION"
echo "============================================"

# Create build directory
BUILD_DIR="build"
DIST_DIR="dist"

echo "📁 Creating build directories..."
rm -rf $BUILD_DIR $DIST_DIR
mkdir -p $BUILD_DIR
mkdir -p $DIST_DIR

# Copy essential files to build directory
echo "📋 Copying files..."

# Core extension files
cp manifest.json $BUILD_DIR/
cp -r background $BUILD_DIR/
cp -r content $BUILD_DIR/
cp -r icons $BUILD_DIR/
cp -r popup $BUILD_DIR/
cp -r storage $BUILD_DIR/
cp -r utils $BUILD_DIR/

# Documentation (optional for store)
cp README.md $BUILD_DIR/

echo "🧹 Cleaning up build directory..."

# Remove development files from build
find $BUILD_DIR -name ".DS_Store" -delete
find $BUILD_DIR -name "*.swp" -delete
find $BUILD_DIR -name "*.tmp" -delete

echo "📦 Creating ZIP archive for Chrome Web Store..."

# Create ZIP for Chrome Web Store submission
cd $BUILD_DIR
zip -r "../$DIST_DIR/fields-autofill-v$VERSION.zip" . -x "*.git*" ".DS_Store"
cd ..

echo "📊 Build Summary:"
echo "=================="
echo "✅ Extension files copied to: $BUILD_DIR/"
echo "✅ ZIP archive created: $DIST_DIR/fields-autofill-v$VERSION.zip"

# Show file sizes
echo ""
echo "📏 Archive size:"
ls -lh "$DIST_DIR/fields-autofill-v$VERSION.zip"

echo ""
echo "📋 Files included in build:"
echo "---------------------------"
find $BUILD_DIR -type f | sort

echo ""
echo "🎯 Next steps for publication:"
echo "=============================="
echo "1. Upload $DIST_DIR/fields-autofill-v$VERSION.zip to Chrome Web Store"
echo "2. Upload privacy-policy.html to your website"
echo "3. Add the privacy policy URL to your Store listing"
echo "4. Create screenshots using test/test-form.html"
echo "5. Fill out store description using PUBLICATION_GUIDE.md"
echo ""
echo "✨ Build completed successfully!"
