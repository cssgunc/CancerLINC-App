# Backlog → Tickets: Patient Verification + Superuser-Managed Staff Accounts

## Context

Two related pieces of work, derived from backlog notes:

1. **Patient verification (original backlog).** Patients sign up via the **mobile app** and start as `isVerified: false`. This stops random downloaders from chatting with social workers. Staff verify a patient by manually comparing the patient's email against the CancerLINC internal CRM (a deliberately manual, un-automated step to avoid regulatory concerns), then mark them verified or deny (ban) them.

2. **Superuser-managed staff accounts (added).** There is **no public signup**. A single hardcoded **superuser** (identified by an env-configured email) provisions every staff account. Staff are created with an account + an automated invite email; the new staff member sets their own password via the Firebase password-reset flow.

**Repo scope:** This repo (`cancerlinc-web`) is the **web social-worker dashboard** only (React Router 7 + Firebase/Firestore + Cloud Functions). The **patient mobile app is a separate codebase not in this repo** — mobile work is captured as notes at the bottom, not full tickets.

### Role model (as clarified)

- **superuser** — one account, identified by env-configured email. Not a role on a user doc; it's checked server-side. Manages all staff.
- **staff** — "admin" and "social_worker" are the same tier ("admin = social worker"). Created only by the superuser. These are the people who manage and verify patients. `isStaff()` in `firebase/firestore.rules` already treats both roles as staff.
- **patient** — created via mobile signup, `isVerified: false` by default.

> ⚠️ **FLAG — staff role value:** Since admin = social worker, provisioned accounts need one canonical `role`. These tickets assume **`role: "social_worker"`** for newly provisioned staff (all patient-management code keys on `social_worker`, and `isStaff()` accepts both). Confirm, or say if you want provisioned staff to be `"admin"`.

### Decisions captured from the user (don't re-litigate in tickets)

- Unverified patients are surfaced on a **dedicated route/page** (not just a filter).
- Blocking the chat for unverified users is **mobile-only** scope → captured as a mobile note, not a web ticket.
- **No public signup.** Superuser creates all staff.
- New staff receive an **automated invite email** that also tells them to mark it as "not junk" (so future email features land in the inbox).
- Superuser privilege is **env-configured email**, checked server-side.
- Superuser gets a **full management page** (create + list + disable + delete staff).

### How to use this file

Each ticket below is self-contained — copy one ticket into a fresh Claude Code instance. They're ordered by necessity. Anything I guessed is marked **⚠️ FLAG** so you can review.

---

## Ticket order (by necessity)

| #   | Ticket                                      | Area                        |
| --- | ------------------------------------------- | --------------------------- |
| 1   | Shared data-model & rules foundation        | web (types, rules, indexes) |
| 2   | Superuser staff-provisioning Cloud Function | functions                   |
| 3   | Automated staff invite email                | functions / email infra     |
| 4   | Superuser staff-management page             | web                         |
| 5   | Remove public self-signup                   | web                         |
| 6   | Unverified-patients review route            | web                         |
| 7   | Verify / Deny controls on member page       | web                         |
| —   | Mobile follow-ups (notes only)              | mobile (separate repo)      |

---

# TICKET 1 — Shared data-model & Firestore-rules foundation

**Why:** Tickets 2–7 all read/write new fields (`isBanned`) and depend on the rules permitting/locking the right writes. Settle the schema once so the other tickets stay consistent.

**Files:**

- `app/types/user.ts` — the `User` interface
- `firebase/firestore.rules`
- `firebase/firestore.indexes.json` — composite indexes
- `docs/dashboard-and-routing.md` — schema is documented here; update the `users` schema table

**Do:**

1. In `app/types/user.ts`, add to the `User` interface:
    - `isBanned?: boolean;` — true once a patient is denied. (⚠️ **FLAG — field name:** backlog says "banned"; I chose `isBanned` for consistency with existing `isVerified`. Change if you prefer `banned`.)
    - Confirm `isVerified: boolean` stays as-is.
