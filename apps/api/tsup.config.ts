import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  sourcemap: true,
  clean: true,
  // O pacote compartilhado é TypeScript puro: entra no bundle.
  noExternal: ["@webagent/shared"],
});
