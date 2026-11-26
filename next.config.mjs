import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// force new build

const withNextIntl = createNextIntlPlugin('./i18n.ts');
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_API_URL = 'http://localhost:8080';

function getHttpUrl(value, fallback) {
    try {
        const url = new URL(value || fallback);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url : new URL(fallback);
    } catch {
        return new URL(fallback);
    }
}

function getConfiguredOrigins(value) {
    if (!value) return [];

    return [
        ...new Set(
            value
                .split(',')
                .map((candidate) => candidate.trim())
                .filter(Boolean)
                .map((candidate) => getHttpUrl(candidate, LOCAL_API_URL))
                .filter((url) => url.href !== `${LOCAL_API_URL}/`)
                .map((url) => url.origin),
        ),
    ];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        // Enable image optimization for better performance
        unoptimized: false,
        // Supported image formats (WebP and AVIF for modern browsers)
        formats: ['image/webp', 'image/avif'],
        // Image sizes for responsive images
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [32, 48, 64, 96, 128, 256, 384],
        // Minimize layout shift with proper sizing
        minimumCacheTTL: 14400,
        // Allow external image domains if needed
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
    output: 'standalone',
    outputFileTracingRoot: projectRoot,
    turbopack: {
        root: projectRoot,
    },
    // Performance optimizations
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production',
    },
    // Reduce bundle size
    cacheComponents: false,
    experimental: {
        optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    },
    // Production optimizations
    productionBrowserSourceMaps: false,
    // Security headers
    async headers() {
        return [
            {
                // Apply headers to all routes
                source: '/:path*',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: getContentSecurityPolicy(),
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin-allow-popups',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()',
                    },
                ],
            },
        ];
    },
};

/**
 * Generate Content Security Policy
 * Allows analytics scripts and API calls while maintaining security
 */
function getContentSecurityPolicy() {
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Get API base URL from environment variable
    const apiUrl = getHttpUrl(process.env.NEXT_PUBLIC_API_BASE_URL, LOCAL_API_URL);
    const isSecure = apiUrl.protocol === 'https:';
    const wsUrl = `${isSecure ? 'wss' : 'ws'}://${apiUrl.host}`;
    const articleMediaFrameOrigins = getConfiguredOrigins(
        process.env.NEXT_PUBLIC_ARTICLE_MEDIA_FRAME_ORIGINS,
    );

    const storageUrl = getHttpUrl(process.env.UPLOAD_STORAGE_ORIGIN, LOCAL_API_URL);
    const storageOrigin =
        storageUrl.protocol === 'https:' && !storageUrl.hostname.includes('*')
            ? storageUrl.origin
            : '';

    const cspDirectives = [
        // Default source
        "default-src 'self'",

        // Script sources - allow analytics and inline scripts
        isDevelopment
            ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://www.googletagmanager.com https://www.google-analytics.com"
            : "script-src 'self' 'unsafe-inline' https://accounts.google.com https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com https://tagmanager.google.com",

        // Style sources
        "style-src 'self' 'unsafe-inline' https://accounts.google.com",

        // Image sources - allow analytics tracking pixels
        "img-src 'self' data: blob: https: https://www.google-analytics.com https://www.googletagmanager.com https://ssl.gstatic.com https://www.gstatic.com",

        // Font sources
        "font-src 'self' data:",

        // Connect sources - allow API calls and analytics
        // Companion app communication now goes through backend WebSocket (no localhost needed)
        `connect-src 'self' ${apiUrl.origin} ${wsUrl} https://accounts.google.com https://www.googleapis.com https://raw.githubusercontent.com https://www.google-analytics.com https://analytics.google.com https://*.google-analytics.com https://stats.g.doubleclick.net https://www.googletagmanager.com ${storageOrigin}`.trim(),

        // Frame sources - allow Google Tag Manager and explicitly configured media origins.
        `frame-src 'self' https://accounts.google.com https://www.googletagmanager.com ${articleMediaFrameOrigins.join(' ')}`.trim(),

        // Object sources
        "object-src 'none'",

        // Base URI
        "base-uri 'self'",

        // Form action
        "form-action 'self'",

        // Frame ancestors
        "frame-ancestors 'none'",

        // Upgrade insecure requests in production
        ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
    ];

    return cspDirectives.join('; ');
}

export default withSentryConfig(withNextIntl(nextConfig), {
    // For all available options, see:
    // https://www.npmjs.com/package/@sentry/webpack-plugin#options

    org: process.env.SENTRY_ORG,

    project: process.env.SENTRY_PROJECT,

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: '/monitoring',

    webpack: {
        // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
        // See the following for more information:
        // https://docs.sentry.io/product/crons/
        // https://vercel.com/docs/cron-jobs
        automaticVercelMonitors: false,

        // Tree-shaking options for reducing bundle size
        treeshake: {
            // Automatically tree-shake Sentry logger statements to reduce bundle size
            removeDebugLogging: true,
        },
    },
});
