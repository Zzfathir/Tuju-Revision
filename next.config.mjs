/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  webpack(config) {
    config.module.rules.push({ test: /\.geojson$/, type: "json" });
    return config;
  },
};