2. In `firebase/firestore.rules`, the `users/{userId}` block currently only has `allow read`. Add a scoped **`allow update`** so staff can write verification/ban/status fields but nothing else dangerous. Reuse the existing `isStaff()` helper. Constrain the writable key set with `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])` — allow only `isVerified`, `isBanned`, `status`, `assignedSocialWorkerId`, `assignedSocialWorkerName`, `updatedAt` (mirror the keys member.tsx already writes via `updateDoc`). See the messages-collection rules (lines 79–83) for the `diff().affectedKeys().hasOnly(...)` pattern already used in this file.
    - ⚠️ **FLAG:** member.tsx currently writes `status` and assignment via `updateDoc` and presumably works today — verify whether an `allow update` rule already exists somewhere or whether those writes currently rely on something else, and don't regress existing writes.
3. In `firebase/firestore.indexes.json`, add a composite index `role ASC, isVerified ASC` (used by Ticket 6's unverified query). Follow the existing index entries as the template.
4. Update the `users` collection schema table in `docs/dashboard-and-routing.md` to document `isBanned`.

**Acceptance:**

- `User` type has `isVerified` and `isBanned`.
- Staff can update only the allowed fields on a user doc; non-staff and out-of-scope fields are rejected by rules.
- New composite index is declared (deploy with `firebase deploy --only firestore:indexes`).
- `npm run typecheck` passes.

---

# TICKET 2 — Superuser staff-provisioning Cloud Function

**Why:** Client SDKs can't create _other_ Firebase Auth users without signing in as them. Provisioning must run server-side with the Admin SDK. This is the core of the superuser system.

**Files:**

- `functions/src/index.ts` — already initializes `firebase-admin` and exports v2 functions (`onUserCreated`, `onMessageCreated`, `deactivateStaleChats`). Add callable functions here.
- `functions/package.json` — `firebase-admin` and `firebase-functions` are already deps. You'll need Admin **Auth** (`getAuth` from `firebase-admin/auth`).

**Do:**

1. Add a config value for the superuser email. Use a Cloud Functions **secret/param** (e.g. `defineString("SUPERUSER_EMAIL")` from `firebase-functions/params`) or env var. Do **not** hardcode it in source. Document the name in `.env.template` / functions README.
2. Add a callable function `createStaffAccount` (`onCall` from `firebase-functions/v2/https`) that:
    - Verifies `request.auth?.token.email === SUPERUSER_EMAIL` (case-insensitive). Reject with `HttpsError("permission-denied", ...)` otherwise.
    - Validates input: `email` (required), `firstName`, `lastName` (and `displayName`/`hospital` if you want).
    - Creates the auth user with `getAuth().createUser({ email, emailVerified: true, displayName })`. Generate a random throwaway password (the user will reset it). Handle `auth/email-already-exists` → `HttpsError("already-exists", ...)`.
    - Writes `users/{uid}` with the same shape `signUpWithEmail` uses today (`app/services/auth_service.ts:48-60`) but with: `role: "social_worker"` (see ⚠️ role flag at top), `isVerified: true`, `isBanned: false`, `createdAt: Timestamp.now()`. Reuse the existing field names so the dashboard reads it correctly.
    - Triggers the invite email (Ticket 3) — either inline here or by writing the doc that Ticket 3's mechanism watches.
    - Returns `{ uid }`.
3. Add callable functions for the management page (Ticket 4), all superuser-gated:
    - `setStaffDisabled({ uid, disabled })` → `getAuth().updateUser(uid, { disabled })` and mirror a `disabled: boolean` flag on the user doc so the UI can show state.
    - `deleteStaffAccount({ uid })` → `getAuth().deleteUser(uid)` + delete the `users/{uid}` doc.
    - `listStaff()` — optional; the page can also just query Firestore for `role in ["social_worker","admin"]` directly (read is already allowed to staff). Prefer the direct Firestore query to avoid an extra function unless you need auth-level data (disabled state) that isn't mirrored on the doc.

**Acceptance:**

- Only the superuser email can call these; everyone else gets `permission-denied`.
- Calling `createStaffAccount` produces both a Firebase Auth user and a matching `users/{uid}` doc with `role: "social_worker"`, `isVerified: true`.
- `disable`/`delete` work against both Auth and Firestore.
- `npm run build` in `functions/` passes; test against the Firebase emulator (`npm run serve` in `functions/`).

---

# TICKET 3 — Automated staff invite email

**Why:** A newly provisioned staff member has no password. They need an automated email with a set-password link, and a note to mark the sender as "not junk" so future email features deliver to the inbox.

**Depends on:** Ticket 2.

**Approach decision (⚠️ FLAG — pick one):**

- **A. Firebase-native reset email (simplest, no infra).** After `createStaffAccount`, send Firebase's built-in password-reset email (client calls `sendPasswordResetEmail(auth, email)` after the function returns, or the function returns a flag and the page sends it). Customize the template text in **Firebase Console → Authentication → Templates**. _Limitation:_ the "mark as not junk / welcome" copy is constrained to Firebase's template editor and you can't fully brand it.
- **B. Custom email via provider (recommended for the "not junk" + future email goal).** Generate the link server-side with `getAuth().generatePasswordResetLink(email)` (or a custom action link) and send a custom email through the **Firebase "Trigger Email" extension** (writes a doc to a `mail` collection) or SendGrid/Nodemailer. This gives full control over copy and sender identity, which is what makes the "mark as not junk" instruction meaningful for future email features.

**Recommendation:** Go with **B** — it aligns with "future email features will work properly." If email infra isn't set up yet, this ticket also includes standing up the Trigger Email extension (or SendGrid creds) as a prerequisite.

**Human Note**: We are going with option B and the firebase extension to send the email.

**Do:**

1. Stand up the email mechanism (Trigger Email extension on the Firestore `mail` collection, or SendGrid API key as a Functions secret).
2. In `createStaffAccount` (or a follow-on trigger), generate the password-set link via Admin SDK and send the invite email containing: a welcome line, the set-password link, and an explicit "please mark this address as 'not junk'/safe-sender so you receive future CancerLINC notifications" instruction.
3. The set-password link should drop the user into the existing flow — `app/routes/change_password.tsx` / `app/routes/forgot_pass.tsx` already exist; confirm the Firebase action handler routes there, or point the link at the appropriate route.

**Acceptance:**

- Creating a staff account sends one email automatically.
- The link lets the new staff member set a password and then log in via `app/routes/login.tsx`.
- Email body includes the "mark as not junk" instruction.

> 🔧 **Non-software step (prompt for an AI/human):** "Generate a short checklist for configuring the Firebase email sender so invite emails don't land in spam: SPF/DKIM/DMARC records for the sending domain, verified sender identity in the email provider, and a test send to Gmail/Outlook checking the spam folder." Treat email deliverability/DNS as an ops task outside the code.

---

# TICKET 4 — Superuser staff-management page (web)

**Why:** The superuser needs a dedicated UI to create, list, disable, and delete staff accounts.

**Depends on:** Tickets 2 & 3.

**Files:**

- `app/routes.ts` — register the new route (see structure below)
- New `app/routes/staff_admin.tsx` (or similar)
- `app/services/firebase_app.ts` — get a callable-functions client (`getFunctions`, `httpsCallable` from `firebase/functions`); add an init export if not present
- `app/services/firebase_provider.tsx` / `app/routes/require_auth.tsx` — to gate the page to the superuser
- New service e.g. `app/services/staff_admin_service.ts` wrapping the callables

**Do:**

1. Add a protected route under `require_auth` → `app_layout` (mirror how `member/:user` is nested in `app/routes.ts:5-10`). Gate it to the superuser: compare `auth.currentUser.email` to the superuser email. ⚠️ **FLAG — exposing the superuser email to the client:** the env-configured email needs to be readable client-side to gate the UI (e.g. a `VITE_SUPERUSER_EMAIL`). The real authorization is enforced server-side in the callables (Ticket 2); the client check is just UX. Confirm you're OK exposing the superuser email to the bundle (it's not a secret, but note it).
2. Build the page:
    - **Create form:** email + first/last name (+ hospital if desired) → calls `createStaffAccount`. Show success ("invite sent") / error states. Reuse the form styling from `app/routes/create_account.tsx` for consistency.
    - **Staff list:** query Firestore `users` where `role in ["social_worker","admin"]` (reads already permitted to staff per rules). Show name, email, disabled state.
    - **Disable / Enable** toggle per row → `setStaffDisabled`.
    - **Delete** per row → `deleteStaffAccount`, with a confirmation. ⚠️ Avoid native `confirm()` dialogs in any flow you later automate with the browser tools; use an in-page confirm modal.
