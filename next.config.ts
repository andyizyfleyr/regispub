import type { NextConfig } from "next";

const allowEmbedding = process.env.ALLOW_EMBEDDING === "true";
const extraOrigins = (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // L'intégration en iframe n'est autorisée que si ALLOW_EMBEDDING=true (prévisualisation).
  ...(allowEmbedding ? [] : [{ key: "X-Frame-Options", value: "SAMEORIGIN" }]),
];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  serverExternalPackages: ["pg", "pdf-lib"],
  allowedDevOrigins: process.env.DEV_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean),
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
      ...(extraOrigins.length ? { allowedOrigins: extraOrigins } : {}),
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
