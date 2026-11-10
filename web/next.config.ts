import type { NextConfig } from "next";

// Mora is a client-side wallet app, so the experimental caching flags from the template are off.
const nextConfig: NextConfig = {
  // trymora.xyz is the main address. www and the earlier vercel.app addresses send people there.
  async redirects() {
    return ["www.trymora.xyz", "moravault.vercel.app", "mora-two-iota.vercel.app"].map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: "https://trymora.xyz/:path*",
      permanent: false,
    }));
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
