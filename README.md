# Sri Sathya Sai (SSS) Bhajan Studio

Native iOS and Android app for browsing, saving, reading, and listening to Sai bhajans. The app consumes the public songs API from the sibling `saisongs` service.

## Run locally

1. Start the `saisongs` backend on port `3111`.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` for your environment. Android emulators use `10.0.2.2`; physical devices need the computer's LAN IP.
3. Run `npm start`, then open the project in an iOS or Android simulator, or use a development build on a device.

For native release builds, use EAS Build. Changes to native config plugins, such as background audio, require a new native build.

## Checks

```sh
npx tsc --noEmit
npx expo lint
npx expo-doctor
```