/**
 * SEO Configuration
 *
 * Site configuration with base URLs, supported locales, and default metadata
 */

import { SiteConfig } from './types';
import {
    SUPPORTED_LOCALES as I18N_SUPPORTED_LOCALES,
    DEFAULT_LOCALE as I18N_DEFAULT_LOCALE,
    Locale,
} from '@/lib/types';

const PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const PUBLIC_SITE_HOSTNAME = new URL(PUBLIC_SITE_URL).hostname;
const PUBLIC_CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@example.invalid';

// ============================================================================
// Organization Configuration
// ============================================================================

/**
 * Organization configuration for Schema.org structured data
 * Contains all organization-related constants used across the site
 */
export const ORGANIZATION_CONFIG = {
    name: 'Olimpiada de Inteligență Artificială',
    alternateName: 'ONIA',
    url: PUBLIC_SITE_URL,
    logo: `${PUBLIC_SITE_URL}/logo.png`,
    logoWidth: 512,
    logoHeight: 512,
    email: PUBLIC_CONTACT_EMAIL,
    foundingDate: '2023',
    sameAs: [
        'https://www.instagram.com/olimpiada_ai/',
        'https://www.linkedin.com/company/romanian-national-artificial-intelligence-olympiad',
    ],
    availableLanguages: ['Romanian', 'English'],
} as const;

// ============================================================================
// Environment Detection
// ============================================================================

const getEnvironment = (): 'production' | 'staging' | 'development' => {
    if (typeof window !== 'undefined') {
        // Client-side detection
        const hostname = window.location.hostname;
        if (hostname === PUBLIC_SITE_HOSTNAME) {
            return 'production';
        }
        if (hostname.includes('staging') || hostname.includes('vercel.app')) {
            return 'staging';
        }
        return 'development';
    }

    // Server-side detection
    const nodeEnv = process.env.NODE_ENV;
    const vercelEnv = process.env.VERCEL_ENV;

    if (vercelEnv === 'production' || nodeEnv === 'production') {
        return 'production';
    }
    if (vercelEnv === 'preview') {
        return 'staging';
    }
    return 'development';
};

// ============================================================================
// Base URLs by Environment
// ============================================================================

const BASE_URLS = {
    production: PUBLIC_SITE_URL,
    staging: PUBLIC_SITE_URL,
    development: 'http://localhost:3000',
} as const;

export const ENVIRONMENT = getEnvironment();
export const BASE_URL = BASE_URLS[ENVIRONMENT];

// ============================================================================
// Supported Locales (imported from i18n types for synchronization)
// ============================================================================

// Re-export from i18n types to ensure SEO and i18n stay in sync
export const SUPPORTED_LOCALES: readonly Locale[] = I18N_SUPPORTED_LOCALES;
export const DEFAULT_LOCALE: Locale = I18N_DEFAULT_LOCALE;

export type SupportedLocale = Locale;

export const PLATFORM_OG_VERSION = 'onia-og-2';

export type PlatformOgKind =
    | 'generic'
    | 'problems'
    | 'competitions'
    | 'articles'
    | 'leaderboard'
    | 'institutions'
    | 'countries'
    | 'roadmap'
    | 'achievements'
    | 'legal';

// ============================================================================
// Locale to Region Mapping for og:locale format
// ============================================================================

/**
 * Maps locale codes to og:locale format (language_REGION)
 * Used for Open Graph metadata to specify the locale of the content
 */
export const LOCALE_REGION_MAP: Record<Locale, string> = {
    en: 'en_US',
    ro: 'ro_RO',
    de: 'de_DE',
    bg: 'bg_BG',
    sr: 'sr_RS',
    uk: 'uk_UA',
    hu: 'hu_HU',
    ru: 'ru_RU',
    kk: 'kk_KZ',
    ka: 'ka_GE',
    fr: 'fr_FR',
    nl: 'nl_NL',
    et: 'et_EE',
    fi: 'fi_FI',
    sv: 'sv_SE',
    lv: 'lv_LV',
    lt: 'lt_LT',
    hr: 'hr_HR',
    sk: 'sk_SK',
    sl: 'sl_SI',
    cs: 'cs_CZ',
    da: 'da_DK',
    it: 'it_IT',
    es: 'es_ES',
    pt: 'pt_PT',
    pl: 'pl_PL',
    no: 'no_NO',
    'zh-CN': 'zh_CN',
    ar: 'ar_SA',
    he: 'he_IL',
};

