import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Spotify box is bottom-left.
  devIndicators: { position: "bottom-right" },
  // sharp's native library isn't always picked up when bundling for Vercel.
  outputFileTracingIncludes: {
    "/api/gallery": ["./node_modules/@img/sharp-*linux*/**/*"],
  },
};

export default nextConfig;
