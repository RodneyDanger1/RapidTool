// MAPPER-2 scratch probe config — extends the repo config with type-aware rules
// the repo does NOT enable. Throwaway; delete before finishing.
import base from "./eslint.config.mjs";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...base,
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/no-duplicate-type-constituents": "error",
    },
  },
);