/**
 * Get og:locale format from locale code
 * Returns the locale in {language}_{REGION} format for Open Graph metadata
 *
 * @param locale - The locale code (e.g., 'es', 'fr', 'zh-CN')
 * @returns The og:locale format (e.g., 'es_ES', 'fr_FR', 'zh_CN')
 */
export function getOgLocale(locale: Locale): string {
    return LOCALE_REGION_MAP[locale] || `${locale}_${locale.toUpperCase()}`;
}

// ============================================================================
// Site Configuration
// ============================================================================

export const SITE_CONFIG: SiteConfig = {
    name: 'MLCompete',
    description:
        'Machine Learning Competition Platform - Evaluate your ML models and compete with others',
    url: BASE_URL,
    ogImage: `${BASE_URL}/og-image-v2.png`,
    twitterHandle: '@mlcompete',
    locale: DEFAULT_LOCALE,
    supportedLocales: [...SUPPORTED_LOCALES],
};

// ============================================================================
// Default Metadata
// ============================================================================

export const DEFAULT_METADATA = {
    title: 'MLCompete - Machine Learning Competition Platform',
    description:
        'Evaluate your machine learning models and compete with others on challenging problems. Join competitions, track your progress, and climb the leaderboard.',
    keywords: [
        'machine learning',
        'ML competition',
        'data science',
        'AI challenges',
        'model evaluation',
        'leaderboard',
    ],
    image: SITE_CONFIG.ogImage,
    type: 'website' as const,
};

// ============================================================================
// Open Graph Defaults
// ============================================================================

export const OG_IMAGE_DIMENSIONS = {
    width: 1200,
    height: 630,
} as const;

export const OG_DEFAULTS = {
    siteName: SITE_CONFIG.name,
    type: 'website',
    locale: DEFAULT_LOCALE,
    images: [
        {
            url: SITE_CONFIG.ogImage,
            width: OG_IMAGE_DIMENSIONS.width,
            height: OG_IMAGE_DIMENSIONS.height,
            alt: `${SITE_CONFIG.name} - ${SITE_CONFIG.description}`,
        },
    ],
};

// ============================================================================
// Twitter Card Defaults
// ============================================================================

export const TWITTER_DEFAULTS = {
    card: 'summary_large_image' as const,
    site: SITE_CONFIG.twitterHandle,
    creator: SITE_CONFIG.twitterHandle,
};

// ============================================================================
// Robots Configuration
// ============================================================================

export const ROBOTS_CONFIG = {
    // Always allow indexing - environment-specific blocking should be done via robots.txt
    index: true,
    follow: true,
    googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
    },
};

// ============================================================================
// Sitemap Configuration
// ============================================================================

export const SITEMAP_CONFIG = {
    baseUrl: BASE_URL,
    supportedLocales: [...SUPPORTED_LOCALES],
    defaultLocale: DEFAULT_LOCALE,
    changeFrequency: {
        homepage: 'daily' as const,
        problems: 'weekly' as const,
        competitions: 'weekly' as const,
        articles: 'weekly' as const,
        profiles: 'weekly' as const,
        leaderboard: 'daily' as const,
        static: 'monthly' as const,
    },
    priority: {
        homepage: 1.0,
        problems: 0.8,
        competitions: 0.8,
        articles: 0.75,
        profiles: 0.7, // Increased priority for better indexing
        leaderboard: 0.7,
        static: 0.5,
    },
};

// ============================================================================
// SEO Limits
// ============================================================================

