/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@vendorhub/types',
    '@vendorhub/shared',
    '@vendorhub/api-client',
    '@vendorhub/i18n',
  ],
};

module.exports = nextConfig;
