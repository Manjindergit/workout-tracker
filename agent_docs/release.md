# Building & shipping

Two artifacts, two paths — they are not interchangeable:

| Target | Artifact | Command |
|---|---|---|
| Sideload (phone via USB / file share) | `.apk` | local gradle (below) or `eas build -p android --profile sideload` |
| Google Play | `.aab` | `eas build -p android --profile production` (Play rejects APKs; AAB required since 2021) |

## Local sideload APK (no EAS account or queue)

Requires Android Studio SDK + JDK 17+ on the machine.

```
npx expo prebuild -p android        # generates android/ (gitignored, never hand-edit)
cd android
./gradlew app:assembleRelease       # gradlew.bat on Windows
# output: android/app/build/outputs/apk/release/app-release.apk
```

First time: generate a keystore and reference it via `android/gradle.properties` /
`app/build.gradle` signing config, or follow https://docs.expo.dev/guides/local-app-production/.
Keep the keystore OUT of git (`*.jks` is already gitignored) — losing it means you
cannot update an installed app in place.

## Dev loop

`npx expo run:android` builds a development client on the connected emulator/device —
Expo Go is not supported (SDK 57+, custom native deps). After changing anything under
`app.json → plugins` or adding native modules, re-run prebuild/run:android.

## Play Store notes

- Target API 36 is mandatory for updates from 2026-08-31 — SDK 57 already targets it.
- `android.package` is `com.manjinder.workouttracker` (app.json); changing it later
  creates a different app identity.
