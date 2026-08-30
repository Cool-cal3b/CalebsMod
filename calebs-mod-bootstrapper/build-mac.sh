#!/bin/bash
#
# Builds the macOS bootstrapper: a universal binary wrapped in a double-
# clickable .app, zipped for distribution.
#
# The Windows sibling of this script is build.ps1. Run this on macOS - the
# `lipo` and `ditto` steps need it, and building here is also what gets the
# binary ad-hoc signed by Go's linker, without which Apple Silicon refuses to
# execute it at all.
#
# Usage: ./build-mac.sh
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/dist"
APP_NAME="CalebsMod Installer"
BINARY_NAME="CalebsModBootstrapper"

# Everything that ships is assembled in one staging folder, so the zip is
# simply that folder and cannot accidentally include build scratch.
PAYLOAD_NAME="CalebsMod Installer (Mac)"
PAYLOAD_DIR="$OUTPUT_DIR/$PAYLOAD_NAME"
APP_DIR="$PAYLOAD_DIR/$APP_NAME.app"
ZIP_PATH="$OUTPUT_DIR/CalebsModBootstrapper-mac.zip"

echo "=== Building Caleb's Mod Bootstrapper (macOS) ==="
echo

if ! command -v go >/dev/null 2>&1; then
    echo "Error: Go is not installed or not in PATH" >&2
    echo "Install it from: https://golang.org/dl/" >&2
    exit 1
fi

echo "Go version: $(go version)"
echo

rm -rf "$OUTPUT_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"

# One universal binary rather than two downloads: friends on Intel Macs and on
# Apple Silicon get the same artifact, and neither has to work out which.
echo "Building darwin/amd64..."
CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 \
    go build -ldflags="-s -w" -o "$OUTPUT_DIR/$BINARY_NAME-amd64" .

echo "Building darwin/arm64..."
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 \
    go build -ldflags="-s -w" -o "$OUTPUT_DIR/$BINARY_NAME-arm64" .

echo "Merging into a universal binary..."
lipo -create -output "$APP_DIR/Contents/MacOS/$BINARY_NAME" \
    "$OUTPUT_DIR/$BINARY_NAME-amd64" \
    "$OUTPUT_DIR/$BINARY_NAME-arm64"
rm "$OUTPUT_DIR/$BINARY_NAME-amd64" "$OUTPUT_DIR/$BINARY_NAME-arm64"
chmod +x "$APP_DIR/Contents/MacOS/$BINARY_NAME"

# The bootstrapper reports progress on stdout, and an .app launched from Finder
# has nowhere to print. So the bundle's actual entry point is this shim, which
# hands the real binary to Terminal - otherwise a friend double-clicks, sees
# nothing at all for the several minutes of the first download, and concludes
# it is broken.
cat > "$APP_DIR/Contents/MacOS/launcher" <<'SHIM'
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
open -a Terminal "$DIR/CalebsModBootstrapper"
SHIM
chmod +x "$APP_DIR/Contents/MacOS/launcher"

cat > "$APP_DIR/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundleDisplayName</key>
    <string>$APP_NAME</string>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIdentifier</key>
    <string>com.calebwash.calebsmod.installer</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
PLIST

# Escape hatch for the Gatekeeper prompt. A script run from Terminal is not
# gated the way a Finder launch is, so this always works even when the .app is
# refused - which is worth having, since the "Open Anyway" path moved in macOS
# 15 and is hard to talk someone through.
cat > "$PAYLOAD_DIR/Run in Terminal.command" <<CMD
#!/bin/bash
# If double-clicking the app is blocked by macOS, run this instead.
DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
exec "\$DIR/$APP_NAME.app/Contents/MacOS/$BINARY_NAME"
CMD
chmod +x "$PAYLOAD_DIR/Run in Terminal.command"

# Apple Silicon refuses to execute an arm64 binary carrying no signature at
# all. Go's linker ad-hoc signs each slice as it builds it, but the lipo above
# invalidates that - so without this the binary builds fine and is then killed
# on launch on any M-series Mac. Ad-hoc (`-s -`) is all that requirement needs;
# it is not a Developer ID and does not stop Gatekeeper asking on first open.
#
# Signed after the bundle is fully assembled, innermost first: signing the
# bundle seals its contents, so anything written afterwards would break the
# seal it just recorded.
echo "Ad-hoc signing..."
codesign --force --sign - --timestamp=none "$APP_DIR/Contents/MacOS/$BINARY_NAME"
codesign --force --sign - --timestamp=none "$APP_DIR"
codesign --verify --strict --verbose=2 "$APP_DIR"

# ditto, not zip: it is the only one that reliably round-trips a bundle's
# symlinks and executable bits. A bundle zipped with anything else extracts
# without error and then will not launch.
echo "Packaging..."
(cd "$OUTPUT_DIR" && ditto -c -k --sequesterRsrc --keepParent \
    "$PAYLOAD_NAME" "$ZIP_PATH")

echo
echo "=== Build Complete ==="
echo "App:  $APP_DIR"
echo "Zip:  $ZIP_PATH ($(du -h "$ZIP_PATH" | cut -f1))"
echo
echo "Next steps:"
echo "1. Test: open \"$APP_DIR\""
echo "2. Send the zip to friends - see INSTRUCTIONS_FOR_FRIENDS.txt"
