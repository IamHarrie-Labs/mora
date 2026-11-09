import type { NextConfig } from "next";

// Mora is a client-side wallet app, so the experimental caching flags from the template are off.
const nextConfig: NextConfig = {
  // trymora.xyz is the main address. www sends people there.
  async redirects() {
    return [
      { source: "/:path*", has: [{ type: "host", value: "www.trymora.xyz" }], destination: "https://trymora.xyz/:path*", permanent: true },
    ];
  },
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
