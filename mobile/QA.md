# Android QA Build

## Handoff Artifact

- File: `artifacts/CampusWallet-QA-1.0.2.apk` (67.51 MiB).
- Version: `1.0.2` / version code `3`.
- SHA-256: `9DE86FFEB09F6C78087BCE1C825A76B960DC2534717560B030E3434C54CA0AB0`.
- Verified: release build succeeds, APK v2 signature is valid, embedded JavaScript bundle contains the deployed API URL, Android API 24+ and ARM64/ARMv7 metadata match expectations.
- Installed as an update and launched on Samsung SM-A055F without Metro. The supplied artwork is configured as the launcher icon; the native cold-start logo splash and sign-in logo were visually verified on-device. TypeScript and all 12 tests pass.
- Camera and foreground location permissions remain declared in the APK. The foreground location dialog was verified on-device in QA 1.0.1. Scanner preview and QR recognition after granting camera permission still need a signed-in device check.
- Camera and foreground location are requested sequentially on initial launch. Existing permission choices are respected, with a Settings shortcut for denied access. No background location permission or service is enabled; no location coordinates are collected or uploaded.

## Environment

- API: `https://www.mapawallet.in/api/v1` (live Hostinger deployment).
- Mobile accounts: Student and Customer only. Admin and Vendor access remains browser-only.
- Android 7.0 or later, ARM64 or ARMv7 devices.
- The standalone release APK includes JavaScript, fonts, and assets. Metro, Expo Go, USB, and a development computer are not required to run it. Internet access is required for API operations.
- Use approved QA accounts. Payments, registrations, password resets, and funding requests affect the live backend; this is not a staging environment.

## Build Locally On Windows

From the repository root in PowerShell:

```powershell
$env:NODE_ENV = 'production'
$env:EXPO_PUBLIC_API_BASE_URL = 'https://www.mapawallet.in/api/v1'
& .\mobile\android\gradlew.bat -p .\mobile\android :app:assembleRelease '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a' --console=plain --no-daemon
```

The generated APK is `android/app/build/outputs/apk/release/app-release.apk` within the mobile project. The QA handoff copy is `artifacts/CampusWallet-QA-1.0.2.apk`.

The native Android directory is generated and Git-ignored. On a fresh checkout, install dependencies and run `npx expo prebuild --platform android` from this directory before building locally. Alternatively, `npx eas-cli build --platform android --profile preview` builds an internally distributed APK using EAS-managed signing (requires Expo authentication and project setup).

## Signing And Installation

This local QA build uses the generated debug signing key with the release variant. It is for internal testing, not Play Store distribution. Preserve the local signing key for compatible future QA updates; a regenerated key or EAS signing key may require uninstalling an older build before installation. Uninstallation clears saved sessions and app data.

Share the APK through your team's approved private file-sharing service. On the Android device, allow installation from the application used to download/open the APK when prompted, then install and launch Campus Wallet. Do not share backend environment files, passwords, or signing keys.

## QA Checks

- Launch with Metro stopped and no USB connection.
- Confirm the supplied wallet artwork appears as the launcher icon, during cold startup, and on the sign-in screen.
- Confirm only Student and Customer sign-in options are displayed.
- Sign in with an approved existing account and verify live profile and wallet data.
- Verify logout, session restoration, offline errors, and Android back navigation.
- Check transaction search/filtering, PDF receipts, and Excel export/sharing.
- Check profile photo selection, QR camera permissions, and scanning.
- On a fresh install, verify the camera prompt appears before foreground location. Test granting, denying, approximate location, and returning from device Settings; existing choices should not cause repeated OS permission prompts.
- Exercise password reset, funding requests, or actual payments only when explicitly approved for the live environment.

Public `EXPO_PUBLIC_*` environment values are embedded at build time. Changing the API endpoint requires rebuilding the APK; never put secrets in these variables.

## Transaction Push Setup (Next Build)

The source now supports push alerts for Student and Customer payments, direct admin wallet credits, funding requests, and funding approvals/rejections. The QA 1.0.2 APK above predates push support and must be replaced with a newly built APK. Admin and Vendor accounts do not register for mobile push.

