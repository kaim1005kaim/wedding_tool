import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@wedding_tool/rt-adapter', '@wedding_tool/schema', '@wedding_tool/ui']
};

const sentryWebpackPluginOptions = {
  silent: true
};

const config = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions, {
      hideSourceMaps: true
    })
  : nextConfig;

export default config;
