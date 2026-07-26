/**
 * Sitemap Generation Utilities
 *
 * Functions for generating XML sitemaps with multi-language support
 *
 * Features:
 * - Static pages sitemap (homepage, problems list, leaderboard, etc.)
 * - Dynamic problems sitemap (fetches from API)
 * - Dynamic profiles sitemap (public profiles only)
 * - Multi-language support with hreflang tags
 * - Error handling with fallback to static pages
 * - Configurable change frequency and priority
 *
 * Usage:
 * ```typescript
 * import { generateSitemap } from '@/lib/seo/sitemap';
 *
 * const entries = await generateSitemap();
 * ```
 */

import { SitemapEntry } from './types';
import { SITEMAP_CONFIG, SUPPORTED_LOCALES, DEFAULT_LOCALE, getFullUrl } from './config';
import { toProfileSlug } from '@/lib/profile-utils';
import type { Locale } from '@/lib/types';

/**
 * Simple fetch for sitemap generation (no auth required)
 * This avoids the Next.js request context issues with fetchApi
 */
async function simpleFetch(url: string): Promise<Response> {
    return fetch(url, {
        cache: 'no-store',
        headers: {
            Accept: 'application/json',
        },
    });
}

// ============================================================================
// Static Pages Sitemap
// ============================================================================

/**
 * Generate sitemap entries for static pages
 * Includes homepage, leaderboard, problems list, and other static routes
 * All locales get explicit prefixes
 */
export function generateStaticPagesSitemap(): SitemapEntry[] {
    const entries: SitemapEntry[] = [];

    // Define static routes with their configurations
    const staticRoutes = [
        {
            path: '/',
            changeFrequency: SITEMAP_CONFIG.changeFrequency.homepage,
            priority: SITEMAP_CONFIG.priority.homepage,
        },
        {
            path: '/problems',
            changeFrequency: SITEMAP_CONFIG.changeFrequency.problems,
            priority: SITEMAP_CONFIG.priority.problems,
        },
        {
            path: '/competitions',
            changeFrequency: SITEMAP_CONFIG.changeFrequency.competitions,
            priority: SITEMAP_CONFIG.priority.competitions,
        },
        {
            path: '/leaderboard',
            changeFrequency: SITEMAP_CONFIG.changeFrequency.leaderboard,
            priority: SITEMAP_CONFIG.priority.leaderboard,
        },
        {
            path: '/articles',
            changeFrequency: SITEMAP_CONFIG.changeFrequency.articles,
            priority: SITEMAP_CONFIG.priority.articles,
        },
        {
            path: '/institutions',
            changeFrequency: SITEMAP_CONFIG.changeFrequency.static,
            priority: SITEMAP_CONFIG.priority.static,
        },
        {
            path: '/countries',
            changeFrequency: SITEMAP_CONFIG.changeFrequency.static,
            priority: SITEMAP_CONFIG.priority.static,
        },
        {
            path: '/achievements',
            changeFrequency: SITEMAP_CONFIG.changeFrequency.static,
            priority: SITEMAP_CONFIG.priority.static,
        },
        {
            path: '/roadmap',
            changeFrequency: SITEMAP_CONFIG.changeFrequency.static,
            priority: SITEMAP_CONFIG.priority.static,
        },
        {
            path: '/privacy',
            changeFrequency: SITEMAP_CONFIG.changeFrequency.static,
            priority: SITEMAP_CONFIG.priority.static,
        },
        {
            path: '/terms',
            changeFrequency: SITEMAP_CONFIG.changeFrequency.static,
            priority: SITEMAP_CONFIG.priority.static,
        },
    ] as const;

    // Generate entries for each static route with all language versions
    for (const route of staticRoutes) {
        // Add entries for all locales (including default)
        for (const locale of SUPPORTED_LOCALES) {
            entries.push({
                url: getFullUrl(route.path, locale),
                lastModified: new Date(),
                changeFrequency: route.changeFrequency,
                priority: route.priority,
                alternateRefs: generateAlternateRefs(route.path),
            });
        }
    }

    return entries;
}

// ============================================================================
// Problems Sitemap
// ============================================================================

/**
 * Problem entry from the sitemap API
 */
interface ProblemSitemapEntry {
    id: number;
    title: string;
    lastModified: string | null;
}