3. Add a nav entry to the page that's only visible to the superuser (e.g. in `app/routes/app_layout.tsx` top bar).

**Acceptance:**

- Superuser sees the page and nav link; other staff don't (and direct navigation is blocked/redirected).
- Create → new staff appears in the list and receives an invite email.
- Disable prevents that staff from logging in; enable restores it.
- Delete removes the account from both Auth and the list.

---

# TICKET 5 — Remove public self-signup (web)

**Why:** There must be no public signup — all staff come from the superuser. Today anyone can self-register as `social_worker` via `create_account.tsx` → `signUpWithEmail`.

**Depends on:** Ticket 4 (so a provisioning path exists before removing the old one).

**Files:**

- `app/routes.ts:15` — `route("create-account", "routes/create_account.tsx")`
- `app/routes/create_account.tsx`
- `app/services/auth_service.ts` — `signUpWithEmail` (lines 28-66)
- `app/routes/login.tsx` — likely links to "Create account"

**Do:**

1. Remove the `create-account` route from `app/routes.ts` and delete `app/routes/create_account.tsx` (or replace its body with a redirect to `/login`).
2. Delete `signUpWithEmail` from `app/services/auth_service.ts` (keep `loginWithEmail`). Remove now-unused imports (`createUserWithEmailAndPassword`, `sendEmailVerification`, `updateProfile`, `setDoc`, `Timestamp`).
3. Remove any "Create account / Sign up" links from `app/routes/login.tsx` and anywhere else they appear.
4. Grep for other references to `signUpWithEmail` / `create-account` and clean them up.

