import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  plugins: [{ name: "geojson", transform: (code, id) => (id.endsWith(".geojson") ? { code: `export default ${code};`, map: null } : null) }],
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: { include: ["tests/**/*.test.ts"] },
});
