import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output so the Docker runner image only needs the traced
  // node_modules (see Dockerfile). mysql2 stays external: it is a CJS driver
  // that Next should require from node_modules at runtime, not bundle.
  output: "standalone",
  serverExternalPackages: ["mysql2"],
};

export default nextConfig;
