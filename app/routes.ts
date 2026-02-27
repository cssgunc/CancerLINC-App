import { index, route } from "@react-router/dev/routes";

export default [
    //protected routes
    route("", "routes/require_auth.tsx", [
        index("routes/_index.tsx"),
        route("member", "routes/member.tsx"),
    ]),

    //routes require user to not be logged in
    route("", "routes/require_guest.tsx", [
        route("login", "routes/login.tsx"),
        route("create-account", "routes/create_account.tsx"),
    ]),

    //routes available to anyone
    route("forgot-pass", "routes/forgot_pass.tsx"),
    route("verify-email", "routes/verify_email.tsx"),
];
