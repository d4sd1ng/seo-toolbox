import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "core",
    "db",
    "plugin-sdk",
    "module-onpage",
    "module-gsc",
    "module-crawler",
    "module-pagespeed",
    "module-intel",
    "queue",
  ],
};

export default nextConfig;
