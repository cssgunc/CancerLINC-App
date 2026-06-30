# Verify-Users Feature — Mobile Tickets

## Context

When patients sign up via this **mobile app** they start **unverified and
unbanned**. A CancerLINC social worker later verifies them (manual email-vs-CRM
lookup) or denies/bans them, from the **web dashboard** (`cancerlinc-web`). That
web work is tracked in the web repo's own ticket doc; this file covers only the
**mobile Flutter app** (`cancerlinc/`).

**Scoping decision:** the banned/verified states only affect the **Chat page**.
Every other page (Home, Checklist, Referrals, Calendar) is static content with no
social-worker interaction, so banned/unverified users keep full access to them.
There is **no app-wide lockout** — all state-based gating happens inside
`chat_page.dart`.

### ⚠️ Schema is owned by the web design doc — this is the source of truth

The web dashboard reads/writes these fields, so mobile must match them **exactly**.
Per the web design doc:

| Field        | Type | Meaning                                   | Default at mobile signup | Flipped by                                   |
|--------------|------|-------------------------------------------|--------------------------|----------------------------------------------|
| `isVerified` | bool | **Social-worker** verification (vs CRM)   | `false`                  | Web: Verify → `true`; Deny → `false`         |
| `isBanned`   | bool | Patient denied/banned                     | `false`                  | Web: Deny → `true`; Verify → `false`         |

> **IMPORTANT — semantic change to `isVerified`.** In the current mobile code,
> the Firestore `isVerified` field is set to the Firebase **email**-verified value
> (`auth.dart:104,124`). The web schema instead uses `isVerified` to mean
> **social-worker verified**. We confirmed the Firestore `isVerified` field is
> **write-only in mobile — never read anywhere** (grep: only `auth.dart` touches
> it). All mobile **email**-verification gating uses the Firebase Auth
> `emailVerified` *property* directly (`main.dart:45`, `login_page.dart:190`,
> `verify_email.dart:26`), which is unaffected. So we repurpose the Firestore
> `isVerified` field to the web's meaning with **no impact on email gating**.

**Web coupling to know:** the web "Deny" action sets `isBanned: true` **and**
`isVerified: false` together; "Verify" sets `isVerified: true` and clears
`isBanned`. So under the documented web flow a banned patient is always also
unverified. (See the M3 note on the "verified-but-banned" copy — it's a defensive
edge case rather than a normally reachable state.)

> ⚠️ **FLAG — field names:** taken from the web design doc (`isVerified`,
> `isBanned`). If the web team changes them, update this file.
**Human Note**: Go with whatever the web repo says.

> ⚠️ **FLAG — `status` value drift (out of scope, FYI):** mobile signup writes
> `status: 'follow-up'` (`auth.dart:103`); the web `onUserCreated` function
> backfills new patients to `status: 'closed'`. Not part of this feature — flag to
> the team so the two don't fight, but don't fix it in these tickets.
**Human Note**: Lets keep the status as closed when a new user is created

Build order: **M1 → M2 → M3 → M4.** M1 is foundational. M2 (AuthGate) is an
independent refactor. M3 and M4 both edit the Chat page; M4 extends M3.

---

## TICKET M1 — Start every signup unbanned + unverified (data model)

**Repo:** `cancerlinc` (Flutter mobile) · **Depends on:** nothing · **Do first.**

### Goal
Every newly created `users/{uid}` document carries `isVerified: false` (now
meaning *social-worker* verified) and `isBanned: false`. Mobile must **stop**
writing the email-verified value into `isVerified`, and must never overwrite
either field once the web flips it.

### Where
`lib/services/auth.dart` → `ensureUserDocument()` (called from both `register()`
at `auth.dart:29` and `signIn()` at `auth.dart:14`). The `defaults` map is
`auth.dart:91-106`; the create path is `auth.dart:108-118`; the backfill path is
`auth.dart:120-130`.

### How
1. In the `defaults` map, change the verification line and add the ban flag:
   - `auth.dart:104` `'isVerified': firebaseUser.emailVerified,` → `'isVerified': false,`
   - add `'isBanned': false,`
2. In the backfill block (`auth.dart:120-130`), **delete** the forced-overwrite
   line `auth.dart:124` `'isVerified': firebaseUser.emailVerified,`. After this,
   the only writers of `isVerified`/`isBanned` from mobile are the `defaults`,
   which the existing `_hasMeaningfulValue` backfill (`auth.dart:121-126`) applies
   **only when the field is absent** — so a web-set `true` is preserved (for a
   bool, `_hasMeaningfulValue(true/false)` is non-null → skipped), and a missing
   field is seeded to `false`. Keep `'updatedAt': now` in the backfill.
3. No other files change. Email-verification gating elsewhere uses the Auth
   `emailVerified` property and is untouched.