1. Create or select an Expo project at https://expo.dev. Copy its UUID project ID into a local `mobile/.env.local` file as `EAS_PROJECT_ID=your-project-uuid`. This ID is public configuration, not an access token. The dynamic Expo configuration reads it into `extra.eas.projectId`.
2. In Firebase, register an Android app with package `in.mapawallet.mobile`. Download its `google-services.json` into the mobile directory. It is ignored by Git. The Firebase project must match the FCM credentials uploaded in the next step.
3. From the mobile directory, run `npx eas-cli login` and `npx eas-cli credentials --platform android`. Configure FCM V1 using a Firebase service-account JSON with the Firebase Cloud Messaging API enabled and the required messaging permissions. Enter secrets only in the credential tool or Expo dashboard. Never commit service-account private keys or paste them into chat.
4. For a local Android build, run `npx expo prebuild --platform android --no-install` without `--clean`, then rebuild using the command above. Preserve the existing signing key to update installed QA copies without clearing their data.
5. For EAS cloud builds, configure `EAS_PROJECT_ID` in the preview environment and upload a file environment variable named `GOOGLE_SERVICES_JSON` containing the Firebase Android configuration. The ignored local file is not uploaded automatically. Then run `npx eas-cli build --platform android --profile preview`.
6. Deploy the changed backend source, install server dependencies, and add `PUSH_NOTIFICATIONS_ENABLED=true` to the server environment. If enhanced Expo push security is enabled, also set its server-only `EXPO_ACCESS_TOKEN`. Restart only this application's API process. No Firebase private key is needed on this backend, because delivery goes through Expo. No deployment has been performed as part of this source change.
7. Install the new native build on a physical Android device, sign in as Student or Customer, and allow notifications. Profile contains a Transaction Notifications toggle. Previously denied OS permission can be changed through Settings. Expo Go is not supported for Android remote push on SDK 54.

iOS additionally requires an Apple-signed native build and APNs credentials configured for the same Expo project. iOS delivery has not been tested.

### Delivery And Privacy

- Device registration and removal are authenticated and restricted to Student/Customer roles. Devices are bound to the authenticated user, never a user ID supplied by the app. Each device registration expires with that login session and refreshes when the signed-in app returns to the foreground.
- The backend queues a unique transaction-event job after the transaction record is saved. The worker checks every 10 seconds, retries transient submission failures up to eight attempts, skips events older than 24 hours, and checks delivery receipts after 15 minutes. Unregistered tokens are removed. Completed/failed outbox records expire after 30 days.
- Push is best-effort, not a financial ledger or a guaranteed delivery channel. Network/device restrictions, disabled permissions, invalid credentials, an unavailable database during enqueue, and exhausted retries can prevent alerts. Crash recovery may duplicate an alert. The transaction history and in-app notification list remain the source of truth.
- Lock-screen content does not include amounts, names, balances or credentials. Tapping an alert opens Notifications only for its intended signed-in account. Foreground alerts refresh profile and notification data.
- Signing out clears the local session immediately and attempts to revoke the device registration using the captured session. Offline/expired-session revocation may fail; the app warns in that case, and the registration expires no later than its original session. Already submitted OS notifications cannot be recalled.

### Push Verification

- Verify Student and Customer on separate devices/accounts; Admin and Vendor must receive 403 when calling device endpoints.
- With approved QA accounts, exercise each event: completed payment, direct credit, pending funding request, approval, rejection. Test app foreground, background, cold start, and notification-tap navigation. These operations affect the live backend; do not use live balances without approval.
- Test denied permission, Settings return, toggle off/on, logout, a different account on the same phone, token rotation, airplane mode and a server restart with queued deliveries.
- Check server logs for ticket/receipt errors and confirm invalid-token cleanup and retry exhaustion. An Expo ticket confirms acceptance, not delivery to the phone.
- Current local validation passes TypeScript, all 12 mobile tests, all 12 backend tests, isolated mocked queue/ownership/retry and mobile token-lifecycle checks, Android release Kotlin compilation, and merged-manifest checks for notification permission and the FCM service. Real FCM/APNs delivery remains unverified until credentials are configured and a native build is installed.