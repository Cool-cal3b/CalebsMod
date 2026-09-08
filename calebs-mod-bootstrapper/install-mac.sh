#!/bin/bash
#
# CalebsMod installer for macOS - the way in that Gatekeeper does not gate.
#
# This does what calebs-mod-bootstrapper does on darwin (ask the API for the
# latest release, download it, verify it, put the bundle in ~/Applications,
# launch it), but as a shell script instead of an .app.
#
# Why it exists: the bootstrapper .app is only ad-hoc signed, so a friend who
# downloads it gets stopped by Gatekeeper on first open, and the "Open Anyway"
# button moved into System Settings in macOS 15 - several steps of remote
# hand-holding, every time, for every new friend. Gatekeeper gates bundles
# launched through LaunchServices; it does not gate a script the user runs in
# Terminal. So this path has no prompt to get past at all.
#
# Nothing it installs is quarantined either. The quarantine attribute is set by
# the receiving app - browsers, Mail, AirDrop - not by the OS, and curl does not
# set it. So the client bundle this drops into ~/Applications opens with no
# warning too, for the same reason the bootstrapper's downloads do.
#
# Friends run it either way round:
#
#     curl -fsSL https://mc.calebwash.com/install.sh | bash
#     bash ~/Downloads/install-calebsmod-mac.sh
#
# Not by double-clicking: Finder opens a .sh in a text editor, and renaming it
# to .command would put it back under Gatekeeper, which is the thing being
# avoided.
#
# EVERYTHING BELOW LIVES IN A FUNCTION, called on the last line. That is what
# makes the piped form above safe: bash executes a pipe as it arrives, so a
# connection dropped mid-transfer would otherwise run half a script - and the
# half that installs is a pair of mv's that can leave a friend with no client at
# all. Definitions are inert, so a truncated download runs nothing. Keep it that
# way: no work at the top level.
#
# Keep this in step with calebs-mod-bootstrapper.go and platform.go. The paths,
# the version-file name and the staging layout are shared with them, and a
# friend may well run both - if the two disagree, each will reinstall over the
# other forever.
set -euo pipefail

SERVER_URL="https://mc.calebwash.com"
VERSION_ENDPOINT="/api/server/latest-client-release?platform=mac"

# Mirrors platform.go: the bundle has to live in an Applications folder to be
# launchable and Spotlight-indexed, and ~/Applications is the one that needs no
# admin rights. State stays under ~/Library, so unlike Windows these are two
# different directories.
INSTALL_DIR="$HOME/Applications"
DATA_DIR="$HOME/Library/Application Support/CalebsMod"
APP_NAME="CalebsModClient.app"
APP_PATH="$INSTALL_DIR/$APP_NAME"
VERSION_FILE="$DATA_DIR/CurrentCalebModClientVersion.txt"

# Staging sits beside the install target rather than in the data directory, so
# the move that installs the bundle stays within one directory and therefore one
# volume. Same reason as performUpdate().
STAGING_NAME=".calebsmod-update"
STAGING_DIR="$INSTALL_DIR/$STAGING_NAME"

# A release smaller than this is a truncated download or an error page, never a
# real Wails build. Matches MinReleaseZipBytes.
MIN_RELEASE_BYTES=$((1024 * 1024))

# ---------------------------------------------------------------------------

