import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 75 is the default; 90 is used for photos (see quality={90}).
    qualities: [75, 90],
    // Only this project's images, so the image optimizer can't be used as a proxy for others.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/images/uruh3czl/production/**",
      },
    ],
  },
};

export default nextConfig;
