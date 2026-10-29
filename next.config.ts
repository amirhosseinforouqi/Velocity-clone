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
    ],
  }],
};

export default nextConfig;
