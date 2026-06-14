/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiUrl = process.env.API_URL ?? "http://localhost:8080";

    return [
      {
        source: "/api/v1/auth/:path*",
        destination: `${apiUrl}/api/v1/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
