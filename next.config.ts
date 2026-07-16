import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@sparticuz/chromium-min",
    "playwright-core",
    "playwright",
  ],
  webpack: (config, { dev, isServer }) => {
    if (isServer) {
      const externals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
          ? [config.externals]
          : [];
      config.externals = [
        ...externals,
        "@sparticuz/chromium-min",
        "playwright-core",
        "playwright",
      ];
    }

    if (dev) {
      // Avoid Watchpack scanning Windows system folders (e.g. D:\System Volume Information)
      // which causes EINVAL and can trigger "Array buffer allocation failed"
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/System Volume Information/**",
          "**/system volume information/**",
          "/**/System Volume Information",
          "/**/system volume information",
        ],
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.startupschool.org",
      },
      {
        protocol: "https",
        hostname: "bookface-images.s3.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