### ⚠️ Migration note (existing/test docs)
Docs created under the old behavior have `isVerified` reflecting *email*-verified
(can be `true`). Under the new meaning those would read as already
social-worker-verified. Since this is pre-launch, reset existing user docs'
`isVerified` to `false` (one-off Firestore script/console) so nobody is
accidentally treated as verified. Flag if there's real patient data.

### Acceptance criteria
- A brand-new account's doc shows `isVerified == false` and `isBanned == false`.
- Setting `isVerified: true` (or `isBanned: true`) in the Firestore console, then
  signing in again on mobile, does **not** reset it.
- Email login/verification still works exactly as before (uses the Auth property).

### Verify
`cd cancerlinc && flutter analyze`, then `flutter run`, create an account, inspect
the doc in the Firebase console, and confirm email-verify login is unaffected.

---

## TICKET M2 — AuthGate: centralize login-vs-app routing

**Repo:** `cancerlinc` (Flutter mobile) · **Depends on:** nothing (independent of
M1; does not read `isVerified`/`isBanned`).

### Goal
Replace the duplicated session/email-verified logic in `main.dart` and
`login_page.dart` with a single `AuthGate` widget that decides between the login
flow and the app. It gates only on auth state + the Firebase **email**-verified
property — **not** on `isVerified`/`isBanned` (that's the Chat page's job).

### Background (current routing)
- `main.dart:44-64` decides the home screen synchronously from
  `FirebaseAuth.instance.currentUser` + `emailVerified`.
- `login_page.dart:184-206` signs in, blocks if `emailVerified == false`
  (signs out + inline error), else pushes `BottomBar`.

### How
1. Create `lib/pages/auth_gate.dart` — `AuthGate` uses a `StreamBuilder` on
   `AuthService().authStateChanges()` (`auth.dart:12`):
   - no user, or `user.emailVerified == false` → `LoginPage`;
   - user present + email verified → `BottomBar`.
2. Point `main.dart` home at `const AuthGate()` (replace the
   `isLoggedIn ? BottomBar : LoginPage` ternary at `main.dart:64`); the
   synchronous `currentUser`/`emailVerified` block at `main.dart:44-45` can go.
3. Leave `login_page.dart`'s post-sign-in `emailVerified` check
   (`login_page.dart:190-194`) as-is (inline "verify your email" error). Optional:
   once `AuthGate` is home, drop the explicit `pushReplacement(BottomBar)` at
   `login_page.dart:195-200` and let the gate route — only if it doesn't regress UX.

### Acceptance criteria
- Logged-out → LoginPage; logged-in + email-verified → app; logged-in but
  email-unverified → LoginPage/verify path (same as today).
- Cold start and hot restart both land correctly with no login flash.
- No change for banned/unverified users at this layer — they still reach the full
  app (Chat gating is M3/M4).

### Verify
`flutter analyze` + `flutter run`; test logged-out, logged-in-verified, and
logged-in-but-email-unverified.

---

## TICKET M3 — Chat page: block banned users (verification-dependent copy)

**Repo:** `cancerlinc` (Flutter mobile) · **Depends on:** M1. **Firm requirement.**

### Goal
A banned patient (`isBanned == true`) cannot use chat. The Chat tab shows a
blocking message instead of the message list + input, and the **text differs**
depending on `isVerified`. The rest of the app stays usable.

### Where
`lib/pages/chat_page.dart`, inside `_ChatPageState`. `_loadChat()` is
`chat_page.dart:39-54`; `build()` is `chat_page.dart:56-87`; the input widget is
`_ChatInput` (`chat_page.dart:77-82`, `:435+`).

### How
1. Add fields to `_ChatPageState`: `bool _isBanned = false;` and
   `bool _isVerified = false;`.
2. In `_loadChat()` the user doc is already fetched (`chat_page.dart:42-43`) for
   `assignedSocialWorkerName`. From that same `userDoc.data()` read:
   ```dart
   _isBanned   = data?['isBanned'] == true;
   _isVerified = data?['isVerified'] == true;
   ```
   No extra query.
3. In `build()`, when `_isBanned`, render a centered blocking notice (reuse the
   empty-state `Text` style at `chat_page.dart:66-71`) and **omit** the
   `_ChatInput` (`chat_page.dart:77-82`). Branch the copy on `_isVerified`
   (⚠️ **FLAG — best-guess wording, confirm with client/CancerLINC**):
   - `_isVerified == true`: "Your chat access has been removed. If you think this
     is a mistake, contact CancerLINC at [phone]."
   - `_isVerified == false`: "We couldn't verify your account, so chat isn't
     available. If you're a CancerLINC client, please reach out at [phone]."
   Pull the support number from `lib/components/call_number.dart` rather than
   hardcoding.
