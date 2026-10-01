import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  target: "node22",
  clean: true,
  // @ots/core ships TypeScript source, so bundle it into the output.
  noExternal: ["@ots/core"],
});
