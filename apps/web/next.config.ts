import type { NextConfig } from "next";
import path from "node:path";

const playwrightStub = path.join(__dirname, "lib/empty-module.js");

const nextConfig: NextConfig = {
  transpilePackages: [
    "core",
    "db",
    "plugin-sdk",
    "module-gsc",
    "module-pagespeed",
    "module-intel",
    "queue",
  ],
  serverExternalPackages: ["playwright", "playwright-core", "chromium-bidi"],
  webpack: (config, { webpack, dev }) => {
    if (dev) config.cache = false;
    config.plugins.push(
      new webpack.IgnorePlugin({
        checkResource(resource: string) {
          return /playwright|chromium-bidi/.test(resource);
        },
      }),
    );
    config.resolve.alias = {
      ...config.resolve.alias,
      playwright: playwrightStub,
      "playwright-core": playwrightStub,
      "chromium-bidi": playwrightStub,
      "chromium-bidi/lib/cjs/bidiMapper/BidiMapper": playwrightStub,
      "chromium-bidi/lib/cjs/cdp/CdpConnection": playwrightStub,
    };
    return config;
  },
};

export default nextConfig;
