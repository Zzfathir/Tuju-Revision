import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  outputFileTracingIncludes: { "/": ["./data/routes/*/eta-grid.json"] },
  webpack(config) {
    config.module.rules.push({ test: /\.geojson$/, type: "json" });
    return config;
  },
};