/**
 * Generate sitemap entries for all problem pages
 * Fetches problems from the dedicated sitemap API endpoint
 */
export async function generateProblemsSitemap(): Promise<SitemapEntry[]> {
    const entries: SitemapEntry[] = [];

    try {
        // Fetch public problems from the sitemap API endpoint
        const response = await simpleFetch(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/sitemap/problems`,
        );

        if (!response.ok) {
            console.warn('[Sitemap] Failed to fetch public problems:', response.status);
            return entries;
        }

        const problems: ProblemSitemapEntry[] = await response.json();

        // Generate entries for each problem
        for (const problem of problems) {
            const path = `/problems/${problem.id}`;
            const lastModified = problem.lastModified ? new Date(problem.lastModified) : new Date();

            // Add entries for all locales (including default)
            for (const locale of SUPPORTED_LOCALES) {
                entries.push({
                    url: getFullUrl(path, locale),
                    lastModified,
                    changeFrequency: SITEMAP_CONFIG.changeFrequency.problems,
                    priority: SITEMAP_CONFIG.priority.problems,
                    alternateRefs: generateAlternateRefs(path),
                });
            }
        }

        console.debug(
            `[Sitemap] Generated ${entries.length} problem entries for ${problems.length} problems`,
        );
    } catch (error) {
        console.error('[Sitemap] Error generating problems sitemap:', error);
    }

    return entries;
}

// ============================================================================
// Competitions Sitemap
// ============================================================================

/**
 * Competition entry from the sitemap API
 */
interface CompetitionSitemapEntry {
    id: number;
    name: string;
    lastModified: string | null;
}

/**
 * Generate sitemap entries for all competition pages
 * Fetches competitions from the dedicated sitemap API endpoint
 */
export async function generateCompetitionsSitemap(): Promise<SitemapEntry[]> {
    const entries: SitemapEntry[] = [];

    try {
        // Fetch public competitions from the sitemap API endpoint
        const response = await simpleFetch(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/sitemap/competitions`,
        );

        if (!response.ok) {
            console.warn('[Sitemap] Failed to fetch public competitions:', response.status);
            return entries;
        }

        const competitions: CompetitionSitemapEntry[] = await response.json();

        // Generate entries for each competition
        for (const competition of competitions) {
            const path = `/competitions/${competition.id}`;
            const lastModified = competition.lastModified
                ? new Date(competition.lastModified)
                : new Date();

            // Add entries for all locales (including default)
            for (const locale of SUPPORTED_LOCALES) {
                entries.push({
                    url: getFullUrl(path, locale),
                    lastModified,
                    changeFrequency: SITEMAP_CONFIG.changeFrequency.competitions,
                    priority: SITEMAP_CONFIG.priority.competitions,
                    alternateRefs: generateAlternateRefs(path),
                });
            }
        }

        console.debug(
            `[Sitemap] Generated ${entries.length} competition entries for ${competitions.length} competitions`,
        );
    } catch (error) {
        console.error('[Sitemap] Error generating competitions sitemap:', error);
    }

    return entries;
}

// ============================================================================
// Articles Sitemap
// ============================================================================

interface ArticleSitemapEntry {
    slug: string;
    language: string;
    lastModified: string | null;
}

/** Generate one canonical entry per published article in its authored language. */
export async function generateArticlesSitemap(): Promise<SitemapEntry[]> {
    const entries: SitemapEntry[] = [];
    const response = await simpleFetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/sitemap/articles`);

    if (!response.ok) {
        throw new Error(`Published article sitemap source returned ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) {
        throw new Error('Published article sitemap source returned an invalid payload');
    }

    const seen = new Set<string>();
    for (const candidate of payload) {
        if (!candidate || typeof candidate !== 'object') {
            throw new Error('Published article sitemap source returned an invalid row');
        }
        const article = candidate as Partial<ArticleSitemapEntry>;
        const slug = typeof article.slug === 'string' ? article.slug.trim() : '';
        const language = typeof article.language === 'string' ? article.language.trim() : '';
        if (!slug || !SUPPORTED_LOCALES.includes(language as Locale)) {
            throw new Error('Published article sitemap source returned an invalid row');
        }

        const path = `/articles/${encodeURIComponent(slug)}`;
        const url = getFullUrl(path, language);
        if (seen.has(url)) {
            throw new Error('Published article sitemap source returned a duplicate article');
        }
        seen.add(url);

        const parsedLastModified = article.lastModified
            ? new Date(article.lastModified)
            : undefined;
        if (parsedLastModified && Number.isNaN(parsedLastModified.getTime())) {
            throw new Error('Published article sitemap source returned an invalid lastModified');
        }

        entries.push({
            url,
            lastModified: parsedLastModified,
            changeFrequency: SITEMAP_CONFIG.changeFrequency.articles,
            priority: SITEMAP_CONFIG.priority.articles,
            alternateRefs: [
                { href: url, hreflang: language },
                { href: url, hreflang: 'x-default' },
            ],
        });
    }

    console.debug(`[Sitemap] Generated ${entries.length} published article entries`);

    return entries;
}

