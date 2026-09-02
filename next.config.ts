import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

/** Nest origin without /api/v1 — used to proxy Socket.IO from HTTPS pages. */
function nestSocketOrigin(): string {
  const raw = (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    ""
  ).trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

const nestOrigin = nestSocketOrigin();

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  /**
   * Temporary: browser stays on HTTPS (Vercel); Next proxies /socket.io to HTTP Nest.
   * Avoids mixed-content blocks until the backend has a real HTTPS domain.
   */
  async rewrites() {
    if (!nestOrigin) return [];
    return [
      {
        source: "/socket.io",
        destination: `${nestOrigin}/socket.io`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${nestOrigin}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
