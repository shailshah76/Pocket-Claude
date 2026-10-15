#!/bin/bash
# Install / remove Pocket Claude as a login item (launchd user agent) so the
# bridge starts whenever you log in and restarts if it crashes.
set -euo pipefail

LABEL="com.pocketclaude.bridge"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$HOME/.pocket-claude"
NODE="$(command -v node)"
CLAUDE_DIR="$(dirname "$(command -v claude 2>/dev/null || echo "$HOME/.local/bin/claude")")"

case "${1:-}" in
  install)
    [ -d "$DIR/web/dist" ] || { echo "Run 'npm run build' first."; exit 1; }
    mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
    cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$DIR/node_modules/tsx/dist/cli.mjs</string>
    <string>$DIR/server/index.ts</string>
  </array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$(dirname "$NODE"):$CLAUDE_DIR:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key><string>$HOME</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG_DIR/bridge.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/bridge.log</string>
</dict>
</plist>
PLIST
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
    echo "Installed. Logs: $LOG_DIR/bridge.log"
    ;;
  uninstall)
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Removed."
    ;;
  restart)
    launchctl kickstart -k "gui/$(id -u)/$LABEL"
    echo "Restarted."
    ;;
  status)
    launchctl print "gui/$(id -u)/$LABEL" 2>/dev/null | grep -E "state|pid" || echo "Not installed."
    ;;
  *)
    echo "usage: $0 install|uninstall|restart|status"; exit 1;;
esac