// ============================================================================
// Profiles Sitemap
// ============================================================================

/**
 * Profile entry from the sitemap API
 */
interface ProfileSitemapEntry {
    username: string;
    lastModified: string | null;
}

/**
 * Generate sitemap entries for public user profiles
 * Only includes profiles that are marked as public
 * Uses URL-friendly slugs for profile URLs
 */
export async function generateProfilesSitemap(): Promise<SitemapEntry[]> {
    const entries: SitemapEntry[] = [];

    try {
        // Fetch public profiles from the sitemap API endpoint
        const response = await simpleFetch(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/sitemap/profiles`,
        );

        if (!response.ok) {
            // If endpoint doesn't exist or fails, log and return empty
            console.warn('[Sitemap] Failed to fetch public profiles:', response.status);
            return entries;
        }

        const profiles: ProfileSitemapEntry[] = await response.json();

        // Generate entries for each public profile
        for (const profile of profiles) {
            // Convert username to URL-friendly slug
            const slug = toProfileSlug(profile.username);
            if (!slug) {
                console.warn(
                    `[Sitemap] Skipping profile with invalid username: ${profile.username}`,
                );
                continue;
            }

            const path = `/profile/${slug}`;
            const lastModified = profile.lastModified ? new Date(profile.lastModified) : new Date();

            // Add entries for all locales (including default)
            for (const locale of SUPPORTED_LOCALES) {
                entries.push({
                    url: getFullUrl(path, locale),
                    lastModified,
                    changeFrequency: SITEMAP_CONFIG.changeFrequency.profiles,
                    priority: SITEMAP_CONFIG.priority.profiles,
                    alternateRefs: generateAlternateRefs(path),
                });
            }
        }

        console.debug(
            `[Sitemap] Generated ${entries.length} profile entries for ${profiles.length} profiles`,
        );
    } catch (error) {
        console.error('[Sitemap] Error generating profiles sitemap:', error);
    }

    return entries;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert locale code to proper hreflang format
 * zh-CN should be converted to zh-Hans for hreflang tags
 * This follows the BCP 47 language tag standard
 */
function getHreflangCode(locale: string): string {
    if (locale === 'zh-CN') {
        return 'zh-Hans';
    }
    return locale;
}

/**
 * Normalize path by removing trailing slashes, query params, and fragments
 */
function normalizePath(path: string): string {
    // Remove query parameters and fragments
    let normalized = path.split('?')[0].split('#')[0];

    // Ensure path starts with /
    if (!normalized.startsWith('/')) {
        normalized = `/${normalized}`;
    }

    // Remove trailing slash (except for root)
    if (normalized.length > 1 && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }

    return normalized;
}

/**
 * Generate hreflang alternate references for a given path
 * Creates alternate refs for all supported locales with proper hreflang format
 */
function generateAlternateRefs(path: string): Array<{ href: string; hreflang: string }> {
    const alternateRefs: Array<{ href: string; hreflang: string }> = [];

    // Add alternate refs for each supported locale
    for (const locale of SUPPORTED_LOCALES) {
        alternateRefs.push({
            href: getFullUrl(path, locale),
            // Use proper hreflang format (zh-CN → zh-Hans, others stay as-is)
            hreflang: getHreflangCode(locale),
        });
    }

    // Add x-default pointing to default locale (English)
    alternateRefs.push({
        href: getFullUrl(path, DEFAULT_LOCALE),
        hreflang: 'x-default',
    });

    return alternateRefs;
}

// ============================================================================
// Sitemap Entry Generation (for external use)
// ============================================================================

/**
 * Options for generating a sitemap entry
 */
interface SitemapEntryOptions {
    lastmod?: string;
    changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number;
}

/**
 * Generate a sitemap entry with all language alternates
 * This function creates a single sitemap entry with xhtml:link alternates
 * for all supported locales plus x-default
 * All locales get explicit prefixes
 *
 * @param path - The URL path (e.g., '/problems/123')
 * @param options - Optional sitemap entry options (lastmod, changefreq, priority)
 * @returns SitemapEntry with alternates for all locales
 */
export function generateSitemapEntry(
    path: string,
    options: SitemapEntryOptions = {},
): SitemapEntry {
    const normalizedPath = normalizePath(path);

    // Generate alternates for all locales (all get explicit prefixes)
    const alternates = SUPPORTED_LOCALES.map((locale) => ({
        hreflang: getHreflangCode(locale),
        href: getFullUrl(normalizedPath, locale),
    }));

    // Add x-default pointing to default locale (Romanian)
    alternates.push({
        hreflang: 'x-default',
        href: getFullUrl(normalizedPath, DEFAULT_LOCALE),
    });

    return {
        url: getFullUrl(normalizedPath, DEFAULT_LOCALE),
        lastModified: options.lastmod ? new Date(options.lastmod) : undefined,
        changeFrequency: options.changefreq,
        priority: options.priority,
        alternateRefs: alternates,
    };
}

// ============================================================================
// Sitemap XML Generation
// ============================================================================

/**
 * Generate XML sitemap with xhtml:link alternates for all locales
 * This function creates a complete XML sitemap string with proper namespace declarations
 *
 * @param entries - Array of SitemapEntry objects
 * @returns XML string for the sitemap
 */
export function generateSitemapXml(entries: SitemapEntry[]): string {
    const urls = entries
        .map((entry) => {
            const lastmod = entry.lastModified
                ? `<lastmod>${entry.lastModified.toISOString().split('T')[0]}</lastmod>`
                : '';
            const changefreq = entry.changeFrequency
                ? `<changefreq>${entry.changeFrequency}</changefreq>`
                : '';
            const priority =
                entry.priority !== undefined ? `<priority>${entry.priority}</priority>` : '';

            // Generate xhtml:link elements for alternates
            const alternateLinks =
                entry.alternateRefs
                    ?.map(
                        (alt) =>
                            `<xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${alt.href}"/>`,
                    )
                    .join('\n        ') || '';

            return `    <url>
        <loc>${entry.url}</loc>
        ${lastmod}
        ${changefreq}
        ${priority}
        ${alternateLinks}
    </url>`;
        })
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;
}

