# Citizen Health

Citizen Health is an independent, read-only Star Citizen crash and performance companion. The MVP analyzes only files the user explicitly selects and turns diagnostic signatures into evidence-based findings, confidence levels, safe next steps, and a redacted local export.

## Safety boundary

- No process injection or game modification
- No game-memory access
- No input automation
- No network capture
- No upload or telemetry by default
- No automatic filesystem scanning; users choose every input

See [SECURITY.md](SECURITY.md) for the enforceable product policy.

## MVP scope

The first flow accepts `Game.log`, RSI Launcher logs, crash-handler text/bundles, and optional DxDiag. Initial rules cover explicit memory pressure, graphics device/API failures, damaged game data, access violations, and connection/server-session symptoms. Unknown results remain unknown rather than blaming the user's PC.

The redacted export is JSON so users can inspect it before sharing. Archive export and richer crash-handler parsing are planned follow-ups.

## Run locally

Requires Node.js 20 or newer.

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
