# Citizen Health 0.1.0 prerelease

## Start

1. Extract the complete ZIP to a normal folder.
2. Double-click `Start-Citizen-Health.cmd`.
3. On first use, choose the Star Citizen `LIVE` folder.

Citizen Health opens in your default browser and only listens on `127.0.0.1` (this PC). It does not upload logs or run as a Windows background service.

## Included runtime

This prerelease includes the official Node.js 24.19.0 Windows x64 runtime solely to run the local app. Citizen Health has no npm dependencies. Node.js is licensed under the MIT License; its upstream license file is included in `runtime\LICENSE`.

## Known prerelease limits

- This is a local web application, so a command window remains open while Citizen Health is running.
- Close that command window to stop the local app server.
- Combat history records only confirmed direct kills and deaths while the app is open and watching the selected game folder.
- Cargo/shipping history is not yet available.
