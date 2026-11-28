# Single-Device Login And Admin Device Reset

## Existing Architecture

The application retains its Express/Mongoose backend, React browser client, existing React Admin Dashboard, and Expo React Native mobile app. Roles remain `student`, `customer`, `vendor`, and `admin`. Only Student and Customer accounts receive a mobile device binding. Admin and Vendor authentication remains browser-based.

Authentication continues to use seven-day JWT access tokens. There was no refresh-token API or refresh-token database; none has been introduced. Each new JWT additionally contains a unique `jti`, an `authVersion`, and, for a bound mobile login, a `deviceIdHash`. The existing middleware still obtains the current role from MongoDB, not from a client-supplied role.

## Lifecycle

1. The native app generates a random UUID and a separate 256-bit installation credential. Both are saved together in Expo SecureStore, using Android Keystore-backed storage and iOS device-only Keychain storage. Normal restart and logout do not replace them.
2. The existing login API verifies the password first. A valid first mobile login atomically binds the installation, enables device locking, and increments the user's authentication version. Concurrent different-device first logins admit one winner.
3. Same-device login validates both the UUID and the installation credential and updates last-login metadata. A different UUID or a different credential for the same UUID is rejected and recorded in the blocked-attempt audit collection. Credentials are SHA-256 hashed at rest and compared in constant time; hashes are not returned in account/device responses.
4. Logout adds the hash of the current JWT to the revocation collection. It does not remove the device binding or invalidate other sessions on the same installation. All protected requests check logout revocation, current user authentication version, and the bound-device claim.
5. The existing Admin Dashboard now contains Device Management. An Admin can search/filter/sort Student and Customer accounts, inspect device details, view blocked attempts and reset history, and reset a device with a reason of 10-500 characters.
6. Reset atomically removes the binding, increments `authVersion`, preserves an embedded audit record, and keeps locking enabled. Every prior access token then fails middleware. The next successful mobile login claims the unbound account and locks it again. No existing password is changed.

Reset requires the displayed `expectedVersion`; stale Admin screens and simultaneous conflicting resets receive HTTP 409 instead of silently modifying a changed account. Binding, revocation version, and reset history are written to the same user document, so their atomicity does not depend on replica-set transactions.

The reset does not permanently blacklist a previous installation. While the account is unbound, whoever knows the account credentials and logs in first can claim it. Admins should verify the account owner and coordinate the new-device login. Already executing requests and already submitted OS push notifications cannot be recalled; subsequent authenticated requests are rejected.

## APIs