**Acceptance:**

- Navigating to `/create-account` no longer renders a signup form.
- No code path calls `signUpWithEmail`.
- Login still works; `npm run typecheck` and `npm run lint` pass.

---

# TICKET 6 — Unverified-patients review route (web)

**Why:** AC: _"Create an easily findable way to access unverified users."_ Staff need a dedicated place to review patients awaiting verification.

**Depends on:** Ticket 1 (index `role ASC, isVerified ASC`).

**Files:**

- `app/routes.ts` — register the new route under `require_auth` → `app_layout`
- New `app/routes/unverified.tsx` (or `review.tsx`)
- `app/routes/_index.tsx` — reference for the existing patient-list pattern (queries, pagination, table). Reuse its query/pagination structure rather than reinventing.
- `app/routes/app_layout.tsx` — add a nav entry/badge

**Do:**

1. Add a protected route (mirror `member/:user` nesting in `app/routes.ts`), e.g. `route("unverified", "routes/unverified.tsx")`.
2. Build a list of patients where `role == "patient"` **and** `isVerified == false`. Reuse the Firestore query + cursor-pagination approach already in `app/routes/_index.tsx` (it has `where("role","==","patient")`, `getCountFromServer`, cursor pagination via `startAfter`, 50/page). Add `where("isVerified","==", false)`.
    - ⚠️ **FLAG — banned patients:** decide whether the unverified list also shows denied (`isBanned: true`) patients. Suggested default: **exclude** banned ones (they've been actioned) and optionally provide a separate "Denied" filter. Confirm.
3. Each row links to the member page (`/member/:user`) where verify/deny happens (Ticket 7). Mirror the "View Profile" navigation in `_index.tsx` (`navigate('/member/${encodeURIComponent(id)}')`).
4. Add a findable entry point in the top bar (`app_layout.tsx`) — a nav link, ideally with a count badge of pending-verification patients (reuse the `getCountFromServer` pattern). ⚠️ **FLAG:** a count badge is my guess for "easily findable"; a plain link is fine if you'd rather keep it simple.

**Acceptance:**

- A clearly labeled nav entry leads to a page listing only unverified patients.
- Rows link through to the member page.
- Pagination/empty/loading states handled like the main dashboard.

---

# TICKET 7 — Verify / Deny controls on member page (web)

**Why:** AC: _"Add a simple way to verify or deny."_ Verifying sets the verified flag; denying bans the user and leaves them unverified.

**Depends on:** Ticket 1.

**Files:**

- `app/routes/member.tsx` — specifically the **"Patient Controls"** panel (`~lines 674-809`) and the `handleStatusChange` handler (`~lines 643-666`), which is the exact pattern to copy.

**Do:**

1. In the live patient-doc subscription (member.tsx subscribes to the patient doc ~line 174-195 and reads `status`), also read `isVerified` and `isBanned` into local state.
2. Add two handlers next to `handleStatusChange`, following its exact shape (optimistic local update → `updateDoc(doc(db,"users",userId), {...})` → revert + `setMemberActionError` on failure → `setIsSaving...` in finally):
    - `handleVerify()` → `updateDoc(..., { isVerified: true, isBanned: false, updatedAt: ... })`.
    - `handleDeny()` → `updateDoc(..., { isBanned: true, isVerified: false, updatedAt: ... })` (ban + stay unverified, per AC).
3. Add the UI inside the "Patient Controls" panel, alongside "Patient Status" — a "Verification" group with **Verify** and **Deny** buttons. Reuse the existing button styling (the status pill buttons at lines 781-803). Show current state: Verified / Unverified / Denied (banned). Disable the irrelevant action (e.g. hide "Verify" if already verified).
    - ⚠️ **FLAG:** placing these in the existing Patient Controls accordion is my call for "simple." Move it to the profile header if you want it more prominent.
4. Make sure the rules from Ticket 1 permit these exact field writes.

**Acceptance:**

- Verify sets `isVerified: true` (and clears `isBanned`) on the user doc; UI reflects it live.
- Deny sets `isBanned: true` and leaves `isVerified: false`; UI reflects it live.
- Failures revert optimistic state and surface the existing `memberActionError` message.
- `npm run typecheck` passes.

---

# Mobile follow-ups (separate repo — notes, not tickets)

These live in the **patient mobile app** (not in this repo), so they're recorded as notes to hand off / write up there:

1. **Patient signup defaults.** Confirm mobile patient signup writes `isVerified: false` (and ideally `isBanned: false`) on the `users/{uid}` doc. The web `onUserCreated` Cloud Function (`functions/src/index.ts:32-46`) already backfills `status: "closed"` for new patients but does **not** set verification fields — so the mobile client must set them, or extend `onUserCreated` to default `isVerified: false` for patients that lack it. ⚠️ Verify current mobile behavior.
2. **Banned-status messaging.** AC: _"mobile banned status should have different text depending on if the user is verified or not."_ When a banned user (`isBanned: true`) opens the app, show different copy depending on `isVerified` — e.g. verified-then-banned vs. never-verified-and-denied. Needs the exact two strings from the client.
3. **Block chat for unverified users (mobile only).** AC marked _"need a conversation with the client before making this a hard requirement."_ On mobile, block/hide the chat for `isVerified == false` patients until verified. **Do not build until the client confirms** this is a hard requirement.

---

## Verification (for the web tickets)

- **Type/lint:** `npm run typecheck`, `npm run lint` at repo root after each web ticket.
- **Functions:** `cd functions && npm run build`; run the emulator with `npm run serve` and exercise `createStaffAccount` / disable / delete with the superuser identity and a non-superuser identity (expect `permission-denied`).
- **Rules:** test the new `users` `allow update` against allowed vs. disallowed field sets (Firestore emulator rules tests, or manual via the dashboard).
- **End-to-end (web):** run `npm run dev`, log in as the superuser → create a staff account → confirm the invite email + a new row in the list → log in as that staff → open the unverified-patients page → open a patient → Verify and Deny, confirming the live UI + Firestore doc both update.
- **Seed data:** `scripts/seed-patients.mjs` (see `docs/dashboard-and-routing.md`) populates fake patients; extend it to set some `isVerified: false` so the unverified page has data.
