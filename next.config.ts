import type { NextConfig } from 'next';
import { mkdirSync } from 'fs';
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  compress: true,
  typescript: {
    // TypeScript errors are now checked during build
    // To skip type checking temporarily, run: SKIP_TYPE_CHECK=1 npm run build
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === '1',
  },
  eslint: {
    // ESLint errors are now checked during build
    // To skip linting temporarily, run: SKIP_LINT=1 npm run build
    ignoreDuringBuilds: process.env.SKIP_LINT === '1',
  },
  // Desactivar todos los caches en desarrollo
  ...(process.env.NODE_ENV === 'development' && {
    // Desactivar cache de páginas en desarrollo
    onDemandEntries: {
      maxInactiveAge: 0,
      pagesBufferLength: 0,
    },
  }),
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 año para imágenes optimizadas
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    unoptimized: false, // Asegurar que las imágenes se optimicen
    loader: 'default', // Usar el loader por defecto de Next.js
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Security and Cache headers configuration
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';

    // ✅ SECURITY: Common security headers for all zones
    const commonSecurityHeaders = [
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on',
      },
      {
        key: 'Permissions-Policy',
        value: 'geolocation=(), microphone=(), camera=()',
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block',
      },
      {
        key: 'X-Permitted-Cross-Domain-Policies',
        value: 'none',
      },
      {
        key: 'Cross-Origin-Opener-Policy',
        value: 'same-origin',
      },
    ];

    // ✅ SECURITY: HSTS header (production only)
    const hstsHeader = !isDev ? [
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload'
      }
    ] : [];

    // Cache headers
    const cacheHeaders = [
      {
        key: 'Cache-Control',
        value: isDev
          ? 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
          : 'private, no-cache, no-store, must-revalidate',
      },
      ...(isDev ? [
        {
          key: 'Pragma',
          value: 'no-cache',
        },
        {
          key: 'Expires',
          value: '0',
        },
      ] : []),
    ];

    return [
      // ✅ SECURITY: Admin zone - Strictest security headers
      {
        source: '/admin/:path*',
        headers: [
          ...commonSecurityHeaders,
          ...hstsHeader,
          ...cacheHeaders,
        ],
      },
      // ✅ SECURITY: Affiliate zone - Strict security headers
      {
        source: '/:lang/affiliate/:path*',
        headers: [
          ...commonSecurityHeaders,
          ...hstsHeader,
          ...cacheHeaders,
        ],
      },
      // ✅ SECURITY: Main web zone - Standard security headers
      {
        source: '/:path*',
        headers: [
          ...commonSecurityHeaders,
          ...hstsHeader,
          ...cacheHeaders,
        ],
      },
      // Cache static assets from Next.js (JS, CSS, fonts, images)
      // En desarrollo: sin cache. En producción: cache largo
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: isDev
              ? 'no-store, no-cache, must-revalidate'
              : 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Cache public static files (favicon, images, etc.)
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: isDev
              ? 'no-store, no-cache, must-revalidate'
              : 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Cache images and fonts
      {
        source: '/:path*\\.(jpg|jpeg|png|gif|webp|svg|ico|woff|woff2|ttf|eot)',
        headers: [
          {
            key: 'Cache-Control',
            value: isDev
              ? 'no-store, no-cache, must-revalidate'
              : 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  webpack: (config, { dev, dir, isServer }) => {
    // Desactivar cache completamente para evitar conflictos con mini-css-extract-plugin
    config.cache = false;

    if (dev) {
      try {
        const manifestDir = path.join(dir, '.next', 'static', 'development');
        mkdirSync(manifestDir, { recursive: true });
      } catch (error) {
        if (dev) {
          console.warn('Failed to ensure Next.js dev manifest directory exists:', error);
        }
      }
    }

    // Suprimir advertencias de dependencias críticas conocidas
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /@opentelemetry\/instrumentation/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
      {
        module: /@prisma\/instrumentation/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    // Optimizar para Edge Runtime
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    return config;
  },
  // Configurar output file tracing root para eliminar advertencia de múltiples lockfiles
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    disableOptimizedLoading: false,
    serverActions: {
      bodySizeLimit: '2mb', // Limit request body size to prevent payload attacks
    },
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    optimizeCss: true, // Optimizar CSS en producción
  },
  // Optimizaciones de compilado (SWC minify es default en Next.js 15+)
  reactStrictMode: true, // Modo estricto de React
  poweredByHeader: false, // Remover header X-Powered-By por seguridad
  // Configuración para excluir paquetes de Supabase del análisis de Edge Runtime
  // Esto evita advertencias de compatibilidad con Edge Runtime
  transpilePackages: [
    '@supabase/supabase-js',
    '@supabase/realtime-js',
    '@supabase/ssr'
  ],
};

// Conditionally wrap with Sentry only if DSN is available
let config: NextConfig = nextConfig;

if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    // Dynamic import to avoid build dependency
    const { withSentryConfig } = require('@sentry/nextjs');
    const { sentryBuildOptions } = require('./sentry.config');

    config = withSentryConfig(nextConfig, sentryBuildOptions);
  } catch (error) {
    console.warn('Sentry not available, building without Sentry integration');
  }
}

module.exports = config;
