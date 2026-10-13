# CyberShield AI — React Native Expo Mobile App

A complete, native mobile client for **CyberShield AI** built with **React Native**, **Expo SDK 51**, and **TypeScript**.

Includes a real-time **Expo Camera QR Scanner**, URL threat analyzer, SMS scam detector, password entropy checker, offline threat engine, and AI security assistant.

---

## 🚀 How to Run the App in Expo

### 1. Open Terminal and Navigate to Mobile Directory
```bash
cd mobile
```

### 2. Start the Expo Development Server
```bash
npx expo start
```
*(or `npm start`)*

---

## 📱 Running on Your Device

### Option A: Physical Phone (Expo Go) — Recommended
1. Install **Expo Go** from Google Play Store (Android) or App Store (iOS).
2. Open the Expo Go app.
3. **Android:** Scan the QR code displayed in your terminal.
4. **iOS:** Scan the QR code with your default iPhone Camera app and tap the Expo notification.
5. *(Optional)* If your PC and phone are on different Wi-Fi networks:
   ```bash
   npx expo start --tunnel
   ```

### Option B: Android Emulator / iOS Simulator
- Press `a` in the terminal to launch Android Emulator.
- Press `i` in the terminal to launch iOS Simulator (macOS only).
- Press `w` in the terminal to preview in web browser.

---

## 🔍 Scanner Features (Expo Camera)

The QR scanner is implemented using `expo-camera` (`CameraView`) and `expo-image-picker`:

1. **Live Camera Scanner:** Native camera viewfinder with auto-focus, bounding frame, and real-time QR barcode detection.
2. **Flashlight (Torch) & Flip:** Toggle torch on/off for dark environments and flip between rear and front cameras.
3. **Camera Permissions:** Automatic prompt handling via Expo Camera permission hook (`useCameraPermissions`).
4. **Photo Picker:** Pick an image from gallery (`expo-image-picker`).
5. **Quick Demo Payloads:** Tap 1-click test chips to test instant analysis:
   - 🚨 `Fake SBI KYC` (`hxxp://sbi-kyc-update.top/login`)
   - 📲 `UPI Scam QR` (`upi://pay?pa=prize_claim@upi&am=4999&pn=Lottery%20Prize`)
   - ✓ `Safe Github Link` (`https://github.com/security`)
   - 📶 `Unsecured Wi-Fi` (`WIFI:S:Free_Public_Wifi;T:nopass;;`)
6. **Decoded Input:** Manually paste or type any URL, SMS text, or QR payload.

---

## 🛡️ Converted Screens & Features

| Screen / Feature | Description |
|---|---|
| **Auth Screen** | Login & registration with password hashing, plus a 1-tap **Quick Demo Login** |
| **Dashboard** | Cyber Score gauge, live security shield status, 4 threat counters, tool shortcuts, and recent threat list |
| **Scanner Hub** | 4 tabs: URL Scanner, SMS Scanner (with urgency wording highlights), QR Scanner (Expo Camera), and Password Security Checker |
| **Result Screen** | Visual verdict badge (SAFE / SUSPICIOUS / DANGEROUS), circular risk gauge, AI confidence bar, risk indicators, AI explanation, recommendation box, score breakdown bars, threat intel checks table, and report button |
| **History Timeline** | Categorized scan history with filter pills (All / URL / SMS / QR), tap-to-reopen full analysis, and clear history |
| **Security Analytics** | 7-day scan bar chart, scans by category progress bars, and threat distribution percentages (Safe/Suspicious/Dangerous) |
| **Security Center** | System protection status, active shields checklist, and threat recommendations |
| **AI Assistant** | Real-time security advisor chat with quick suggestion chips and scan explanation picker |
| **Cyber Score** | 30-day habits score (Awareness, Coverage, Consistency, Exposure) and actionable tips to improve |
| **Report a Scam** | Submit phishing URLs, SMS, and QR scams to community database with report deletion |
| **Profile & Settings** | Account details, logout, and configurable Backend Server URL with live connection test |

---

## 🔌 Offline vs. Online Server

- **Offline Mode (Default):** The app works **100% offline with zero internet**. The on-device engine (`src/offline/engine.ts`) runs heuristic rules, typosquatting checks, phishing keyword detection, brand similarity matching, and local AI advice. Data is saved locally using `AsyncStorage`.
- **Online Backend Mode (Optional):** Enter your PC's backend URL in **Settings** (e.g. `http://192.168.1.10:8000`) to enable the trained machine learning model and centralized community database.
