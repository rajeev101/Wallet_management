# Campus Wallet Native Migration

## Architecture Audit

Source of truth: `client/src/App.jsx`, every file in `client/src/page` and
`client/src/components/common`, `admin/src/App.jsx`, `admin/src/page`,
`admin/src/components/common`, both API services, and Express routes/controllers.

- Four database roles: student, customer, vendor, admin. Student and Customer share
  wallet UI but retain distinct roles, signup identifiers, and authorization.
- Authentication: POST /auth/login returns token/user; GET /auth/profile validates
  restored sessions. Vendor must be approved. Admin login explicitly requests admin.
- Recovery: email -> six-digit OTP (five minutes) -> single-use resetToken -> new
  password. Never persist reset grants in navigation state or ordinary storage.
- Profile: name/photo editable for everyone. Only Admin can change email/phone.
  Photos are data URLs inside JSON, with a 5 MB Express request limit.
- Transactions retain accountHolder/student/customer compatibility. Payments and
  top-up approvals use existing server behavior; no new financial endpoints.
- Notifications retain foreground polling and now support transaction push alerts
  for Student/Customer accounts. Credential and rebuild requirements are in QA.md.
- Design: Campus Wallet wordmark, Inter typography, white/light-gray surfaces,
  purple #5200c9, cyan #1aa9c9, dark ink #070d2e, green/red status treatments.
  Existing hero bitmap is reused; browser-only SVG icons become native icons.
- Browser tables become native lists and detail screens. Downloads become native
  shareable XLSX, PDF, and PNG files. QR payload remains the raw vendor ObjectId.
- Web demo records and fixed statistics are not copied; only real server data.
- Existing Add Student/Customer only points to public signup. No Admin create-user
  endpoint exists. Native retains that public registration flow, not a fake CRUD API.
- The MA-PA promo in the source is noninteractive and has no URL or backend API.
- No other file-upload, deletion, settlement, or analytics API is present.

## Screen And Component Checklist

Status: [ ] pending; [x] implemented. Verification status is separate below.

### Authentication
- [ ] Student, Customer, Vendor and Admin sign-in; password visibility; remember me
- [ ] Student/Customer registration with student_id/samagra_id and confirmation
- [ ] Forgot password, OTP autofill/paste, expiration, resend, reset password
- [ ] Protected role navigation, restored sessions, logout, access denied

### Student And Customer
- [ ] Home: live balance, scan/add actions, MA-PA branding, recent transactions
- [ ] Monthly spend/top-ups/average analytics and their transaction details
- [ ] Native QR camera, permissions/settings, vendor verification, amount entry
- [ ] Balance validation, payment confirmation, processing, success and failure
- [ ] Funding request form; five-record paginated history, retry and deduplication
- [ ] Transactions: ID search, 7/15-day, 1/3-month filters, incremental lists
- [ ] XLSX export and individual PDF receipts
- [ ] Profile details, image selection/removal, edit/cancel/save, change password

### Vendor
- [ ] Home: today/month/total/average statistics and all analytics detail screens
- [ ] Payment QR preview, permanent raw vendor ID, QR details and PNG sharing
- [ ] Received transactions, payer details, revenue statistics, ID search
- [ ] 3/7/15-day and one-month filters, incremental lists and XLSX export
- [ ] Profile, activation status, image/name editing and password change

### Admin
- [ ] Dashboard: real statistics, recent transactions, all statistic drill-downs
- [ ] Students/Customers: search, balance summaries, public signup handoff
- [ ] Account details, wallet balances, per-account transaction reports
- [ ] Vendors: search, create/onboarding email, active toggle, activate/deactivate
- [ ] Vendor details and received-transaction reports
- [ ] Transactions: Student/Customer/Vendor tabs, full list and details
- [ ] Funding requests: pending/approved/rejected, approve/reject, real summaries
- [ ] Reports: ID search, status/type/date filters, oldest/newest, pagination, XLSX
- [ ] Transaction balances: show recorded values or explicitly derived ledger values
- [ ] Admin profile: photo, name, email, phone, status and join date

### Shared Native Behavior
- [ ] SecureStore tokens, centralized HTTP client, request deadlines, safe errors
- [ ] Stack/back navigation, wallet/vendor bottom tabs, Admin drawer
- [ ] Safe areas, keyboard avoidance, scrollable forms, accessible touch targets
- [ ] Loading, empty, retry/error states, pull-to-refresh, foreground refresh
- [ ] Notifications, badge, five-second foreground polling, clear all
- [ ] Inter fonts, original branding/colors, responsive layouts and native icons
- [ ] Android/iOS configuration, deep links, environment docs, release profiles

## Verification Gates
- [ ] Pure business logic and HTTP contract tests with isolated test data
- [ ] TypeScript and dependency compatibility checks
- [ ] Android and iOS JavaScript production bundles
- [ ] Android native build and emulator interaction checks when toolchain permits
- [ ] iOS native/device checks (require macOS/Xcode or EAS credentials)
- [ ] Real authenticated backend checks (require disposable authorized accounts)
- [ ] Physical-device camera, photo picker and file-sharing checks

No live payments, balance changes, user creation, or onboarding emails will be
triggered as verification without explicitly authorized disposable accounts.
Existing server financial consistency risks documented in PRODUCTION_READINESS.md
are inherited, not repaired or hidden by this frontend migration.