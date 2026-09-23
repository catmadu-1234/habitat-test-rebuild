import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // 75 is the default; 90 is used for photos (see quality={90}).
    qualities: [75, 90],
  },
};

export default withNextIntl(nextConfig);
