# Citizen Health

Citizen Health is an independent, read-only Star Citizen crash and performance companion. The MVP analyzes only files the user explicitly selects and turns diagnostic signatures into evidence-based findings, confidence levels, safe next steps, and a redacted local export.

## Safety boundary

- No process injection or game modification
- No game-memory access
- No input automation
- No network capture
- No upload or telemetry by default
- No automatic filesystem scanning; users choose every input

Only `.log`, `.txt`, `.json`, and `.xml` text files at or below 25 MB are read. Binary dumps, executables, archives, and oversized files remain untouched and are excluded from export.

See [SECURITY.md](SECURITY.md) for the enforceable product policy.

## Local monitoring

While the site is open, a player may explicitly choose their Star Citizen `LIVE` folder and enable local monitoring. Citizen Health then reads only the current `Game.log` (or newest backup if the current log is absent) every 15 seconds. Folder access is held in page memory only and ends when the page closes; the app does not install a background service, start with Windows, inspect game memory, or upload logs.

The first player-log view is a session timeline: confirmed gameplay entry, in-game disconnects, and application exit markers. It intentionally does not infer player actions, missions, locations, or causes that the logs do not establish.

## MVP scope

The first flow accepts `Game.log`, RSI Launcher logs, crash-handler text/bundles, and optional DxDiag. Initial rules cover controlled client exits, CryEngine watchdog/fatal statuses, explicit memory pressure, graphics device/API failures, damaged game data, access violations, and connection/server-session symptoms. Unknown results remain unknown rather than blaming the user's PC.

The redacted export is JSON so users can inspect it before sharing. It contains the diagnosis, session/DxDiag context, and redacted triggering lines only—not full source logs or other raw input. Binary `.dmp` / `.mdmp` files are deliberately excluded: this MVP does not attempt to inspect or distribute crash dumps. When an optional DxDiag text file is selected, Citizen Health displays only a compact OS/CPU/GPU/RAM/driver snapshot; it does not infer that hardware is the cause.

## Run locally

Requires Node.js 20 or newer.

On this development PC, the simplest option is to double-click `Start-Citizen-Health.cmd`. It starts the local-only site and opens the correct browser address. Do not open `index.html` directly: browsers may render the page without running its local analysis code.

```powershell
npm start
```

Open `http://127.0.0.1:4173`. The server binds only to the local machine and the app's security policy blocks outbound connections.

## Test

```powershell
npm test
```

## Status

Early scaffold—not yet a diagnostic authority. Rules and remediation links require versioned review as Star Citizen changes.
