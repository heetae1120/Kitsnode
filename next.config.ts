import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "export",
  env: { NEXT_PUBLIC_BASE_PATH: process.env.PAGES_BASE_PATH || "" },
  basePath: process.env.PAGES_BASE_PATH || "",
  trailingSlash: true,
  images: { unoptimized: true },
  allowedDevOrigins: ["127.0.0.1"],
};
export default nextConfig;