Paths below are relative to `/api/v1`. All device-management endpoints use the existing Admin authentication/authorization guard.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/auth/login` | Existing login; mobile adds `clientType: "mobile"` and `device` |
| DELETE | `/auth/logout` | Authenticated current-token revocation; preserves binding |
| GET | `/admin/devices` | Paginated Student/Customer device/account listing |
| GET | `/admin/devices/:id` | Individual account and public device details |
| GET | `/admin/devices/:id/history` | Paginated reset audit history |
| GET | `/admin/devices/:id/attempts` | Paginated blocked login attempts |
| POST | `/admin/devices/:id/reset` | Reason-required, version-checked device reset |

Listing accepts `search` (name/email/phone/Student ID/Samagra ID/database ID), `role=student|customer`, `status=locked|unbound`, `page`, `limit` (maximum 100), `sort=name|registeredAt|lastLoginAt`, and `direction=asc|desc`. Audit endpoints support `page` and `limit`. Invalid IDs, filters, and pagination are rejected.

Mobile device fields: `id` (UUID v4), `credential` (64 lowercase hex characters), `platform` (`android` or `ios`), `name`, `osVersion`, and `appVersion`. Metadata strings are bounded to 120 characters. Device information is never accepted through profile update APIs.

Reset payload:

```json
{
  "reason": "Verified account owner replaced a broken phone",
  "expectedVersion": 1
}
```

Different-device login response:

```json
{
  "success": false,
  "code": "DEVICE_ALREADY_REGISTERED",
  "message": "Your account is already registered on another device. Please contact admin."
}
```

Other structured codes include `INVALID_DEVICE_INFORMATION`, `MOBILE_DEVICE_REQUIRED`, `AUTH_STATE_CHANGED`, `SESSION_REVOKED`, and `LOGIN_RATE_LIMITED`. The mobile HTTP client retains the code and displays the supplied safe message using the existing login error UI.

## Database Changes

- `User.authVersion`: defaults to zero and increases on first binding and every reset. Missing legacy values are treated as zero in both middleware and atomic update filters.
- `User.deviceLockEnabled`: defaults to true. There is no user-facing or Admin endpoint to disable locking.
- `User.deviceBinding`: one embedded binding, hidden from ordinary queries, containing ID, hashed installation credential, name/platform/OS/app metadata, registration date, and last-login date. Index: account type plus device ID. Different accounts may intentionally share one installation.
- `User.deviceResetHistory`: hidden embedded reset records with previous public device metadata, Admin ID/name, reason, and timestamp. History pagination is performed in MongoDB. Secrets are never copied into audit history. Preserve these records; do not replace/reset the array in a migration.
- `DeviceAttempt`: indexed by user/date; preserves blocked-attempt metadata without credentials or JWTs.
- `RevokedToken`: unique SHA-256 token hash, user, and expiration date. A TTL index removes expired revocations. Raw JWTs are not stored.
- `PushDevice.authVersion`: bound to the registering session. The push worker excludes registrations from prior authentication versions after first binding/reset, including late registration requests racing with reset. Legacy version-zero registrations remain compatible for legacy unbound accounts.

## Migration And Deployment

No bulk user rewrite or destructive migration is required. Existing missing values are handled lazily; no existing binding is invented and no wallet balance is modified.

1. Back up the database and preserve the existing mobile signing key. Review and deploy the changed backend and existing Admin/client apps together. Install backend production dependencies, including `express-rate-limit`; MongoDB memory-server is development-only test tooling.
2. Ensure the new User, DeviceAttempt, RevokedToken, and PushDevice indexes are created. Mongoose creates them when automatic indexing is enabled; if production disables it, run the respective models' `createIndexes()` in the deployment's authenticated database context. Never print or commit connection strings.
3. Behind a single trusted reverse proxy, configure `TRUST_PROXY=1` only if the API cannot be reached directly by untrusted clients and the proxy controls forwarded IP headers. Otherwise leave it unset. Login is limited to 30 unsuccessful attempts per IP per 15 minutes; device resets are limited to 30 per Admin per hour. The default rate-limit store is per process; use a shared external store when deploying multiple API instances.
4. Build and distribute the updated native app. The existing QA 1.0.2 APK predates this feature. Keep existing Expo/Firebase push credentials and follow the push setup in `mobile/QA.md` if push is being enabled too.
5. Existing unbound users and their old browser/JWT sessions continue working until their first mobile binding. First binding invalidates all earlier version-zero tokens. Once bound, browser login without the installation credential is rejected; this prevents a browser endpoint from bypassing the mobile lock. After Admin reset, browser login is also rejected until a mobile device is registered.
6. Deploy a device-aware mobile build before users are expected to bind accounts. Older mobile builds do not send identity and cannot sign into already bound/reset accounts. Existing unbound sessions are not forcibly upgraded or logged out solely because the new code is deployed.

Offline logout clears local credentials but cannot guarantee server revocation. The native app warns when server logout fails; the outstanding JWT still expires normally. Browser logout uses keepalive best-effort revocation while clearing local session storage. Closing an app or browser is not a logout request.

## Device Assurance And Recovery

UUID alone is not trusted: the backend also validates a random installation credential, protected by SecureStore and hashed in MongoDB. This is possession-based installation binding, not hardware attestation. A compromised/rooted/jailbroken device or a copied JWT/UUID/credential can defeat physical-device assurance. Continue using HTTPS and protect access tokens as bearer credentials.

Android Play Integrity and Apple App Attest were evaluated but are not mandatory in this implementation. Production attestation requires native platform integration, app-distribution identity, server-verified nonce/challenge handling, and platform project/Apple configuration. It should be a separately configured hardening step where stronger physical-device assurance is required; no fake attestation or unchecked client integrity flag is used.

On Android, uninstall/data clear normally removes SecureStore identity; the next installation needs Admin reset. iOS Keychain items can survive reinstall, but this is not guaranteed; missing identity likewise needs Admin reset. Device-only Keychain data and SecureStore backup exclusion prevent ordinary backup restore from transparently cloning identity onto a new phone. Corrupt/locked/unwritable storage fails closed instead of silently rotating an existing identity. Real Android/iOS reinstall and backup behavior still requires physical-device verification.

## Verification

- `npm --prefix server test`: existing middleware/vendor authentication and vendor-count compatibility checks.
- `npm --prefix server run test:devices`: 18 tests with real ephemeral MongoDB and HTTP APIs. Covers Student Android/iOS payloads, Customer binding, same-device re-login, session-specific logout, wrong device/credential, reset and old tokens, concurrent registration/reset, unauthorized reads/resets, stale versions, legacy users, reinstall/data-clear simulation, invalid metadata, expired tokens, absent refresh API, filters/pagination, stale push registrations, and rate limiting. No production data, email, or Expo delivery is used.
- `npm --prefix mobile test`: 17 tests, including identity persistence/concurrent reads, corrupt storage, storage failures, clear-data simulation, device login payload, structured errors, and existing wallet/role/API behavior. The stale pre-pull role expectation was updated to match master's exact Student/Customer role matching; production role logic was not changed.
- Mobile TypeScript and Android release Kotlin compilation pass with the Expo crypto module. Browser client and Admin production builds pass.
- Admin UI was checked in Playwright with synthetic page-local API fixtures: search/role filtering, details, blocked attempts, required reset reason, expected-version payload, post-reset status, reset history, and desktop/390px phone screenshots without page-level overflow. No real Admin session was used.

Real production deployment, physical-device authenticated flows/reinstall, iOS native build, and FCM/APNs delivery have not been performed as part of this feature. Backend enforcement and local integration tests are verified; those operational checks remain required before rollout.

## Implementation Files

- Backend core: `server/src/models/user.model.js`, new `deviceAttempt.model.js` and `revokedToken.model.js`, new `services/deviceBinding.service.js`, new `controllers/device.controller.js`, existing auth controller/middleware/token utility, auth/Admin routes, and proxy configuration in `app.js`.
- Push compatibility: existing push-device model/controller/worker.
- Native: new `mobile/src/services/installationIdentity.ts` and `deviceIdentity.ts`, existing WalletApi/HttpClient/AuthContext, package manifest/lockfile, and mobile tests.
- Existing Admin: new `admin/src/components/common/DeviceManagementSection.jsx`, existing AdminDashboardPage, styles, and API helpers. No separate Admin app, user role, authentication flow, or UI library was introduced.
- Browser logout: existing client auth service and Student/Vendor dashboard/header callers; existing Admin auth service and logout handler.
- Tests/dependencies: backend device test suite, existing auth/vendor test adapters, backend package manifest, and this guide.