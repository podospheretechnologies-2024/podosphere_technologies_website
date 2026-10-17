import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces `.next/standalone` so we can ship a prebuilt server without
  // running `next build` on production hosts that cannot build.
  output: "standalone",
};

export default nextConfig;
