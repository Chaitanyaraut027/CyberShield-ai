# CyberShield AI — Mobile app (Android / iOS)

The mobile app is the same React UI wrapped in a native app with Capacitor.
It works **without internet**: scanning, the Cyber Score, analytics, history,
reports, the built-in assistant and accounts all run on the phone.

## Why the camera works in the app
In a browser on a phone, opening `http://<PC-IP>:5173` is not a secure page, so
the browser blocks the camera. `localhost` on a phone also means the phone itself,
not your PC. The native app loads its files from a secure internal address, so the
camera is allowed, and the app asks for camera permission the normal Android/iOS way.

## One-time setup (Windows / macOS / Linux)
1. Install Node.js 20+ and Android Studio (for Android). iOS builds need a Mac + Xcode.
2. `cd frontend && npm install`
3. `npx cap add android`   (Mac only: `npx cap add ios`)

## Build and run
- `npm run mobile:android` → builds the web app, copies it into the native project and opens Android Studio.
  In Android Studio: **Run ▶** on a phone (USB debugging on), or **Build → Build APK(s)** to get an installable `.apk`.
- After any code change: `npm run mobile:sync`, then run again.
- iOS (Mac): `npm run mobile:ios`, then Run in Xcode.

## Camera permission
- Android: the `@capacitor/camera` plugin adds the CAMERA permission automatically. If the app
  is denied, the phone's Settings → Apps → CyberShield AI → Permissions → Camera.
- iOS: add this to `ios/App/App/Info.plist` (inside the `<dict>`):
  ```xml
  <key>NSCameraUsageDescription</key>
  <string>CyberShield AI uses the camera to scan QR codes for scams.</string>
  ```

## Offline vs. online
- **No server set (default in the app):** everything runs on the phone. Accounts and history
  are stored on the phone only.
- **Optional server:** in Profile → Settings, enter your PC's backend address (for example
  `http://192.168.1.20:8000`) to use the full backend with the trained AI model and shared
  community reports. The app falls back to on-device mode if the server can't be reached.
  Plain `http://` on Android needs `"android": { "allowMixedContent": true }` in
  `capacitor.config.json`. Use this only on your home or test network.
- The trained ML model (`backend/app/ml/model.joblib`) runs only on the Python backend. The
  on-device build uses the rules engine, which covers lookalike domains, scam wording, links,
  UPI/Wi-Fi QR payloads and community reports.

## Files added for the mobile app
- `capacitor.config.json` — app name, id and web folder (`dist`).
- `frontend/src/offline/engine.ts` — on-device version of the scanner rules, scoring and assistant.
- `frontend/src/api.ts` — uses the server when reachable, otherwise the on-device engine.
- `frontend/src/main.tsx` + fonts from `@fontsource/*` — fonts are bundled, so the look is the same offline.
