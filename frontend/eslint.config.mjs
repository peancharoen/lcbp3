import js from "@eslint/js";
import globals from "globals";
import typescriptParser from "@typescript-eslint/parser";

const eslintConfig = [
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // Allow console statements in development
      "no-console": "off",
      "no-unused-vars": "warn",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // Allow console statements in development
      "no-console": "off",
      "no-unused-vars": "off", // TypeScript handles this better
      "no-undef": "off", // TypeScript handles this better
    },
  },
  // Ignore config files and build outputs
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "build/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
    ],
  },
];

export default eslintConfig;
