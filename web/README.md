# CancerLINC Web

React Router web app for CancerLINC, covering both the patient-facing site
and the staff/admin UI.

## Setup

Install dependencies:

```sh
npm install
```

Copy the env template and fill in the Firebase project values:

```sh
cp .env.template .env
```

`.env` needs:

- `VITE_FIREBASE_*`: client Firebase config for the target project.
- `SUPERUSER_EMAIL` / `VITE_SUPERUSER_EMAIL`: the staff-provisioning
  superuser email. These must match; the `VITE_` one only gates UI (showing
  the Staff nav link and `/staff` page) while enforcement happens server-side
  in the backend (see [../backend/README.md](../backend/README.md)).

Ask a team lead for these values

## Run

Start the dev server:

```sh
npm run dev
```

The app runs at `http://localhost:5173`.

## Other scripts

```sh
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # react-router typegen + tsc
npm run lint        # eslint
npm run lint:fix    # eslint --fix
npm run format      # prettier --write
```

## Docs

Feature-specific implementation notes live in [docs/](docs/).

## Git hooks

The pre-commit hook (lint + format against `web/`) lives in `../.husky/` at
the repo root. `npm install` (above) wires it up automatically via the
`prepare` script, which runs `husky` from the repo root since `.husky/` lives
one level up from `web/`.
