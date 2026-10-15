# Pocket Claude

Chat with Claude Code on your computer from your phone. There's a native Android app (`mobile/`, React Native + Expo) and an installable web app for iPhone and Android (`web/`). Both talk to a small bridge server on your computer (`server/`), which drives Claude Code through the official Agent SDK and your existing Claude login.

- **Start sessions in any folder.** Browse with `cd` / `ls`; no repo needed.
- **Continue or fork sessions** you started in the Mac terminal.
- **Approve or deny** commands and edits from your phone, answer Claude's multiple-choice questions, and approve plans.
- **Diffs and a file viewer** for what Claude changed.
- **Push notifications** when Claude needs you or finishes.
- **PIN login** on top of Tailscale. Nothing is exposed to the public internet, and you don't need a domain.

```
Phone (PWA) ──HTTPS/WebSocket over Tailscale──▶ tailscale serve ──▶ bridge (127.0.0.1:7878) ──▶ Claude Agent SDK
```

## Setup (one time)

**On the computer** (macOS; needs Node 20+ and Claude Code installed and signed in):

```bash
git clone <this repo> pocket-claude && cd pocket-claude
npm install
npm run onboard
```

`onboard` checks the prerequisites, builds everything, starts the bridge as a login service, exposes it with `tailscale serve`, and prints a **QR code plus a one-time setup code**.

**Tailscale** connects the phone to the computer from any network, with no domain and no open ports:
- Computer: `brew install --cask tailscale` (or https://tailscale.com/download), then sign in.
- Phone: install Tailscale from the Play Store or App Store, and sign in with the **same account**.
- In the admin console's [DNS page](https://login.tailscale.com/admin/dns), turn on **MagicDNS** and **HTTPS Certificates**.
- Re-run `npm run onboard` after installing Tailscale.

**On the phone**, pick one:

| | Android app (APK) | Web app (Android or iPhone) |
|---|---|---|
| Get it | Install `PocketClaude.apk` (see *Building the APK*) | Open the `https://…ts.net` address from `onboard` |
| Connect | Tap **Scan QR code** | Scanning the QR opens it with the code filled in |
| Then | Choose a PIN | Choose a PIN → Add to Home Screen |
| Background notifications | Not in this version (in-app vibration only) | Yes (turn on in Settings) |

## Building the APK

```bash
cd mobile
npm install
npm run build:apk     # needs JDK 17 + Android SDK (see below)
# → mobile/android/app/build/outputs/apk/release/app-release.apk
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Toolchain on macOS: `brew install openjdk@17 && brew install --cask android-commandlinetools`, then
`sdkmanager --sdk_root=$HOME/Library/Android/sdk "platform-tools" "platforms;android-36" "build-tools;36.0.0"`,
and build with `JAVA_HOME=/opt/homebrew/opt/openjdk@17 ANDROID_HOME=$HOME/Library/Android/sdk`.
The release build is signed with the debug key, which is fine for sideloading. Use your own keystore before sharing it widely.

## Day to day

- **Mac asleep = unreachable.** The app shows "Can't reach your Mac" and reconnects by itself once the Mac wakes. To keep it reachable while plugged in, run `caffeinate -s` in a terminal, or set *System Settings → Battery → Options → Prevent automatic sleeping when the display is off* (on power adapter).
- **Testing over USB, without Tailscale (Android):** `adb reverse tcp:7878 tcp:7878`, then connect the app to `localhost:7878`.
- **Continue vs. Fork.** When you open a session from your terminal, *Continue* picks up the same session and *Fork a copy* branches it. If the session might still be open in a terminal, fork it; Pocket Claude preselects Fork when the session was active in the last 15 minutes.
- **Permission modes.** *Ask* prompts you for each action, *Auto-edit* accepts file edits automatically, and *Plan* has Claude plan before touching anything. Tap the mode chip above the message box to cycle through them.
- **Back at your Mac?** Session menu (⋯) → *Copy terminal resume command* gives you `claude --resume <id>`.
- Phone sessions go idle and close after 30 minutes without activity. They're saved and can be resumed any time.

## Commands

| Command | What it does |
| --- | --- |
| `npm run onboard` | Guided setup: checks, build, service, Tailscale, QR code |
| `npm run setup` | Change the PIN or default folder in the terminal (changing the PIN signs out every phone) |
| `npm run build` | Rebuild the phone app after editing `web/` |
| `npm run dev` | Dev mode: bridge with reload + Vite at http://127.0.0.1:5173 |
| `npm run service:install` / `:uninstall` / `:restart` / `:status` | Manage the background service |

Logs are in `~/.pocket-claude/bridge.log`. Config, hashed PIN, sign-in tokens and push keys are in `~/.pocket-claude/config.json` (mode 600).

## Security model

- The bridge listens on `127.0.0.1` only. The phone reaches it solely through `tailscale serve`, so it's limited to your own tailnet devices.
- A 6–12 digit PIN, stored as a scrypt hash, issues a 30-day HttpOnly, SameSite=Strict cookie. Repeated wrong PINs trigger an escalating lockout.
- Requests that change state, and the WebSocket, must come from the same origin.
- Folder browsing and file viewing are limited to your home folder, with symlinks resolved. Claude itself has the same permissions as in your terminal, which is what the approval prompts are for.
- Everything runs on your Claude Pro/Max login and counts toward the same usage limits. The 5-hour and weekly meters appear on the home screen.

## Troubleshooting

- **"macOS blocked access to …/Desktop"**: when the bridge runs as a service, macOS privacy rules may block Node from reading Desktop or Documents. Add the Node binary (`which node`) under *System Settings → Privacy & Security → Full Disk Access*, then run `npm run service:restart`.
- **No notifications on iPhone**: they only work from the home-screen app (iOS 16.4+), over `https://`.
- **Wrong PIN lockout**: wait it out, or restart the bridge (`npm run service:restart`).
