import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // research/ holds the semantic-oracle experiments; they report known bugs
    // and run separately with `npm run research:oracles`.
    exclude: [...configDefaults.exclude, "research/**"],
  },
});
