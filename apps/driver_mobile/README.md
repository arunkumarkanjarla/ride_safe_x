# Driver app (Expo)

Phase 2 auth shell. Set API base URL:

```bash
set EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:8000
npm install
npx expo start
```

Use Expo Go for early testing. Secure token storage uses `expo-secure-store` when available; otherwise tokens stay in memory only for the session.
