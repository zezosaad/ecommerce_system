import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n.ts');

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

export default withNextIntl(nextConfig);