export const SEO_LIMITS = {
    title: {
        min: 30,
        max: 60,
        ideal: 55,
    },
    description: {
        min: 120,
        max: 160,
        ideal: 155,
    },
    keywords: {
        max: 10,
    },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the full URL for a given path
 * All locales get explicit prefixes
 */
export function getFullUrl(path: string, locale?: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const localizedPath = cleanPath === '/' ? '' : cleanPath;

    if (locale) {
        return `${BASE_URL}/${locale}${localizedPath}`;
    }

    // If no locale specified, use default locale with prefix
    return `${BASE_URL}/${DEFAULT_LOCALE}${localizedPath}`;
}

/**
 * Check if a title is within SEO limits
 */
export function isTitleValid(title: string): boolean {
    const length = title.length;
    return length >= SEO_LIMITS.title.min && length <= SEO_LIMITS.title.max;
}

/**
 * Check if a description is within SEO limits
 */
export function isDescriptionValid(description: string): boolean {
    const length = description.length;
    return length >= SEO_LIMITS.description.min && length <= SEO_LIMITS.description.max;
}

/**
 * Truncate text to fit within SEO limits
 */
export function truncateText(text: string, maxLength: number, suffix = '...'): string {
    if (text.length <= maxLength) {
        return text;
    }

    const truncated = text.slice(0, maxLength - suffix.length).trim();
    return `${truncated}${suffix}`;
}

/**
 * Ensure title is within SEO limits
 */
export function ensureTitleLength(title: string): string {
    if (isTitleValid(title)) {
        return title;
    }

    if (title.length > SEO_LIMITS.title.max) {
        return truncateText(title, SEO_LIMITS.title.max);
    }

    // Keep already-branded titles concise. Repeating the site name to satisfy a
    // heuristic minimum creates awkward titles such as
    // "Problems - MLCompete | MLCompete" in browser tabs and search results.
    if (title.toLocaleLowerCase().includes(SITE_CONFIG.name.toLocaleLowerCase())) {
        return title;
    }

    return `${title} | ${SITE_CONFIG.name}`;
}

/**
 * Ensure description is within SEO limits
 */
export function ensureDescriptionLength(description: string): string {
    if (isDescriptionValid(description)) {
        return description;
    }

    if (description.length > SEO_LIMITS.description.max) {
        return truncateText(description, SEO_LIMITS.description.max);
    }

    // If too short, use default
    return DEFAULT_METADATA.description;
}

/**
 * Get locale-specific URL
 */
export function getLocalizedUrl(path: string, locale: string): string {
    return getFullUrl(path, locale);
}

/**
 * Check if we're in production environment
 */
export function isProduction(): boolean {
    return ENVIRONMENT === 'production';
}

/**
 * Check if we're in development environment
 */
export function isDevelopment(): boolean {
    return ENVIRONMENT === 'development';
}

// ============================================================================
// Dynamic OG Image Generation
// ============================================================================

function compactOgParameter(value: string, maxCodePoints: number): string {
    return Array.from(value.normalize('NFC').trim().replace(/\s+/g, ' '))
        .slice(0, maxCodePoints)
        .join('');
}

function normalizeOgCountryCode(countryCode: string | null | undefined): string | null {
    const normalizedCountryCode = countryCode?.trim().toUpperCase() ?? '';
    return /^[A-Z]{2}$/.test(normalizedCountryCode) ? normalizedCountryCode : null;
}

function createOgImageUrl(
    type: string,
    params: Record<string, string | number | null | undefined>,
    version = PLATFORM_OG_VERSION,
): string {
    const searchParams = new URLSearchParams({ type });

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') continue;
        searchParams.set(key, String(value));
    }

    searchParams.set('v', version);
    return `${BASE_URL}/api/og?${searchParams.toString()}`;
}

/**
 * Generate the homepage card used by localized homepage metadata.
 */
export function generateHomeOgImageUrl(
    title = 'MLCompete',
    subtitle = 'Machine learning competitions, built for learning',
): string {
    return createOgImageUrl('home', {
        title: compactOgParameter(title, 96),
        subtitle: compactOgParameter(subtitle, 160),
    });
}

/**
 * Generate dynamic OG image URL for problems
 */
export function generateProblemOgImageUrl(
    title: string,
    difficulty: string,
    options?: {
        problemId?: number;
        authorLine?: string;
    },
): string {
    return createOgImageUrl('problem', {
        title: compactOgParameter(title, 96),
        difficulty: compactOgParameter(difficulty, 16),
        problemId:
            options?.problemId && Number.isSafeInteger(options.problemId) && options.problemId > 0
                ? options.problemId
                : undefined,
        authorLine: options?.authorLine ? compactOgParameter(options.authorLine, 72) : undefined,
    });
}

/**
 * Generate dynamic OG image URL for profiles
 */
