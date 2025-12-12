export const sentryBuildOptions: Parameters<typeof import('@sentry/nextjs').withSentryConfig>[1] = {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  telemetry: false,
  sourcemaps: {
    deleteSourcemapsAfterUpload: false,
  },
  // Suprimir advertencias de webpack
  widenClientFileUpload: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
};
