import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces `.next/standalone` so we can ship a prebuilt server without
  // running `next build` on production hosts that cannot build.
  output: "standalone",
  // Cap static-generation workers so Windows/laptop builds do not OOM with 19 workers.
  experimental: {
    cpus: 4,
  },
};

export default nextConfig;