export function generateProfileOgImageUrl(
    username: string,
    stats: {
        rank?: number;
        totalScore?: number;
        problemsSolved?: number;
    },
    options?: {
        countryCode?: string | null;
        hasAvatar?: boolean;
    },
): string {
    const maximumPublicMetric = 1_000_000_000;
    const params = new URLSearchParams({
        type: 'profile',
        username: compactOgParameter(username, 64),
        v: 'profile-3',
    });

    if (
        stats.rank !== undefined &&
        Number.isInteger(stats.rank) &&
        stats.rank > 0 &&
        stats.rank <= maximumPublicMetric
    ) {
        params.set('rank', stats.rank.toString());
    }
    if (
        stats.totalScore !== undefined &&
        Number.isFinite(stats.totalScore) &&
        stats.totalScore >= 0 &&
        stats.totalScore <= maximumPublicMetric
    ) {
        params.set('totalScore', stats.totalScore.toString());
    }
    if (
        stats.problemsSolved !== undefined &&
        Number.isInteger(stats.problemsSolved) &&
        stats.problemsSolved >= 0 &&
        stats.problemsSolved <= maximumPublicMetric
    ) {
        params.set('problemsSolved', stats.problemsSolved.toString());
    }

    const countryCode = options?.countryCode?.trim().toUpperCase();
    if (countryCode && /^[A-Z]{2}$/.test(countryCode)) {
        params.set('countryCode', countryCode);
    }
    if (options?.hasAvatar === true) {
        params.set('avatar', '1');
    }

    return `${BASE_URL}/api/og?${params.toString()}`;
}

/**
 * Generate dynamic OG image URL for generic pages
 */
export function generateGenericOgImageUrl(
    title: string,
    subtitle?: string,
    options?: {
        kind?: PlatformOgKind;
        countryCode?: string | null;
    },
): string {
    return generatePlatformOgImageUrl(title, subtitle, options);
}

/**
 * Generate a collection/static page image within the shared ONIA-v2 family.
 */
export function generatePlatformOgImageUrl(
    title: string,
    subtitle?: string,
    options?: {
        kind?: PlatformOgKind;
        countryCode?: string | null;
    },
): string {
    return createOgImageUrl('generic', {
        title: compactOgParameter(title, 96),
        subtitle: subtitle ? compactOgParameter(subtitle, 160) : undefined,
        kind: options?.kind && options.kind !== 'generic' ? options.kind : undefined,
        countryCode: normalizeOgCountryCode(options?.countryCode),
    });
}

/**
 * Generate a dynamic OG image URL for a country page.
 *
 * The version parameter provides an explicit cache-busting seam for future
 * visual revisions without changing the canonical country URL.
 */
export function generateCountryOgImageUrl(countryName: string, countryCode: string): string {
    const params = new URLSearchParams({
        type: 'country',
        title: countryName,
        countryCode: countryCode.trim().toUpperCase(),
        v: 'country-2',
    });

    return `${BASE_URL}/api/og?${params.toString()}`;
}

/**
 * Generate a published article/editorial card.
 */
export function generateArticleOgImageUrl(
    title: string,
    options?: {
        excerpt?: string;
        kind?: 'ARTICLE' | 'PROBLEM_EDITORIAL';
        problemTitle?: string;
        authorLine?: string;
        revision?: string;
    },
): string {
    return createOgImageUrl('article', {
        title: compactOgParameter(title, 96),
        subtitle: options?.excerpt ? compactOgParameter(options.excerpt, 160) : undefined,
        articleKind: options?.kind,
        problemTitle: options?.problemTitle
            ? compactOgParameter(options.problemTitle, 72)
            : undefined,
        authorLine: options?.authorLine ? compactOgParameter(options.authorLine, 72) : undefined,
        revision: options?.revision ? compactOgParameter(options.revision, 40) : undefined,
    });
}

/**
 * Generate an educational institution card.
 */
export function generateInstitutionOgImageUrl(
    name: string,
    options?: {
        countryCode?: string | null;
        location?: string;
    },
): string {
    return createOgImageUrl('institution', {
        title: compactOgParameter(name, 96),
        countryCode: normalizeOgCountryCode(options?.countryCode),
        location: options?.location ? compactOgParameter(options.location, 72) : undefined,
    });
}

/**
 * Generate a Romanian county card.
 */
export function generateCountyOgImageUrl(name: string, countyCode?: string): string {
    return createOgImageUrl('county', {
        title: compactOgParameter(name, 96),
        countyCode: countyCode ? compactOgParameter(countyCode, 12) : undefined,
    });
}

/**
 * Get fallback OG image URL
 */
export function getFallbackOgImageUrl(): string {
    return SITE_CONFIG.ogImage;
}

/**
 * Generate dynamic OG image URL for competitions
 */
export function generateCompetitionOgImageUrl(
    name: string,
    status: string,
    dates: { start: string; end: string },
    options?: {
        detailsLine?: string;
    },
): string {
    return createOgImageUrl('competition', {
        title: compactOgParameter(name, 96),
        status: compactOgParameter(status, 16),
        startDate: dates.start,
        endDate: dates.end,
        detailsLine: options?.detailsLine ? compactOgParameter(options.detailsLine, 72) : undefined,
    });
}
