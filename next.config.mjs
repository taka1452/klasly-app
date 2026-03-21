import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: false,
  cacheOnNavigation: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Widget ページを iframe で埋め込み可能にする
        source: "/widget/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
          {
            key: "X-Frame-Options",
            value: "ALLOWALL",
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
