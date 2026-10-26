/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
  },
  {key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups"},
  {key: "Referrer-Policy", value: "strict-origin-when-cross-origin"},
  {key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains"},
  {key: "X-Content-Type-Options", value: "nosniff"},
  {key: "X-DNS-Prefetch-Control", value: "off"},
  {key: "X-Frame-Options", value: "DENY"},
];

const nextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  async headers() {
    return [
      {source: "/:path*", headers: securityHeaders},
      {
        source: "/internal/:path*",
        headers: [{key: "Cache-Control", value: "private, no-store, max-age=0"}],
      },
    ];
  },
};

module.exports = nextConfig;
