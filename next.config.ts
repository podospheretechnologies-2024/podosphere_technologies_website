import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces `.next/standalone` so we can ship a prebuilt server without
  // running `next build` on production hosts that cannot build.
  output: "standalone",
  // Cap static-generation workers so 2GB prod hosts / laptops do not OOM (exit 137).
  experimental: {
    cpus: 1,
  },
};

export default nextConfig;
