import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cpus: 1,
    workerThreads: true,
  },
  // `npm run build` runs `tsc --noEmit` first. Next's internal typecheck worker
  // can fail with spawn EPERM in Windows/sandboxed shells, so keep validation in
  // the explicit script and skip the duplicate worker-based pass here.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