4. Defense in depth: early-return in `_ChatInput._send()` (`chat_page.dart:460`)
   and `_pickAndSendImage()` (`chat_page.dart:483`) when banned.

> **Note on the two-text requirement:** the web "Deny" action sets `isBanned: true`
> **and** `isVerified: false` together, so a banned patient is normally always
> unverified — the `_isVerified == true` banned copy is a defensive edge case
> (e.g., if the web later adds a "ban a verified patient" action). Keep both
> branches per the AC, but don't be surprised if only the unverified copy shows in
> practice.

### Acceptance criteria
- `isBanned: true` + `isVerified: false` → Chat shows the **unverified** banned
  copy, no input. (Normal denied state.)
- `isBanned: true` + `isVerified: true` → Chat shows the **verified** banned copy,
  no input. (Edge case; still handled.)
- `isBanned: false` → Chat behaves as today (the unverified non-banned gate is M4).
- Home/Checklist/Referrals/Calendar remain fully usable for banned patients.

### Verify
`flutter analyze` + `flutter run`; toggle `isBanned`/`isVerified` in the Firebase
console and open the Chat tab for each combination.

---

## TICKET M4 — Chat page: block unverified users  ⛔ BLOCKED (soft requirement)

**Repo:** `cancerlinc` (Flutter mobile) · **Depends on:** M1 + M3.

> ⚠️ **BLOCKED — do not merge until the client confirms this should be a hard
> requirement** (per the backlog). Build it on top of M3's gating so it's ready to
> ship on sign-off. See the companion client-conversation prompt below.

### Goal
A non-banned patient who is **not socially verified** (`isBanned == false`,
`isVerified == false`) cannot send chat messages. The Chat tab shows a "pending
verification" notice instead of the message list + input.

### How
M3 already loads `_isBanned`/`_isVerified` and branches `build()`. Add one branch
**after** the banned check:
- `!_isBanned && !_isVerified` → centered notice (reuse the empty-state style):
  "Your account is pending verification by a CancerLINC social worker. You'll be
  able to chat once you're verified." — and omit `_ChatInput`.
  ⚠️ **FLAG — confirm notice copy with client.**
- else (verified, not banned) → normal chat.

Also extend the M3 send-path early-returns to cover `!_isVerified`.

> Note: client-side UX only. True enforcement needs Firestore security rules in the
> shared Firebase project (the web repo owns rules) — flag to the backend owner if
> hard enforcement is required.

### Acceptance criteria
- `isBanned: false` + `isVerified: false` → pending notice, no input, cannot send.
- `isBanned: false` + `isVerified: true` → chat works as today.
- Banned cases still behave per M3.

### Verify
`flutter analyze` + `flutter run`; toggle `isVerified` in Firestore and open the
Chat tab for each state.

---

## COMPANION (non-software) — Client conversation prompt for the chat-block decision

> Paste this into an AI to generate talking points before committing M4.

"I'm building a patient support app where new signups are 'unverified' until a
social worker manually verifies them against our CRM. We're deciding whether to
**hard-block the in-app chat for unverified users**. Generate a concise
bullet-point list of (a) questions to ask the CancerLINC client to decide this,
and (b) the trade-offs to walk them through — covering: risk of unverified
strangers reaching social workers, whether a limited/triage chat is preferable to
a full block, support-burden if legitimate patients are blocked while waiting,
and what fallback contact method unverified users should see. Keep it to talking
points I can bring to a 15-minute client call."

---

## Cross-repo alignment (read before starting)

- **Schema source of truth = the web design doc.** Fields: `isVerified` (bool,
  social-worker verification) and `isBanned` (bool). Mobile defaults both to
  `false` at signup; the web Verify/Deny actions flip them.
- The web repo also handles the social-worker dashboard, unverified-patient review
  route, verify/deny controls, and superuser staff provisioning — **none of that
  is mobile work.** The web doc's "Mobile follow-ups" notes map to the tickets
  here (M1 = signup defaults; M3 = banned messaging; M4 = block chat for
  unverified).
- The web doc notes its `onUserCreated` function does **not** set verification
  fields, so **mobile is responsible** for writing `isVerified: false` /
  `isBanned: false` at signup (exactly what M1 does).

## Global verification (all tickets)
- `cd cancerlinc && flutter analyze` is clean.
- `flutter run` and exercise: new signup writes `isVerified:false`/`isBanned:false`
  (M1); AuthGate routing (M2); Chat tab across banned/verified combinations
  (M3/M4) by toggling fields in the Firebase console. Confirm non-Chat pages stay
  open in every state, and email-verify login still works.
- No automated tests exist for these paths today; manual Firestore-console
  toggling is the practical end-to-end check.
