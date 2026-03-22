import js from "@eslint/js";
import globals from "globals";
import typescriptParser from "@typescript-eslint/parser";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import reactHooksPlugin from "eslint-plugin-react-hooks";

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
      "no-console": "error",
      "no-unused-vars": "error",
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
    plugins: {
      "@typescript-eslint": typescriptPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      "no-console": "error",
      "no-unused-vars": "off",
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='parseInt']",
          message: '❌ parseInt() is forbidden (UUID risk)',
        },
        {
          selector: "UnaryExpression[operator='+']",
          message: '❌ +value is forbidden (UUID risk)',
        },
      ],
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
