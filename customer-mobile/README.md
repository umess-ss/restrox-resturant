# RestroX Customer Mobile

Expo React Native app for the customer QR ordering side only.

## Setup

```bash
cd customer-mobile
npm install
cp .env.example .env
npm run start
```

Set these values in `.env`:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:5000/api
EXPO_PUBLIC_RESTAURANT_ID=...
EXPO_PUBLIC_BRANCH_ID=...
EXPO_PUBLIC_TABLE_ID=...
```

For a real phone, use your computer LAN IP instead of `localhost`, because phone `localhost` points to the phone itself.
