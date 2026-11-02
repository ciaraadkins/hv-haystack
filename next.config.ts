import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  // Haystack lives at /haystack; humanversus.tech itself has nothing else yet.
  // Temporary (307) so "/" can become a page for all the games later.
  async redirects() {
    return [{ source: "/", destination: "/haystack", permanent: false }];
  },
};

export default nextConfig;
