import type { NextConfig } from "next";
import { ACTIVE_LEGACY_REDIRECTS } from "./src/config/routes";

const nextConfig: NextConfig = {
  async redirects() {
    return ACTIVE_LEGACY_REDIRECTS.map(({ source, destination }) => ({
      source,
      destination,
      permanent: false,
    }));
  },
};

export default nextConfig;
