import type { NextConfig } from "next";
import path from "path";

const sharedDir = path.join(__dirname, "../../shared");

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: path.join(__dirname, "../.."),
    resolveAlias: {
      "@tostal/shared": sharedDir,
    },
  },
};

export default nextConfig;
