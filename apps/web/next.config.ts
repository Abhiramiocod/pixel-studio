import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared types package is consumed as TypeScript source rather than a
  // built bundle, so Next has to compile it alongside the app.
  transpilePackages: ["@pixel-studio/types"],
};

export default nextConfig;
