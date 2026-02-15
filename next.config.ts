import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/shop", destination: "/" },
      { source: "/shop/:path*", destination: "/" },
      { source: "/cart", destination: "/" },
      { source: "/checkout", destination: "/" },
      { source: "/order", destination: "/" },
      { source: "/order/:path*", destination: "/" },
      { source: "/allorders", destination: "/" },
      { source: "/myorders", destination: "/" },
      { source: "/profile", destination: "/" },
      { source: "/allproducts", destination: "/" },
      { source: "/inventory", destination: "/" },
    ];
  },
};

export default nextConfig;
