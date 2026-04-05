import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
      },
    ],
  },
  async rewrites() {
    return [
      { source: "/shop", destination: "/" },
      { source: "/shop/:path*", destination: "/" },
      { source: "/cart", destination: "/" },
      { source: "/checkout", destination: "/" },
      { source: "/order", destination: "/" },
      { source: "/order/:path*", destination: "/" },
      { source: "/purchase", destination: "/" },
      { source: "/purchase/:path*", destination: "/" },
      { source: "/allorders", destination: "/" },
      { source: "/allpurchases", destination: "/" },
      { source: "/myorders", destination: "/" },
      { source: "/profile", destination: "/" },
      { source: "/allproducts", destination: "/" },
      { source: "/inventory", destination: "/" },
    ];
  },
};

export default nextConfig;
