import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // PGlite loads its WASM and data files from disk, so it must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Document uploads go through a server action; the file limit is 10 MB (MAX_UPLOAD), plus room for the form fields.
  // The local database and uploaded documents are data, never part of the deployed build.
  outputFileTracingExcludes: { "/*": ["./.data/**/*"] },
  experimental: { serverActions: { bodySizeLimit: "11mb" }, proxyClientMaxBodySize: "11mb" },
  // same-origin: invitation links carry a one-time token, so the full URL never goes to another site.
  headers: async () => [{
    source: "/:path*",
    headers: [
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      // ponytail: report-only, so nothing is blocked yet. Watch the browser console on staging (uploads to hosted
      // storage need its host in connect-src), then rename the key to Content-Security-Policy to enforce.
      { key: "Content-Security-Policy-Report-Only", value: `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` },
    ],
  }],
};

export default nextConfig;
