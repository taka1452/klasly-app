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

export default nextConfig;
