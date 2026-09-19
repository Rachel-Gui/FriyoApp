/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: 'localhost' },
    ],
  },
  // Transpile @uiw/react-md-editor for SSR compatibility
  transpilePackages: ['@uiw/react-md-editor', '@uiw/react-markdown-preview'],
};

module.exports = nextConfig;