// ============================================================================
// Main Sitemap Generator
// ============================================================================

/**
 * Generate complete sitemap by combining all sources
 * Implements error handling with fallback to static pages
 */
export async function generateSitemap(): Promise<SitemapEntry[]> {
    const entries: SitemapEntry[] = [];

    // Always include static pages
    try {
        const staticEntries = generateStaticPagesSitemap();
        entries.push(...staticEntries);
        console.log(`[Sitemap] Added ${staticEntries.length} static page entries`);
    } catch (error) {
        console.error('[Sitemap] Error generating static pages sitemap:', error);
    }

    // Try to include problem pages
    try {
        const problemEntries = await generateProblemsSitemap();
        entries.push(...problemEntries);
    } catch (error) {
        console.error('[Sitemap] Error generating problems sitemap:', error);
        // Continue without problem entries
    }

    // Try to include competition pages
    try {
        const competitionEntries = await generateCompetitionsSitemap();
        entries.push(...competitionEntries);
    } catch (error) {
        console.error('[Sitemap] Error generating competitions sitemap:', error);
        // Continue without competition entries
    }

    // Try to include profile pages
    try {
        const profileEntries = await generateProfilesSitemap();
        entries.push(...profileEntries);
    } catch (error) {
        console.error('[Sitemap] Error generating profiles sitemap:', error);
        // Continue without profile entries
    }

    // Try to include published article pages
    try {
        const articleEntries = await generateArticlesSitemap();
        entries.push(...articleEntries);
    } catch (error) {
        console.error('[Sitemap] Error generating articles sitemap:', error);
    }

    console.log(`[Sitemap] Generated total of ${entries.length} sitemap entries`);

    return entries;
}
