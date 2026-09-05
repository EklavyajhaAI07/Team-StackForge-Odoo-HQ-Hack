import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This repo lives inside a larger folder tree; pin Turbopack's root so it never walks up.
  turbopack: { root: process.cwd() },
  // Prisma's query engine must stay a Node dependency, not be bundled.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
