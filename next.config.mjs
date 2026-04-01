/** @type {import('next').NextConfig} */
const nextConfig = {
    basePath: '/data',
    output: 'standalone',
    async rewrites() {
        return [
            {
                source: '/api/apl/:path*',
                destination: 'http://127.0.0.1:8765/api/:path*',
            },
        ];
    },
};

export default nextConfig;
