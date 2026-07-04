/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent webpack from bundling node-ical and its ESM dependencies
  // (rrule-temporal, temporal-polyfill). Webpack's CJS/ESM interop strips
  // the default export, turning require('node-ical') into a namespace object
  // where parseICS is undefined. Externalising keeps it as a native require().
  serverExternalPackages: ['node-ical'],
};

export default nextConfig;
