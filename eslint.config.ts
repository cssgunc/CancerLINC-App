import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
    // Ignore generated output
    {
        ignores: ["build/**"],
    },

    // Base configuration for all relevant files
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
        plugins: { js },
        extends: [js.configs.recommended],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            // Set 'no-console' to a warning instead of an error
            "no-console": "warn",
        },
    },

    // Recommended TypeScript rules
    tseslint.configs.recommended,

    // Recommended React rules with custom settings
    {
        ...pluginReact.configs.flat.recommended,
        settings: {
            react: {
                version: "detect",
            },
        },
        rules: {
            // Disables strict rules that were causing issues
            "react/react-in-jsx-scope": "off",
            "react/prop-types": "off",
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-namespace": "off",
        },
    },
]);
