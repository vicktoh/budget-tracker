import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: import.meta.dirname,
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Service workers + HMR don't mix; keep dev free of stale caches.
  disable: process.env.NODE_ENV === "development",
  // Don't fall back unauthenticated app routes to a cached shell that could
  // leak another session's view; the document cache handles offline shell.
  reloadOnOnline: true,
});

export default withSerwist(nextConfig);
