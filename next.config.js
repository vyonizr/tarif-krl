/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Cross Origin
  // allowedDevOrigins: ['192.168.0.112'],
  // Repo-committed schedule snapshots (data/schedule-snapshots/*.json,
  // data/lrt-schedule-snapshots/*.json) are read dynamically at runtime, so
  // Next's automatic import tracing won't pick them up on its own - they
  // need to be listed explicitly to end up in the deployed function bundle.
  experimental: {
    outputFileTracingIncludes: {
      '/api/v1/krl/**': ['./data/schedule-snapshots/**', './data/train-snapshots/**'],
      '/api/lrt/**': ['./data/lrt-schedule-snapshots/**'],
    },
  },
}

module.exports = nextConfig
