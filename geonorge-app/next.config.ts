/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "example.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "another-example.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.geonorge.no",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "editor.geonorge.no",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "editor.geonorge.no",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "norgeskart.no",
        pathname: "/**",
      },
    ],
  },
};

module.exports = nextConfig;
