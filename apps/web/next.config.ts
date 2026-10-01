import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ots/core ships TypeScript source, so Next compiles it.
  transpilePackages: ["@ots/core"],
};

export default nextConfig;
