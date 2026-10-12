import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Spotify box is bottom-left.
  devIndicators: { position: "bottom-right" },
  // exifr loads fs and zlib with a plain require(), which fails once bundled.
  // heic-decode carries a large WebAssembly build that doesn't need bundling.
  serverExternalPackages: ["exifr", "heic-decode"],
  // sharp's native library isn't always picked up when bundling for Vercel.
  outputFileTracingIncludes: {
    "/api/gallery": ["./node_modules/@img/sharp-*linux*/**/*"],
  },
};

export default nextConfig;
