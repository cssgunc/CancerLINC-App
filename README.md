# CancerLINC

CancerLINC connects cancer patients with support resources and staff. This
repo holds the full application: a Firebase backend, a React web app, and a
Flutter mobile app, all backed by the same Firebase project.

## Structure

```text
.
+-- backend   Firebase Cloud Functions, Firestore/Storage rules and indexes
+-- web       React Router web app (patient + staff/admin UI)
+-- mobile    Flutter mobile app
```

Each has its own setup and run instructions:

- [backend/README.md](backend/README.md)
- [web/README.md](web/README.md)
- [mobile/README.md](mobile/README.md)
