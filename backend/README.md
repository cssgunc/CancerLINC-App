# CancerLINC Backend

Firebase backend infrastructure for CancerLINC.

This repo owns:

- Cloud Functions
- Firestore security rules
- Firestore indexes
- Cloud Storage security rules

Client Firebase app config stays in the app dirs where needed, such as Flutter
`firebase_options.dart`, `google-services.json`, and `GoogleService-Info.plist`.

## Structure

```text
.
+-- firebase.json
+-- firestore.indexes.json
+-- firestore.rules
+-- storage.rules
+-- functions
    +-- package.json
    +-- src
    |   +-- admin
    |   +-- patient
    |   +-- shared
    +-- tsconfig.json
```

Function folders are split by product semantics:

- `functions/src/patient`: patient-facing callable exports.
- `functions/src/admin`: admin/staff callable exports.
- `functions/src/shared`: cross-client triggers, schedules, and shared backend
  behavior.

Firebase deploys these as one Functions codebase named `backend`.

## Setup

Install the Firebase CLI and authenticate:

```sh
npm install -g firebase-tools
firebase login
```

Install function dependencies:

```sh
cd functions
npm install
```

Create local function params in `functions/.env`:

```sh
SUPERUSER_EMAIL=admin@example.org
```

Use the real CancerLINC superuser email for deployed or production-like testing.

For production, set the Functions parameter before deploy:

```sh
firebase functions:params:set SUPERUSER_EMAIL=admin@example.org
```

## Build

From the repo root:

```sh
npm --prefix functions run build
```

Or from `functions/`:

```sh
npm run build
```

## Emulators

From the repo root:

```sh
firebase emulators:start --only functions,firestore,storage
```

The `functions` package also has:

```sh
npm --prefix functions run serve
```

## Deploy

Deploy everything owned by this repo:

```sh
firebase deploy
```

Deploy only Functions:

```sh
firebase deploy --only functions:backend
```

Deploy only Firestore rules and indexes:

```sh
firebase deploy --only firestore
```

Deploy only Storage rules:

```sh
firebase deploy --only storage
```

## Staff Invite Email

The admin `createStaffAccount` function writes invite messages to the `mail`
collection. Delivery is handled by the Firebase Trigger Email extension, so the
Firebase project must have that extension installed and configured with:

- Email documents collection: `mail`
- A verified sender identity
- SMTP credentials from the chosen transactional email provider

For reliable delivery, configure SPF, DKIM, and DMARC DNS records for the sender
domain. Test with at least one Gmail inbox and one Microsoft/Outlook inbox after
DNS propagation.
