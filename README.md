# Citizen Health

**A private, read-only Star Citizen crash and player-history companion.**

Citizen Health turns locally selected game diagnostics into evidence-based crash findings, a redacted support summary, and an optional local history of confirmed sessions, combat events, and shop purchases.

## Highlights

- **Private by design** — no injection, game-memory access, input automation, network capture, uploads, telemetry, or automatic filesystem scanning.
- **Evidence before advice** — crash findings identify the triggering log evidence and state confidence rather than guessing.
- **Local player history** — optionally retain confirmed sessions, direct kills/deaths, recent attackers, and confirmed shop purchases in this browser on this PC.
- **Safe sharing** — export a minimal redacted report or copy a readable support summary; raw logs, paths, binary dumps, and unrelated log text are excluded.
- **No runtime dependencies** — a small local web app that binds only to `127.0.0.1`.

> **Status:** Early MVP, not a diagnostic authority. Star Citizen logging changes over time; unknown results remain unknown rather than blaming a player's PC.

## Quick start

1. Double-click `Start-Citizen-Health.cmd` on this development PC.
2. Open the local address it launches (`http://127.0.0.1:4173`).
3. Select `Game.log` and any optional supporting diagnostics, then choose **Analyze selected files**.
4. For temporary live monitoring, explicitly choose the Star Citizen `LIVE` folder and enable monitoring while the tab is open.

Do not open `index.html` directly: browsers may render the page without executing its local analysis code.

## Safety and privacy

Citizen Health reads only `.log`, `.txt`, `.json`, and `.xml` text files at or below 25 MB. Binary dumps, executables, archives, and oversized files are ignored and never exported.

- Folder selection is explicit, read-only, and held only in page memory.
- Monitoring checks only the current `Game.log` (or newest backup) every 15 seconds while the page remains open. An optional selected launcher folder contributes only `log.log`.
- **Forget selected folders** immediately stops monitoring and clears folder access from the tab.
- Local history is off by default and can be deleted from the app at any time.
- The local server is restricted to `127.0.0.1`; the browser security policy blocks outbound connections.

See [SECURITY.md](SECURITY.md) for the enforceable product policy.

## Features

### Crash and performance analysis

Analyze `Game.log`, RSI Launcher logs, crash-handler text, and optional DxDiag. Current evidence rules cover:

- controlled client shutdowns;
- CryEngine watchdog and fatal statuses;
- explicit memory/pagefile pressure;
- graphics-device or rendering-API failures;
- damaged or missing game data;
- access violations; and
- connection or server-session symptoms.

Every result includes supporting lines, a confidence level, a conservative next step, and official remediation guidance. If no supported signature is present, the report explains what was analyzed and which optional inputs could improve coverage.

### Redacted support sharing

The app creates a minimal JSON export and a copyable support summary. Both include findings and relevant session/DxDiag context, but intentionally exclude complete source logs, source paths, binary dumps, and unrecognized raw data.

### Live local monitoring

When enabled for a user-selected `LIVE` folder, Citizen Health displays in-app notices for a confirmed session start, disconnect, normal exit, or recognized crash signature. It does not request operating-system notification permission and never runs as a background service.

### Session and combat history

The session timeline includes only confirmed gameplay entry, in-game disconnects, and application-exit markers. It does not infer missions, locations, actions, or causes from ambiguous log content.

When local history is enabled, Citizen Health stores up to 100 compact session records. A session can retain up to 25 direct `Actor Death` events, including the recorded killer or victim name, weapon, and damage type. The combat view offers All, Deaths, and Kills filters plus a local recent-attacker summary. It does not infer incapacitations or unrecorded combat events.

### Confirmed shop purchases

Citizen Health records a purchase only when `Game.log` contains both a shop buy request and a nearby **Transaction Complete** notification. The local record can include timestamp, shop, item, quantity, total price, and currency. Cargo transfers and shipping are currently excluded because available log evidence is not yet reliable enough to distinguish true transfers from loading-platform noise.

## Run and test

Requires Node.js 20 or newer.

```powershell
npm start
```

```powershell
npm test
```

## Releases

The MVP version appears in the footer and every redacted export/support summary. Before publishing, follow [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) to verify the safety boundary, redaction behavior, test suite, and dependency-free runtime.
