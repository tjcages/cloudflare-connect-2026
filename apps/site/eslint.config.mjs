import eslintReact from "@eslint-react/eslint-plugin";
import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier/flat";

/**
 * Lean flat config that mirrors the rules the previous Biome (ultracite) setup
 * actually enforced — not ultracite's much broader stock ESLint preset, which
 * pulls in unicorn/sonarjs/github/promise/n and would rewrite files Biome never
 * touched. Formatting + Tailwind class order are owned by Prettier
 * (prettier.config.mjs), so this config is lint-only and intentionally does NOT
 * re-sort imports / JSX props / object keys (Biome's orderings differ from any
 * ESLint plugin's, and re-sorting would churn the whole repo).
 *
 * Type-aware linting is deliberately omitted (no parserOptions.project) to keep
 * ESLint fast at scale; `astro check` in the `typecheck` script covers types.
 */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      ".wrangler/**",
      ".astro/**",
      ".claude/**",
      "node_modules/**",
      "worker-configuration.d.ts",
      "**/*.gen.*",
      // Bundled WebGL engine copy (minified) — do not lint.
      "vendor/stripes-engine/core/**",
      // Packaged Twizzler build output — source is linted in its own workspace.
      "vendor/connect-twizzler/dist/**",
      // Packaged panel build output — source is linted in its own workspace.
      "vendor/panels/dist/**",
    ],
  },

  // ---- Base JS/TS ----
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: { unicorn },
    rules: {
      // --- Mirrors of Biome core rules (autofixable, already satisfied repo-wide) ---
      "prefer-const": "error", // useConst
      "prefer-template": "error", // useTemplate
      "operator-assignment": ["error", "always"], // useShorthandAssign
      "unicorn/prefer-node-protocol": "error", // useNodejsImportProtocol
      // useImportType — but allow inline `import()` types (Biome's useImportType does too)
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { disallowTypeAnnotations: false },
      ],
      "@typescript-eslint/prefer-function-type": "error", // useShorthandFunctionType

      // --- Their explicit Biome rule-offs, replicated so behavior matches ---
      "@typescript-eslint/no-explicit-any": "off", // noExplicitAny
      "@typescript-eslint/no-non-null-assertion": "off", // noNonNullAssertion
      "no-console": "off", // noConsole
      "no-async-promise-executor": "off", // noAsyncPromiseExecutor
      "@typescript-eslint/no-invalid-void-type": "off", // noConfusingVoidType
      "no-magic-numbers": "off", // noMagicNumbers
      "@typescript-eslint/consistent-type-definitions": "off", // useConsistentTypeDefinitions
      "no-param-reassign": "off", // noParameterAssign
      "no-shadow": "off", // noShadow
      "@typescript-eslint/no-shadow": "off",
      "no-plusplus": "off", // noIncrementDecrement
      curly: "off", // useBlockStatements
      "unicorn/filename-case": "off", // useFilenamingConvention
      "@typescript-eslint/explicit-member-accessibility": "off", // useConsistentMemberAccessibility
      "@typescript-eslint/no-empty-object-type": "off", // not enforced by Biome (augmentation pattern)
      // unused-vars: keep as warn (Biome surfaced these but their code is clean)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Bans className={`${dynamic} static`} classes.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'JSXAttribute:matches([name.name=/^(class|className)$/], [name.namespace.name="class"]) TemplateLiteral[expressions.length>0]:has(TemplateElement[value.raw=/\\s/])',
          message:
            "No template-literal class list. Use cn([...]) instead — a single class NAME with no whitespace (e.g. `eyebrow-${brand}`) is fine as-is.",
        },
      ],
    },
  },

  // ---- React (.jsx / .tsx) ----
  // @eslint-react (ESLint-10-native) replaces eslint-plugin-react, which calls
  // context APIs removed in ESLint 10. Covers the old Biome mirrors
  // (no-children-prop → jsx-no-children-prop, jsx-key → no-missing-key,
  // void-dom-elements-no-children → dom-no-void-elements-with-children);
  // useSelfClosingElements/useFragmentSyntax have no equivalent and are dropped.
  {
    files: ["**/*.{jsx,tsx}"],
    ...eslintReact.configs["recommended-typescript"],
  },
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error", // useHookAtTopLevel
      "react-hooks/exhaustive-deps": "off", // useExhaustiveDependencies (off)
      // defer hook linting to eslint-plugin-react-hooks above
      "@eslint-react/rules-of-hooks": "off",
      "@eslint-react/exhaustive-deps": "off",
      // their prior Biome offs, replicated
      "@eslint-react/no-array-index-key": "off", // noArrayIndexKey (off)
      "@eslint-react/dom-no-dangerously-set-innerhtml": "off", // noDangerouslySetInnerHtml (off)
      // intentional patterns in this codebase
      "@eslint-react/set-state-in-effect": "off",
      "@eslint-react/naming-convention-ref-name": "off",
    },
  },

  // ---- jsx-a11y (.jsx / .tsx) ----
  {
    files: ["**/*.{jsx,tsx}"],
    ...jsxA11y.flatConfigs.recommended,
    rules: {
      // Their a11y offs, replicated
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/no-static-element-interactions": "off",
      "jsx-a11y/media-has-caption": "off",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/anchor-is-valid": "off",
      "jsx-a11y/label-has-associated-control": "off",
      "jsx-a11y/anchor-has-content": "off",
    },
  },

  // ---- Astro templates ----
  ...astro.configs.recommended,
  {
    files: ["**/*.astro"],
    languageOptions: {
      parserOptions: {
        // eslint-plugin-astro auto-detects @typescript-eslint/parser via require.resolve
        // to parse the TS frontmatter. Under pnpm's strict node_modules that parser is
        // NOT resolvable from the project root (it's only a transitive dep), so the
        // editor's lintText path silently falls back to espree → "interface is reserved".
        // Wire it explicitly via the resolvable `typescript-eslint` meta package.
        parser: tseslint.parser,
      },
    },
    rules: {
      // Biome's astro preset sets correctness.noUnusedImports "off": frontmatter
      // imports are consumed by the template, which the parser scopes separately.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",

      // Bans class={`${dynamic} static`} classes.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'JSXAttribute:matches([name.name=/^(class|className)$/], [name.namespace.name="class"]) TemplateLiteral[expressions.length>0]:has(TemplateElement[value.raw=/\\s/])',
          message:
            "No template-literal class list. Use class:list={[...]} instead — a single class NAME with no whitespace (e.g. `eyebrow-${brand}`) is fine as-is.",
        },
      ],
    },
  },

  // ---- Disable everything stylistic that Prettier owns (must be last) ----
  prettier
);
