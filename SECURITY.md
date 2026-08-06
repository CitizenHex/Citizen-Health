# Safety and privacy policy

Citizen Health is a passive diagnostics reader. These constraints are product requirements, not optional preferences.

## Allowed

- Read local logs and diagnostics explicitly selected by the user.
- Parse copies held in application memory for the current analysis.
- Create a redacted export only after an explicit user action.
- Link to official remediation and service-status guidance.

## Prohibited

- Injecting into, attaching a debugger to, or modifying the game or launcher.
- Reading game or launcher process memory.
- Synthesizing input or automating gameplay.
- Intercepting game network traffic.
- Uploading diagnostics, telemetry, or usage data by default.
- Scanning game folders or the broader filesystem without a user-selected location and clear consent.

Any future feature that crosses this boundary requires rejection or a separate product. Diagnostic rules must cite observable evidence, state uncertainty, and avoid presenting correlation as a confirmed cause.

## Desktop foundation

The Tauri desktop foundation starts with only native open-dialog capability. It grants no filesystem, shell, process, network, updater, or automatic-start permission. Future native monitoring must receive a separate capability scoped to user-approved `LIVE` and launcher-log folders only; it must never grant a broad home-directory or drive-wide scope.
