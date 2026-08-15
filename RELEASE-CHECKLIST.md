# Citizen Health release checklist

Use this before publishing. A release must preserve the read-only, local-only boundary.

## Version and source

- [ ] Update `package.json` and `src/version.js` together.
- [ ] Review every changed diagnostic rule against minimal, anonymized evidence.
- [ ] Make uncertainty clear; do not diagnose hardware from correlation alone.

## Privacy and safety

- [ ] Confirm folder access is read-only, saved only after the player selects it, and can be reset from Settings.
- [ ] Confirm monitoring stops when the tab closes, access is lost, or **Reset saved folders** is pressed.
- [ ] Confirm history stores only compact session records and can be disabled or deleted from Settings.
- [ ] Confirm exports and summaries exclude raw logs, source paths, binary dumps, and unrecognized raw text.
- [ ] Confirm the server binds only to `127.0.0.1` and the browser policy blocks outbound connections.
- [ ] Confirm there are no runtime package dependencies.

## Verification

- [ ] Run `npm test` and resolve every failure.
- [ ] Start with `Start-Citizen-Health.cmd` and analyze an anonymized fixture.
- [ ] Review the finding, redaction preview, copied support summary, and JSON export.
- [ ] Confirm an unavailable or withdrawn folder stops monitoring clearly.

## Publish

- [ ] Commit the release changes and tag the reviewed version in Git.
- [ ] Publish source and release notes that state known limitations and the safety boundary.
