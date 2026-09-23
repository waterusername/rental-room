import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "bcryptjs", "stripe"],
};

export default nextConfig;
