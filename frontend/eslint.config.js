import eslint from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";

export default [
  { ignores: ["dist/**", "node_modules/**", "test-results/**", "playwright-report/**"] },
  {
    files: ["src/**/*.{js,jsx}"],
    ...eslint.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { react },
    rules: {
      ...eslint.configs.recommended.rules,
      "no-undef": "error",
      "no-unused-vars": "off",
      "no-empty": "off",
      "no-useless-escape": "off",
      "no-case-declarations": "off",
      "no-prototype-builtins": "off",
      "no-constant-binary-expression": "off",
      "react/jsx-no-undef": "error",
    },
    settings: { react: { version: "detect" } },
  },
  {
    files: ["src/**/*.{test,spec}.{js,jsx}", "src/test/**"],
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.vitest } },
  },
];
