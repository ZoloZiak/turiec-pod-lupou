import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Jednorazové Node CLI nástroje (CommonJS) — nie súčasť Next app buildu.
  // require() je tu korektné (projekt nie je ESM), a lint pravidlá pre app kód
  // sa na tieto skripty nevzťahujú.
  {
    files: ["scripts/**/*.js", "*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Interný admin panel (za heslom, nie verejný transparentnostný obsah) —
  // uvoľnené typové pravidlá; reálne bugy (hooks, Link) sú aj tu opravené.
  {
    files: ["src/app/admin/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
