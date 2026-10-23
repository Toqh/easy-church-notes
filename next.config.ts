import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(process.cwd()) },
  async headers(){return [{source:"/sw.js",headers:[{key:"Cache-Control",value:"no-cache, no-store, must-revalidate"},{key:"Service-Worker-Allowed",value:"/"},{key:"X-Content-Type-Options",value:"nosniff"}]},{source:"/manifest.webmanifest",headers:[{key:"Content-Type",value:"application/manifest+json"}]}];},
};

export default nextConfig;
