import type { NextConfig } from "next";
import path from "node:path";
import { createRequire } from "node:module";

/**
 * yjs must resolve to exactly one physical module. Duplicate copies break
 * `instanceof Y.Map` and throw "Unexpected content type" when nesting maps from
 * different constructors — which silently kills real-time collaboration.
 *
 * Turbopack on Windows rejects absolute `C:\...` aliases ("windows imports are
 * not implemented yet"), so the Turbopack entry is a repo-relative POSIX path.
 */
const require = createRequire(import.meta.url);
const monorepoRoot = path.join(__dirname, "../..");
const yjsRoot = path.dirname(require.resolve("yjs/package.json"));

const nextConfig: NextConfig = {
  transpilePackages: ["@infinite-canvas/shared"],
  turbopack: {
    root: monorepoRoot,
    resolveAlias: {
      // Prefer the hoisted package path — stable across pnpm layouts and valid
      // as a relative import on Windows Turbopack.
      yjs: "./node_modules/yjs",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      yjs: yjsRoot,
    };
    return config;
  },
};

export default nextConfig;
