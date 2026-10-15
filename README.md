# Pocket Claude

**Use Claude Code on your Mac from your phone.** Start a task, watch Claude work, approve or deny what it wants to do, and read its changes, from anywhere.

Your Mac does the actual work. Your phone is the remote control. The connection is private between your own devices: nothing is put on the public internet, and you don't need a website or domain.

**Downloads:** [Android app](https://github.com/shailshah76/Pocket-Claude/releases/latest/download/PocketClaude-Android.apk) · [iPhone app (advanced)](https://github.com/shailshah76/Pocket-Claude/releases/latest/download/PocketClaude-iOS-unsigned.ipa) · [All releases](https://github.com/shailshah76/Pocket-Claude/releases)

---

## What you need

- **A Mac** (macOS 13 or newer). It has to be **on and awake** whenever you use the app.
- **A paid Claude plan**: Pro, Max, Team or Enterprise. The free plan doesn't include Claude Code.
- **An Android phone or an iPhone.**
- **About 20 minutes** for the one-time setup.

You'll install three free things: **Node.js**, **Claude Code** and **Tailscale**. Tailscale is what securely links your phone to your Mac from any Wi-Fi or mobile network.

---

## Part 1: Set up your Mac (one time)

### Step 1: Open Terminal

Press **⌘ Command + Space**, type **Terminal**, and press **Return**. A window with text appears.

> Whenever this guide says **"run"**, copy the line shown, paste it into Terminal (**⌘ + V**), and press **Return**. Wait until it finishes before running the next one.

### Step 2: Install Node.js

1. Go to **[nodejs.org](https://nodejs.org)** and download the **LTS** version for macOS.
2. Open the downloaded file and click **Continue** through the installer.

### Step 3: Install Claude Code and sign in

1. Run:
   ```
   curl -fsSL https://claude.ai/install.sh | bash
   ```
2. **Close Terminal and open it again** (⌘ + Q, then Step 1).
3. Run:
   ```
   claude
   ```
   A browser window opens. Sign in with your Claude account and approve.
4. Back in Terminal, type `/exit` and press **Return**.

### Step 4: Install Tailscale on your Mac

1. Download Tailscale from **[tailscale.com/download](https://tailscale.com/download)** (or the Mac App Store) and open it.
2. Click **Log in** and sign in. Using your Google, Apple or Microsoft account is easiest. **Remember which account you used.**
3. If your Mac asks to allow a VPN configuration, click **Allow**.

### Step 5: Turn on two Tailscale settings

1. Open **[login.tailscale.com/admin/dns](https://login.tailscale.com/admin/dns)** and sign in with the same account.
2. Make sure **MagicDNS** is **enabled**.
3. Scroll to **HTTPS Certificates** and click **Enable**.

### Step 6: Download and start Pocket Claude

1. Run:
   ```
   git clone https://github.com/shailshah76/Pocket-Claude.git ~/pocket-claude
   ```
   If a pop-up asks to install **command line developer tools**, click **Install**, wait for it to finish, then run the line again.
2. Run:
   ```
   cd ~/pocket-claude && npm install && npm run onboard
   ```

This takes a few minutes. A **"Connect your phone"** page opens in your browser. It tells you if anything still needs doing (for example, a one-click **Enable** in Tailscale), and then shows a big **QR code** and a **setup code** like `AB12-CD34`. **Leave Terminal open** until the QR code appears, then set up your phone.

> Need the QR code again later, for example to add another phone? Run `cd ~/pocket-claude && npm run qr`.

Pocket Claude now runs in the background and starts automatically whenever you log in to your Mac.

> If macOS asks whether **node** may access your Desktop, Documents or other folders, click **Allow**. Otherwise Claude can't work in those folders.

---

## Part 2: Set up your phone

First, on **every** phone:

1. Install **Tailscale** from the **Play Store** (Android) or **App Store** (iPhone).
2. Sign in with the **same account** you used on the Mac, and switch it **on**.

Then follow the steps for your phone.

### Android

1. On your phone, open the **[Android app download](https://github.com/shailshah76/Pocket-Claude/releases/latest/download/PocketClaude-Android.apk)**.
2. Open the downloaded **PocketClaude-Android.apk**.
   - If Android says your browser **isn't allowed to install apps**, tap **Settings**, turn on **Allow from this source**, and go back.
   - If **Play Protect** warns about an unknown app, tap **More details → Install anyway**. Pocket Claude isn't on the Play Store, so this warning is expected.
3. Open **Pocket Claude** and tap **Scan QR code**. Point the camera at the QR code on your Mac.
4. **Choose a PIN** (6 to 12 digits) and enter it again to confirm.

You're in. You'll see your Claude sessions, including ones started on your Mac.

### iPhone: web app (easiest, recommended)

1. Open the **Camera** app and point it at the QR code on your Mac. Tap the link that appears.
2. Safari opens Pocket Claude with the setup code already filled in. **Choose a PIN** and confirm it.
3. Tap the **Share** button (square with an arrow), then **Add to Home Screen**.
4. Open Pocket Claude **from your Home Screen**, tap ⚙︎ **Settings**, then **Turn on notifications** to get alerts when Claude needs you.

### iPhone: native app (advanced, experimental)

Apple only lets you install apps from outside the App Store if you sign them yourself. That needs a computer, a USB cable and your free Apple ID, and **you have to repeat it every 7 days**. If that sounds like a hassle, use the web app above.

1. On your Mac, download the **[iPhone app (.ipa)](https://github.com/shailshah76/Pocket-Claude/releases/latest/download/PocketClaude-iOS-unsigned.ipa)** and install **[Sideloadly](https://sideloadly.io)**.
2. Connect your iPhone to the Mac with a cable and tap **Trust** on the iPhone if it asks.
3. Open Sideloadly, drag the `.ipa` file into it, enter your Apple ID, and click **Start**.
4. On the iPhone, open **Settings → General → VPN & Device Management**, tap your Apple ID, and tap **Trust**.
5. If iPhone asks for it, turn on **Settings → Privacy & Security → Developer Mode** and restart.
6. Open Pocket Claude, tap **Scan QR code**, and choose a PIN.

---

## Part 3: Using Pocket Claude

- **Start something new:** tap **New session**, pick a folder (tap folders, or type `cd foldername` in the dark box), describe what you want, and tap **Start**.
- **Approve or deny:** before Claude runs a command or edits a file, a card shows exactly what it wants to do, including the changes, highlighted. Tap **Allow** or **Deny**. Tap **Deny with a note…** to tell Claude what to do instead.
- **Pick up a session from your Mac:** tap it on the home screen and type a message.
  - **Continue** carries on in the same session.
  - **Fork a copy** starts a separate copy. Use this if the session might still be open in Terminal on your Mac.
- **How careful Claude should be:** tap the chip above the message box to switch modes.
  - **Ask before acting** (safest).
  - **Auto-accept edits** (file edits go through without asking; commands still ask).
  - **Plan mode** (Claude writes a plan for you to approve first).
- **See what changed:** tap any **Edit** or **Run** card to expand it, or ⋯ → **Browse files**.
- **Stop Claude:** tap the **■** button next to the message box.
- **Back at your Mac:** ⋯ → **Copy terminal resume command**, then paste it into Terminal.

Usage meters at the top of the home screen show how much of your Claude plan's 5-hour and weekly limits you've used.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| **"Can't reach your computer"** | The Mac is asleep, or Tailscale is off on the Mac or the phone. Wake the Mac and check that Tailscale is on (and signed into the same account) on both. |
| **Onboarding says Tailscale isn't connected** | Open Tailscale on the Mac and log in, then run `cd ~/pocket-claude && npm run onboard` again. |
| **Onboarding stuck at step 4 (Tailscale)** | Tailscale is waiting for you to enable **Serve**. Click **Enable in Tailscale** on the "Connect your phone" page (or open the `login.tailscale.com/f/serve…` link in Terminal). Setup then continues by itself. |
| **Onboarding says `tailscale serve` failed** | Turn on **HTTPS Certificates** (Part 1, Step 5) and run onboarding again. |
| **"Claude Code is not signed in"** | Run `claude`, sign in, type `/exit`, and run onboarding again. |
| **The setup code doesn't work** | Use the newest code shown in Terminal. Run `npm run onboard` again to see it. |
| **Forgot your PIN** | On the Mac, run `cd ~/pocket-claude && npm run setup` and choose a new PIN. All phones will need to sign in again. |
| **"macOS blocked access to …"** | Open **System Settings → Privacy & Security → Full Disk Access**, click **+**, press **⌘ + Shift + G**, paste the path printed by `which node`, and add it. Then run `cd ~/pocket-claude && npm run service:restart`. |
| **Mac keeps sleeping** | **System Settings → Battery → Options → Prevent automatic sleeping when the display is off** (works while plugged in). |
| **iPhone app stopped opening** | The 7-day signature expired. Repeat the Sideloadly steps. |
| **No notifications on iPhone** | They only work in the web app opened from the **Home Screen** (iOS 16.4 or newer). |

Android app: notifications only arrive while the app is open (the phone vibrates when Claude needs approval).

To **remove** Pocket Claude from the Mac, run `cd ~/pocket-claude && npm run service:uninstall`, then delete the `pocket-claude` folder and the hidden `~/.pocket-claude` folder.

---

## For developers

### How it works

```
Phone app / web app ──HTTPS + WebSocket over Tailscale──▶ tailscale serve ──▶ bridge (127.0.0.1:7878) ──▶ Claude Agent SDK
```

| Folder | What it is |
|---|---|
| `server/` | Bridge server (Node, Fastify, WebSocket) that runs Claude Code sessions through `@anthropic-ai/claude-agent-sdk` |
| `web/` | Installable web app (React + Vite PWA) with web push |
| `mobile/` | Native app (React Native + Expo SDK 57) for Android and iOS |
| `shared/` | Wire-protocol types shared by all three |

### Commands (repo root)

| Command | What it does |
| --- | --- |
| `npm run onboard` | Guided setup: checks, build, background service, Tailscale, QR code |
| `npm run qr` | Open the "Connect your phone" page (QR code), only on this Mac |
| `npm run setup` | Change the PIN or default folder from the terminal |
| `npm run build` | Rebuild the web app |
| `npm run dev` | Bridge with reload + Vite at http://127.0.0.1:5173 |
| `npm run service:install` / `:uninstall` / `:restart` / `:status` | Manage the launchd background service |

Logs: `~/.pocket-claude/bridge.log`. Config, hashed PIN, tokens and push keys: `~/.pocket-claude/config.json` (mode 600).

### Building the Android APK

```bash
brew install openjdk@17 && brew install --cask android-commandlinetools
sdkmanager --sdk_root=$HOME/Library/Android/sdk "platform-tools" "platforms;android-36" "build-tools;36.0.0"
cd mobile && npm install
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ANDROID_HOME=$HOME/Library/Android/sdk npm run build:apk
# → mobile/android/app/build/outputs/apk/release/app-release.apk
```

Release builds are signed with a private upload key when `POCKET_CLAUDE_UPLOAD_STORE_FILE`, `…_STORE_PASSWORD`, `…_KEY_ALIAS` and `…_KEY_PASSWORD` are set in `~/.gradle/gradle.properties` (see `mobile/plugins/with-release-signing.js`). Otherwise they fall back to the debug key. Testing over USB without Tailscale: `adb reverse tcp:7878 tcp:7878`, then connect the app to `localhost:7878`.

### Building the iOS app

`.github/workflows/ios-ipa.yml` builds an **unsigned** `.ipa` on GitHub's macOS runners (Xcode 26.4+) and attaches it to each published Release. You can also run it by hand from the **Actions** tab. Users sign it at install time (Sideloadly or AltStore). For TestFlight or the App Store you need an Apple Developer account and signing set up through EAS or Xcode.

### Security model

- The bridge listens on `127.0.0.1` only. Phones reach it solely through `tailscale serve`, so only your own Tailscale devices can connect.
- **First-run setup:** setup requires a one-time code shown only in the Mac's terminal.
- **PIN:** stored as a scrypt hash. Repeated wrong PINs trigger an escalating lockout.
- **Sign-in tokens:** 30-day tokens, kept in an HttpOnly SameSite=Strict cookie (web) or the device's secure storage (app).
- **Same-origin checks:** state-changing requests and the WebSocket must come from the same origin.
- **File access:** folder browsing and file viewing are limited to your home folder. Claude itself has the same permissions as in your terminal, which is what the approval prompts are for.
