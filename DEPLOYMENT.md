# 🚀 Deployment Guide

## Prerequisites

1. **Expo Account** - Sign up at [expo.dev](https://expo.dev)
2. **EAS CLI** - Already installed globally
3. **Environment Variables** - Configured in `.env`

## Step 1: Login to EAS

```bash
cd app
eas login
```

Enter your Expo account credentials when prompted.

## Step 2: Configure Project

```bash
eas build:configure
```

This will:
- Create/update `eas.json` (already done)
- Link your project to EAS
- Generate a project ID

## Step 3: Build for Android

### Preview Build (APK for testing)

```bash
eas build --platform android --profile preview
```

This creates an APK you can install directly on Android devices.

### Production Build (AAB for Play Store)

```bash
eas build --platform android --profile production
```

This creates an Android App Bundle for Google Play Store submission.

## Step 4: Build for iOS (Optional)

```bash
eas build --platform ios --profile preview
```

**Note**: Requires Apple Developer account ($99/year)

## Step 5: Download & Install

After the build completes:

1. You'll get a download link in the terminal
2. Or go to [expo.dev/accounts/amanzzz/projects/reelnotes/builds](https://expo.dev/accounts/amanzzz/projects/reelnotes/builds)
3. Download the APK/IPA
4. Install on your device

## Alternative: Development Build

For faster testing during development:

```bash
eas build --platform android --profile development
npx expo start --dev-client
```

## Publishing Updates (OTA)

After initial build, push updates without rebuilding:

```bash
eas update --branch production --message "Bug fixes"
```

## Environment Variables

EAS doesn't read `.env` files by default. Set secrets:

```bash
eas secret:create --name EXPO_PUBLIC_GROQ_API_KEY --value gsk_your_key
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://your-project.supabase.co
eas secret:create --name EXPO_PUBLIC_SUPABASE_KEY --value your_key
```

## Troubleshooting

### Build Failed - Gradle Error
```bash
cd android
./gradlew clean
cd ..
eas build --platform android --clear-cache
```

### Invalid Credentials
```bash
eas logout
eas login
```

### Missing Dependencies
```bash
npm install
npx expo-doctor
```

## Next Steps

1. **Google Play Store**
   - Create developer account ($25 one-time)
   - Upload production AAB
   - Fill store listing
   - Submit for review

2. **App Store** (iOS)
   - Create Apple Developer account ($99/year)
   - Upload IPA via Transporter
   - Fill store listing
   - Submit for review

## Useful Commands

```bash
# Check build status
eas build:list

# View build logs
eas build:view [build-id]

# Cancel build
eas build:cancel

# Delete old builds
eas build:delete [build-id]

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

## Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [EAS Update Documentation](https://docs.expo.dev/eas-update/introduction/)
- [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Guidelines](https://play.google.com/about/developer-content-policy/)
