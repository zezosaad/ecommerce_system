if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Refusing to build website: SUPABASE_SERVICE_ROLE_KEY must not be present in frontend build environment.',
  );
}

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

export default nextConfig;
