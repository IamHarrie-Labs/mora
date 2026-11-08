import type { NextConfig } from "next";

// Mora is a client-side wallet app, so the experimental caching flags from the template are off.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
