/** @type {import('next').NextConfig} */
const nextConfig = {
  // Repo-committed schedule snapshots (data/schedule-snapshots/*.json) are
  // read dynamically at runtime as a last-resort fallback (see
  // src/lib/krl/snapshotStore.ts's getRepoScheduleSnapshot), so Next's
  // automatic import tracing won't pick them up on its own — they need to
  // be listed explicitly to end up in the deployed function bundle.
  experimental: {
    outputFileTracingIncludes: {
      '/api/v1/krl/**': ['./data/schedule-snapshots/**'],
    },
  },
}

module.exports = nextConfig
