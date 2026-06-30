# Superuser & Staff-Invite Email — Setup Guide

This guide covers the **out-of-code configuration** needed to make the superuser
staff-management system and the automated invite email work. The code is already
in the repo; this is the wiring (env vars, Firebase extension, DNS) you have to
do by hand.

> Quick mental model:
>
> - **Superuser** = one email address, hard-checked server-side, that is allowed
>   to create / disable / delete staff accounts.
> - **Invite email** = when the superuser creates a staff account, a Cloud
>   Function writes a doc to the `mail` collection; the **Trigger Email** Firebase
>   extension reads that doc and actually sends the email.
>
> There is **no public signup** — every staff account is provisioned by the
> superuser.

---

## Part 1 — Configure the superuser

The superuser is identified purely by email address. It is **not** a role on a
user document; it is checked in two places:

1. **Server-side (the real gate)** — the Cloud Functions param `SUPERUSER_EMAIL`.
   Every provisioning callable (`createStaffAccount`, `setStaffDisabled`,
   `deleteStaffAccount`) rejects callers whose auth email doesn't match this.
2. **Client-side (UX only)** — the Vite env var `VITE_SUPERUSER_EMAIL`. This only
   decides whether the **Staff** nav link and `/staff` page are shown. It is not
   a security boundary; it just hides UI from non-superusers.

**These two values must be the same email** (the comparison is case-insensitive).

### 1a. Pick the superuser account

The email must belong to a **real Firebase Authentication user** that can log in
to the web dashboard (so the superuser can sign in and reach `/staff`). If that
account doesn't exist yet, create it in **Firebase console → Authentication →
Users → Add user**, then make sure a matching `users/{uid}` doc exists with a
staff role (`social_worker` or `admin`) so the rest of the dashboard treats them
as staff.

### 1b. Set the server-side param (`SUPERUSER_EMAIL`)

**Local emulator** — create `functions/.env` (git-ignored):

```
SUPERUSER_EMAIL=admin@your-domain.com
```

**Production** — set the param, then deploy functions:

```bash
firebase functions:params:set SUPERUSER_EMAIL=admin@your-domain.com
firebase deploy --only functions
```

You can also manage it in **Firebase console → Functions → Configuration →
Parameters**.

### 1c. Set the client-side gate (`VITE_SUPERUSER_EMAIL`)

In the web app's environment (`.env` locally, and your hosting provider's env
settings in production — e.g. Firebase Hosting / Vercel / Netlify build env):

```
VITE_SUPERUSER_EMAIL=admin@your-domain.com
```

> ⚠️ This value is baked into the client bundle at build time. It is not a
> secret (it's just an email used to toggle UI), but be aware it ships to the
> browser. The actual authorization lives server-side in step 1b. After changing
> it you must **rebuild/redeploy** the web app.

See `.env.template` for the full list of env vars and `functions/README.md` for
the canonical functions config reference.

---

## Part 2 — Set up the invite email (Trigger Email extension)

When the superuser creates a staff account, the function generates a Firebase
password-reset ("set your password") link and writes an email document to the
`mail` Firestore collection. **The function does not send email itself** — the
Trigger Email extension does. Until the extension is installed, accounts are
still created but **no email goes out**.

### Step 1 — Install the "Trigger Email from Firestore" extension

Firebase console → **Extensions** → search **"Trigger Email from Firestore"** →
Install. When prompted, configure:

- **Email documents collection** — `mail` (must match exactly; this is the
  collection the function writes to).
- **SMTP connection URI** — a transactional email provider. Examples:
    - SendGrid: `smtps://apikey:<SENDGRID_API_KEY>@smtp.sendgrid.net:465`
    - Mailgun / Postmark / AWS SES — use their SMTP credentials.
- **Default FROM address** — e.g. `CancerLINC <noreply@your-domain.com>`. Use a
  domain you control and can add DNS records for (Step 3).

### Step 2 — Verify a sender identity

In your provider, verify the sending domain (preferred) or a single sender
address:

- **SendGrid** — Settings → Sender Authentication → verify a Domain or Sender.
- **Postmark** — add a Sender Signature or verify a Domain.
- **AWS SES** — verify the domain/identity and move out of the SES sandbox.

### Step 3 — Add DNS records for deliverability (SPF / DKIM / DMARC)

Add these to the sending domain's DNS zone. Your provider gives you the exact
values during sender verification.

| Type  | Name / Host       | Purpose                                     |
| ----- | ----------------- | ------------------------------------------- |
| TXT   | `@` or subdomain  | **SPF** — authorizes the SMTP provider      |
| CNAME | provider-supplied | **DKIM** — cryptographically signs mail     |
| TXT   | `_dmarc`          | **DMARC** — policy for unauthenticated mail |

Start with a relaxed DMARC policy and tighten over time:

```
v=DMARC1; p=none; rua=mailto:dmarc-reports@your-domain.com
```

Move to `p=quarantine`, then `p=reject`, once you've confirmed legitimate mail
passes SPF + DKIM. DNS can take up to 48 hours to propagate.

### Step 4 — Test end to end

1. Log in as the superuser → open **/staff** → create a test staff account using
   a **Gmail** address and again with an **Outlook/Hotmail** address.
2. Check both the **inbox and the spam/junk folder**.
3. Open the email, click the **set-password link**, set a password, and confirm
   the new staff member can log in at `/login`.
4. Validate authentication with [mail-tester.com](https://www.mail-tester.com)
   or [MXToolbox Email Headers](https://mxtoolbox.com/EmailHeaders.aspx) — SPF
   and DKIM should both pass.
5. The invite email includes a "mark this sender as **Not Junk** / safe-sender"
   instruction — important especially for Outlook/Microsoft 365 recipients so
   future CancerLINC emails land in the inbox.

---

## Quick checklist

- [ ] Superuser Firebase Auth user exists and can log in (staff `users/{uid}` doc).
- [ ] `SUPERUSER_EMAIL` set (functions param / `functions/.env`) and functions deployed.
- [ ] `VITE_SUPERUSER_EMAIL` set to the same email and web app rebuilt/redeployed.
- [ ] Trigger Email extension installed, pointed at the `mail` collection, with SMTP creds.
- [ ] Sender identity verified with the email provider.
- [ ] SPF, DKIM, DMARC DNS records added and passing.
- [ ] Test invite delivered to Gmail + Outlook, set-password link works, login succeeds.

---

## Troubleshooting

- **Superuser can't see the Staff page / nav link** → `VITE_SUPERUSER_EMAIL`
  is missing or doesn't match the logged-in email; rebuild the web app after
  setting it.
- **`permission-denied` when creating staff** → the logged-in email doesn't
  match the server-side `SUPERUSER_EMAIL`, or functions weren't redeployed after
  setting the param.
- **Account is created but no email arrives** → the Trigger Email extension
  isn't installed, is pointed at the wrong collection (must be `mail`), or the
  SMTP credentials are wrong. Check the extension's logs and the `mail` doc's
  `delivery` field in Firestore.
- **Emails land in spam** → SPF/DKIM/DMARC not fully configured or the FROM
  domain doesn't match the verified sender identity.

Related files: `.env.template`, `functions/README.md`,
`functions/src/index.ts` (the `createStaffAccount` callable + `mail` write),
`app/routes/staff_admin.tsx` (the superuser management page).