# Pulls one string field out of the release JSON.
#
# Not jq (not on a stock Mac), not python3 (/usr/bin/python3 is a stub that
# prompts to install the Xcode command line tools, exactly the kind of detour
# this script exists to avoid), not plutil (its "-extract ... raw" output has not
# behaved the same across the macOS versions friends are actually on). The
# payload is three flat string fields; a regex needs nothing and cannot prompt
# for anything.
json_field() {
    local field="$1" json="$2" match
    match=$(printf '%s' "$json" | grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" || true)
    [ -n "$match" ] || return 0
    # Strip to the first colon - the separator after the field name, never one
    # from inside the value, since the value still has its quotes on here.
    printf '%s' "${match#*:}" | sed -e 's/^[[:space:]]*"//' -e 's/"$//'
}

# Reports whether a usable client is already installed. An .app is a directory,
# so the check has to move inside the bundle to the executable it must contain -
# stat'ing the bundle itself would measure a directory entry and tell us
# nothing. This is the check a bundle unpacked by the wrong tool fails.
client_is_installed() {
    local candidate
    [ -d "$APP_PATH" ] || return 1
    for candidate in "$APP_PATH/Contents/MacOS/"*; do
        if [ -f "$candidate" ] && [ -x "$candidate" ]; then
            return 0
        fi
    done
    return 1
}

# Deletes the scratch a previous run or a client self-update left behind. The
# ".old" sweep is the important half: the client's self-updater renames its own
# running bundle aside and cannot delete it from under itself, so something has
# to collect it later or a friend accumulates one stale copy per release. Both
# directories are swept because they are only the same folder on Windows.
sweep_leftovers() {
    local dir entry
    rm -rf "$STAGING_DIR" "$DATA_DIR/$STAGING_NAME"
    for dir in "$INSTALL_DIR" "$DATA_DIR"; do
        for entry in "$dir"/*.old; do
            if [ -e "$entry" ]; then
                rm -rf "$entry"
            fi
        done
    done
}

launch_client() {
    # "open -n" rather than exec: an .app is a directory and cannot be executed
    # directly, and going through LaunchServices is also what gives it a dock
    # icon and focus.
    #
    # A failure here is not an install failure - the client is on disk and can
    # be opened by hand - so it must not propagate, or the exit trap would tell
    # a friend whose install just succeeded that it failed.
    if ! open -n "$APP_PATH"; then
        echo "Warning: could not launch the client automatically."
        echo "Open it yourself from: $APP_PATH"
        return 0
    fi
    echo "Client launched."
    echo
    echo "Next time you can skip this script - press Cmd+Space and type"
    echo "\"calebsmod\", or open $APP_PATH"
}

# Runs on every exit. On failure it falls back to whatever client is already
# installed, so a server outage or a bad release leaves a friend able to play
# rather than stranded - the same fallback the bootstrapper makes.
cleanup() {
    local code=$?
    rm -rf "$STAGING_DIR" 2>/dev/null || true

    if [ "$code" -ne 0 ]; then
        echo
        echo "Install failed."
        if client_is_installed; then
            echo "Launching the client you already have..."
            open -n "$APP_PATH" 2>/dev/null || true
        else
            echo "Send Caleb everything above and he can work out what happened."
        fi
    fi
    return "$code"
}

# ---------------------------------------------------------------------------

main() {
    echo "=== Caleb's Mod Client Installer ==="
    echo

    if [ "$(uname -s)" != "Darwin" ]; then
        echo "Error: this installer is for macOS." >&2
        echo "On Windows, run CalebsModBootstrapper.exe instead." >&2
        exit 1
    fi

    # Every path above hangs off $HOME, and some of them are handed to rm -rf.
    # An empty HOME would silently rebase those onto /Applications and /Library,
    # so it is checked before anything uses them rather than assumed. "set -u"
    # catches unset but not set-and-empty.
    if [ -z "${HOME:-}" ] || [ ! -d "$HOME" ]; then
        echo "Error: HOME is not set to a real directory - cannot work out where to install." >&2
        exit 1
    fi

    trap cleanup EXIT

    mkdir -p "$INSTALL_DIR" "$DATA_DIR"
    sweep_leftovers

    local current_version="0.00"
    if [ -f "$VERSION_FILE" ]; then
        current_version=$(tr -d '[:space:]' < "$VERSION_FILE")
        [ -n "$current_version" ] || current_version="0.00"
    fi

    echo "Installed version: $current_version"
    echo "Checking for updates..."

    local release_json latest_version download_url expected_sha
    release_json=$(curl -fsSL --max-time 30 "$SERVER_URL$VERSION_ENDPOINT")

    latest_version=$(json_field version "$release_json")
    download_url=$(json_field downloadUrl "$release_json")
    # Optional: releases published before the server emitted a digest have none,
    # and those fall back to the size check alone.
    expected_sha=$(json_field sha256 "$release_json")

    if [ -z "$latest_version" ] || [ -z "$download_url" ]; then
        echo "Error: the server returned an incomplete release:" >&2
        echo "$release_json" >&2
        exit 1
    fi

    echo "Latest version:    $latest_version"
    echo

    # Any difference installs, not just a higher number: this is the "make my
    # install match the server" tool, so it has to carry a rollback down as
    # readily as an update up.
    if [ "$current_version" = "$latest_version" ] && client_is_installed; then
        echo "You are on the latest version."
        launch_client
        exit 0
    fi

    if [ "$current_version" = "$latest_version" ]; then
        echo "Version is current but the client is missing - reinstalling..."
    else
        echo "Installing $current_version -> $latest_version"
    fi
    echo

    mkdir -p "$STAGING_DIR"
    local zip_path="$STAGING_DIR/client.zip"
    local extract_dir="$STAGING_DIR/extracted"

    echo "Step 1/4: Downloading (a few hundred MB - this is the slow part)..."
    curl -fL --progress-bar --max-time 1800 -o "$zip_path" "$download_url"

    echo
    echo "Step 2/4: Verifying..."
    local zip_bytes
    zip_bytes=$(stat -f%z "$zip_path")
    if [ "$zip_bytes" -lt "$MIN_RELEASE_BYTES" ]; then
        echo "Error: the download is only $zip_bytes bytes - truncated, or an error page." >&2
        exit 1
    fi

    if [ -n "$expected_sha" ]; then
        local actual_sha
        actual_sha=$(shasum -a 256 "$zip_path" | awk '{print $1}' | tr 'A-F' 'a-f')
        expected_sha=$(printf '%s' "$expected_sha" | tr 'A-F' 'a-f')
        if [ "$actual_sha" != "$expected_sha" ]; then
            echo "Error: checksum mismatch." >&2
            echo "  expected $expected_sha" >&2
            echo "  got      $actual_sha" >&2
            exit 1
        fi
        echo "Checksum OK."
    else
        echo "(server published no checksum for this release; size checked only)"
    fi

    echo
    echo "Step 3/4: Extracting..."
    mkdir -p "$extract_dir"
    # ditto, not unzip: an .app contains symlinks and depends on the executable
    # bit surviving, and unzip restores neither reliably. The wrong tool here
    # produces no error and a client that will not launch.
    /usr/bin/ditto -x -k "$zip_path" "$extract_dir"

    # The release is packed with --keepParent, so the bundle is the top-level
    # entry. The second glob tolerates the extra wrapping folder some zip tools
    # introduce.
    local app_src="" candidate
    for candidate in "$extract_dir"/*.app "$extract_dir"/*/*.app; do
        if [ -d "$candidate" ]; then
            app_src="$candidate"
            break
        fi
    done

    if [ -z "$app_src" ]; then
        echo "Error: no .app found in the downloaded release." >&2
        exit 1
    fi

    echo
    echo "Step 4/4: Installing to $APP_PATH..."

    # Move the current install aside rather than writing over it, and put it back
    # if the install fails - an interrupted copy over a live bundle would leave a
    # friend with neither the old client nor the new one.
    local old_path="$APP_PATH.old" displaced=0
    rm -rf "$old_path"
    if [ -e "$APP_PATH" ]; then
        displaced=1
        mv "$APP_PATH" "$old_path"
    fi

    if ! mv "$app_src" "$APP_PATH"; then
        if [ "$displaced" -eq 1 ]; then
            mv "$old_path" "$APP_PATH" || \
                echo "Error: install failed and the old client is stranded at $old_path" >&2
        fi
        echo "Error: could not install the new client." >&2
        exit 1
    fi
    # macOS deletes a bundle that is currently executing quite happily, so unlike
    # Windows there is nothing here to leave behind and warn about.
    rm -rf "$old_path"

    printf '%s' "$latest_version" > "$VERSION_FILE"

    echo
    echo "Done - version $latest_version is installed."
    echo "Game data lives in $DATA_DIR"
    echo
    launch_client
}

main "$@"
