import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "jest.config.js", "eslint.config.mjs"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Nest controllers and modules rely on decorators for their metadata,
      // so classes with no explicit members are expected.
      "@typescript-eslint/no-extraneous-class": "off",
    },
  },
);
