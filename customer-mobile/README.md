# RestroX Customer Mobile

Expo React Native app for the customer QR ordering side only.

## Setup

```bash
cd customer-mobile
npm install
cp .env.example .env
```

Edit `.env`:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:5000/api
EXPO_PUBLIC_RESTAURANT_ID=...
EXPO_PUBLIC_BRANCH_ID=...
EXPO_PUBLIC_TABLE_ID=...
```

For Expo Go on a real phone, do not use `localhost` in `EXPO_PUBLIC_API_URL`. Use your computer LAN IP, for example:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.20:5000/api
```

## Run

Start backend from the project root:

```bash
npm run dev:server
```

Start the mobile app:

```bash
cd customer-mobile
npm run start
```

Then:

- Press `a` for Android emulator/device.
- Press `i` for iOS simulator.
- Press `w` for web.
- Scan the QR code with Expo Go for a physical phone.

If Expo Go cannot connect from your phone, use tunnel mode:

```bash
npx expo start --tunnel
```

If web dependencies ever go missing, run:

```bash
npx expo install react-dom react-native-web @expo/metro-runtime
```
