import type { NextConfig } from "next";
import { ACTIVE_LEGACY_REDIRECTS } from "./src/config/routes";

const nextConfig: NextConfig = {
  // Docker builds set NEXT_OUTPUT=standalone for a minimal runtime image;
  // `next start` workflows (CI smoke, e2e, local) keep the default output.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  async redirects() {
    return ACTIVE_LEGACY_REDIRECTS.map(({ source, destination }) => ({
      source,
      destination,
      permanent: false,
    }));
  },
};

export default nextConfig;
