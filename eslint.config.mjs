import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import globals from "globals";

const WEB = ["apps/web/**/*.{ts,tsx}"];
const NODE_SERVER = ["apps/collab-server/**/*.ts"];

/**
 * eslint-config-next ships unscoped config objects. In a monorepo we only want
 * them applied to apps/web, but entries that exist purely to declare global
 * ignores must stay global — attaching `files` to those would demote them.
 */
function scopeToWeb(configs) {
  return configs.map((config) => {
    if (config.files) return config;
    const isGlobalIgnores =
      config.ignores && !config.rules && !config.plugins && !config.languageOptions;
    if (isGlobalIgnores) return config;
    return { ...config, files: WEB };
  });
}

/**
 * Rules chosen to catch the classes of bug this codebase has actually hit:
 * unawaited promises in event handlers, effects with lying dependency arrays,
 * and non-null assertions standing in for real narrowing.
 */
const antiPatternRules = {
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": [
    "error",
    { checksVoidReturn: { attributes: false } },
  ],
  "@typescript-eslint/await-thenable": "error",
  "@typescript-eslint/no-unnecessary-type-assertion": "error",
  "@typescript-eslint/no-non-null-assertion": "warn",
  "@typescript-eslint/consistent-type-imports": [
    "warn",
    { prefer: "type-imports", fixStyle: "separate-type-imports" },
  ],
  "@typescript-eslint/no-unused-vars": [
    "error",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
  ],
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-unsafe-assignment": "off",
  "@typescript-eslint/no-unsafe-member-access": "off",
  "@typescript-eslint/no-unsafe-call": "off",
  "@typescript-eslint/no-unsafe-argument": "off",
  "@typescript-eslint/no-unsafe-return": "off",
  "@typescript-eslint/restrict-template-expressions": "off",
  "no-console": ["warn", { allow: ["warn", "error", "info"] }],
  eqeqeq: ["error", "always", { null: "ignore" }],
  "prefer-const": "error",
  "no-var": "error",
};

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/out/**",
      "**/*.tsbuildinfo",
      "**/next-env.d.ts",
      "apps/web/public/**",
    ],
  },

  js.configs.recommended,

  // Type-aware linting for every TypeScript file in the workspace.
  {
    files: ["**/*.{ts,tsx,mts}"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: antiPatternRules,
  },

  ...scopeToWeb(nextVitals),
  ...scopeToWeb(nextTs),

  // React-specific tightening. exhaustive-deps is an error here because stale
  // closures in the Yjs/Pixi effects are silent correctness bugs, not style.
  {
    files: WEB,
    settings: { next: { rootDir: "apps/web/" } },
    rules: {
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",
      // Pages Router only; this app is App Router, so there is no pages/
      // directory for the rule to resolve internal links against. (The plugin
      // still prints a one-line notice about that on load — harmless, and not
      // a lint finding.)
      "@next/next/no-html-link-for-pages": "off",
    },
  },

  {
    files: NODE_SERVER,
    languageOptions: { globals: globals.node },
  },

  // Config files are plain modules; type-aware rules have no project for them.
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { "no-console": "off" },
  },
);
