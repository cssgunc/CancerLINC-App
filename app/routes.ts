import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/login.tsx"),
    route("_index", "routes/_index.tsx"),
    route("forgot-pass", "routes/forgot_pass.tsx"),
    route("verify-email", "routes/verify_email.tsx"),
    route("change-password", "routes/change_password.tsx"),
    route("create-account", "routes/create_account.tsx"),
    route("verify-signup", "routes/verify_signup.tsx"),
] satisfies RouteConfig;
