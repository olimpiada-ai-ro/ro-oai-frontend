/**
 * Page-Specific Metadata Generators
 *
 * Metadata generators for specific page types with i18n integration
 * Implements SEO key priority: seo.* → UI keys → English → default
 */

import { MetadataConfig, PageMetadata } from './types';
import { generateMetadata, validateMetadataConfig } from './metadata';
import {
    SUPPORTED_LOCALES,
    DEFAULT_LOCALE,
    generateProblemOgImageUrl,
    generateProfileOgImageUrl,
    generateGenericOgImageUrl,
    generateCompetitionOgImageUrl,
    getFallbackOgImageUrl,
} from './config';
import { getMessages } from '@/lib/i18n-server';
import { getCanonicalUrl } from './canonical';
import { toProfileSlug } from '@/lib/profile-utils';
import { getProblemAuthorNames } from '@/lib/problem-authors';
import type { Locale, ProblemAuthor } from '@/lib/types';

// Import types from main types file
type Problem = {
    id: number;
    title: string;
    shortDescription: string;
    longDescription?: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    author: string;
    authors?: ProblemAuthor[];
    // Locale-specific fields for dynamic content localization
    titleEn?: string;
    titleRo?: string;
    shortDescriptionEn?: string;
    shortDescriptionRo?: string;
    longDescriptionEn?: string;
    longDescriptionRo?: string;
    [key: string]: unknown; // Allow dynamic locale fields like title{Locale}
};

type UserProfile = {
    username: string;
    firstName: string | null;
    lastName: string | null;
    bio: string | null;
    totalScore: number;
    problemsSolved: number;
    averageScore: number;
    rank: number;
};

type Competition = {
    id: number;
    name: string;
    description: string;
    startTime: string;
    endTime: string;
    participantCount?: number;
    problemCount?: number;
    // Locale-specific fields for dynamic content localization
    nameEn?: string;
    nameRo?: string;
    descriptionEn?: string;
    descriptionRo?: string;
    [key: string]: unknown; // Allow dynamic locale fields like name{Locale}
};

// ============================================================================
// SEO Translation Resolution Helpers
// ============================================================================

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return undefined;
        }
        current = (current as Record<string, unknown>)[key];
    }

    return typeof current === 'string' ? current : undefined;
}

/**
 * Cache for English messages to avoid repeated loading
 */
let englishMessagesCache: Record<string, unknown> | null = null;

/**
 * Get English messages for fallback
 */
async function getEnglishMessages(): Promise<Record<string, unknown>> {
    if (englishMessagesCache) {
        return englishMessagesCache;
    }
    try {
        englishMessagesCache = await getMessages(DEFAULT_LOCALE);
        return englishMessagesCache;
    } catch {
        return {};
    }
}

/**
 * Resolve SEO text with fallback chain:
 * 1. seo.{pageType}.{field} in current locale
 * 2. UI key in current locale
 * 3. seo.{pageType}.{field} in English
 * 4. UI key in English
 * 5. Default value
 *
 * @param messages - Current locale messages
 * @param seoKey - SEO-specific key (e.g., 'seo.home.title')
 * @param uiKey - Fallback UI key (e.g., 'hero.title')
 * @param defaultValue - Final fallback value
 * @param locale - Current locale
 */
async function getLocalizedSeoText(
    messages: Record<string, unknown>,
    seoKey: string,
    uiKey: string,
    defaultValue: string,
    locale: string,
): Promise<string> {
    // 1. Try SEO-specific key in current locale
    const seoValue = getNestedValue(messages, seoKey);
    if (seoValue) {
        return seoValue;
    }

    // 2. Try UI key in current locale
    const uiValue = getNestedValue(messages, uiKey);
    if (uiValue) {
        return uiValue;
    }

    // 3. If not English, try English fallback
    if (locale !== DEFAULT_LOCALE) {
        const englishMessages = await getEnglishMessages();

        // 3a. Try SEO key in English
        const enSeoValue = getNestedValue(englishMessages, seoKey);
        if (enSeoValue) {
            return enSeoValue;
        }

        // 3b. Try UI key in English
        const enUiValue = getNestedValue(englishMessages, uiKey);
        if (enUiValue) {
            return enUiValue;
        }
    }

    // 4. Use default value
    if (process.env.NODE_ENV === 'development') {
        console.warn(`[SEO] Missing translation for key: ${seoKey} (locale: ${locale})`);
    }
    return defaultValue;
}

/**
 * Get localized field from a dynamic content object (problem/competition)
 * Checks for locale-specific fields like name{Locale}, description{Locale}
 *
 * @param obj - The object containing the field
 * @param fieldName - Base field name (e.g., 'name', 'description')
 * @param locale - Current locale
 * @param defaultLocale - Fallback locale (defaults to 'ro' for problems/competitions)
 */
function getLocalizedField(
    obj: Record<string, unknown>,
    fieldName: string,
    locale: string,
    defaultLocale: string = 'ro',
): string {
    // Capitalize first letter for field name pattern (e.g., 'En', 'Ro')
    const localeCapitalized = locale.charAt(0).toUpperCase() + locale.slice(1);
    const defaultLocaleCapitalized = defaultLocale.charAt(0).toUpperCase() + defaultLocale.slice(1);

    // 1. Try locale-specific field (e.g., nameEn, descriptionFr)
    const localeField = `${fieldName}${localeCapitalized}`;
    if (obj[localeField] && typeof obj[localeField] === 'string') {
        return obj[localeField] as string;
    }

    // 2. Try English field
    const enField = `${fieldName}En`;
    if (locale !== 'en' && obj[enField] && typeof obj[enField] === 'string') {
        return obj[enField] as string;
    }

    // 3. Try default locale field (usually Romanian for problems/competitions)
    const defaultField = `${fieldName}${defaultLocaleCapitalized}`;
    if (obj[defaultField] && typeof obj[defaultField] === 'string') {
        return obj[defaultField] as string;
    }

    // 4. Fall back to base field
    if (obj[fieldName] && typeof obj[fieldName] === 'string') {
        return obj[fieldName] as string;
    }

    return '';
}

// ============================================================================
// Homepage Metadata
// ============================================================================

/**
 * Generate metadata for homepage with localized content
 * Uses SEO key priority: seo.home.* → hero.* → English → default
 */
export async function generateHomeMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as Locale);

        // Use SEO key priority fallback chain
        const title = await getLocalizedSeoText(
            messages,
            'seo.home.title',
            'hero.title',
            'MLCompete - Machine Learning Competition Platform',
            locale,
        );

        const description = await getLocalizedSeoText(
            messages,
            'seo.home.description',
            'hero.subtitle',
            'Explore and solve machine learning challenges. Test your models and climb the leaderboard.',
            locale,
        );

        // Generate dynamic OG image with fallback
        let ogImage: string;
        try {
            ogImage = generateGenericOgImageUrl(
                'MLCompete',
                'Machine Learning Competition Platform',
            );
        } catch (error) {
            console.error('[SEO] Failed to generate OG image URL:', error);
            ogImage = getFallbackOgImageUrl();
        }

        const config: MetadataConfig = {
            title,
            description,
            keywords: [
                'machine learning',
                'ML competition',
                'data science',
                'AI challenges',
                'model evaluation',
                'leaderboard',
            ],
            image: ogImage,
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/', locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate home metadata:', error);
        return generateMetadata(validateMetadataConfig({ locale }));
    }
}

// ============================================================================
// Problem Page Metadata
// ============================================================================

/**
 * Generate metadata for problem page with problem details
 * Uses locale-specific problem fields when available
 */
export async function generateProblemMetadata(
    problem: Problem,
    locale: string,
): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as Locale);

        // Get localized problem title and description
        const problemTitle =
            getLocalizedField(problem as Record<string, unknown>, 'title', locale, 'ro') ||
            problem.title;
        const problemDescription =
            getLocalizedField(
                problem as Record<string, unknown>,
                'shortDescription',
                locale,
                'ro',
            ) ||
            getLocalizedField(
                problem as Record<string, unknown>,
                'longDescription',
                locale,
                'ro',
            ) ||
            problem.shortDescription ||
            problem.longDescription;

        // Get localized difficulty label
        const difficultyLabel = await getLocalizedSeoText(
            messages,
            'problems.difficulty',
            'problems.difficulty',
            'Difficulty',
            locale,
        );
        const authorNames = getProblemAuthorNames(problem);
        const authorText = authorNames.join(', ') || problem.author;

        const title = `${problemTitle} - ${difficultyLabel}: ${problem.difficulty}`;
        const description =
            problemDescription ||
            `Solve this ${problem.difficulty.toLowerCase()} machine learning challenge by ${authorText}.`;

        // Generate dynamic OG image with fallback
        let ogImage: string;
        try {
            ogImage = generateProblemOgImageUrl(problemTitle, problem.difficulty);
        } catch (error) {
            console.error('[SEO] Failed to generate problem OG image URL:', error);
            ogImage = getFallbackOgImageUrl();
        }

        const config: MetadataConfig = {
            title,
            description,
            keywords: [
                'machine learning',
                'ML problem',
                problem.difficulty.toLowerCase(),
                'data science challenge',
                ...authorNames,
            ],
            image: ogImage,
            type: 'article',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl(`/problems/${problem.id}`, locale),
            author: authorText,
            section: 'Problems',
            tags: [problem.difficulty, 'Machine Learning', 'Competition'],
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate problem metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: problem.title,
                description: problem.shortDescription,
                locale,
            }),
        );
    }
}

// ============================================================================
// Profile Page Metadata
// ============================================================================

/**
 * Generate metadata for user profile page with user stats
 */
export async function generateProfileMetadata(
    profile: UserProfile,
    locale: string,
): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as Locale);
        const profileLabel = getNestedValue(messages, 'profile.title') || 'Profile';
        const solvedLabel = getNestedValue(messages, 'profile.problemsSolved') || 'Problems solved';
        const averageScoreLabel =
            getNestedValue(messages, 'profile.averageScore') || 'Average score';
        const rankLabel = getNestedValue(messages, 'profile.rank') || 'Rank';
        const numberFormatter = new Intl.NumberFormat(locale, {
            maximumFractionDigits: 2,
        });

        const title = `${profile.username} - ${profileLabel} - MLCompete`;

        let description: string;

        if (profile.bio) {
            const bio = `${profile.bio.substring(0, 100)}${profile.bio.length > 100 ? '...' : ''}`;
            description =
                locale === 'ro'
                    ? `Descoperă profilul public al utilizatorului ${profile.username} pe MLCompete, activitatea sa în competiții și progresul în învățarea automată. ${bio}`
                    : locale === 'en'
                      ? `Explore ${profile.username}'s public MLCompete profile, machine-learning activity, and competition progress. ${bio}`
                      : bio;
        } else {
            const stats = `${solvedLabel}: ${numberFormatter.format(profile.problemsSolved)}. ${averageScoreLabel}: ${numberFormatter.format(profile.averageScore)}. ${rankLabel}: #${numberFormatter.format(profile.rank)}.`;
            description =
                locale === 'ro'
                    ? `Descoperă profilul public și progresul în competiții al utilizatorului ${profile.username} pe MLCompete. ${stats}`
                    : locale === 'en'
                      ? `Explore ${profile.username}'s public MLCompete profile, machine-learning activity, and competition progress. ${stats}`
                      : `${profileLabel}: ${profile.username}. ${stats}`;
        }

        // Generate dynamic OG image with fallback
        let ogImage: string;
        try {
            ogImage = generateProfileOgImageUrl(profile.username, {
                rank: profile.rank,
                totalScore: profile.totalScore,
                problemsSolved: profile.problemsSolved,
            });
        } catch (error) {
            console.error('[SEO] Failed to generate profile OG image URL:', error);
            ogImage = getFallbackOgImageUrl();
        }

        const config: MetadataConfig = {
            title,
            description,
            keywords: [
                profile.username,
                'ML profile',
                'machine learning',
                'data scientist',
                'leaderboard',
            ],
            image: ogImage,
            type: 'profile',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl(`/profile/${toProfileSlug(profile.username)}`, locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate profile metadata:', error);
        const profileLabel = locale === 'ro' ? 'Profil' : 'Profile';
        return generateMetadata(
            validateMetadataConfig({
                title: `${profile.username} - ${profileLabel} - MLCompete`,
                description:
                    locale === 'ro'
                        ? `Profilul public al utilizatorului ${profile.username} pe platforma MLCompete.`
                        : `${profile.username}'s public profile on MLCompete.`,
                locale,
            }),
        );
    }
}

// ============================================================================
// Leaderboard Page Metadata
// ============================================================================

/**
 * Generate metadata for leaderboard page
 * Uses SEO key priority: seo.leaderboard.* → leaderboard.* → English → default
 */
export async function generateLeaderboardMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as Locale);

        // Use SEO key priority fallback chain
        const title = await getLocalizedSeoText(
            messages,
            'seo.leaderboard.title',
            'leaderboard.title',
            'Leaderboard - MLCompete',
            locale,
        );

        const description = await getLocalizedSeoText(
            messages,
            'seo.leaderboard.description',
            'leaderboard.subtitle',
            'View the top performers in machine learning competitions. See rankings, scores, and achievements.',
            locale,
        );

        // Generate dynamic OG image with fallback
        let ogImage: string;
        try {
            ogImage = generateGenericOgImageUrl(
                'Leaderboard',
                'Top performers in machine learning competitions',
            );
        } catch (error) {
            console.error('[SEO] Failed to generate OG image URL:', error);
            ogImage = getFallbackOgImageUrl();
        }

        const config: MetadataConfig = {
            title,
            description,
            keywords: [
                'leaderboard',
                'rankings',
                'top performers',
                'machine learning',
                'competition',
                'scores',
            ],
            image: ogImage,
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/leaderboard', locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate leaderboard metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: 'Leaderboard - MLCompete',
                description: 'View the top performers in machine learning competitions',
                locale,
            }),
        );
    }
}

// ============================================================================
// Problems List Page Metadata
// ============================================================================

/**
 * Generate metadata for problems list page
 * Uses SEO key priority: seo.problems.* → problems.* → English → default
 */
export async function generateProblemsListMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as Locale);

        // Use SEO key priority fallback chain
        const title = await getLocalizedSeoText(
            messages,
            'seo.problems.title',
            'problems.title',
            'Problems - MLCompete',
            locale,
        );

        const description = await getLocalizedSeoText(
            messages,
            'seo.problems.description',
            'problems.subtitle',
            'Explore and solve machine learning challenges.',
            locale,
        );

        // Generate dynamic OG image with fallback
        let ogImage: string;
        try {
            ogImage = generateGenericOgImageUrl(
                'Problems',
                'Explore and solve machine learning challenges',
            );
        } catch (error) {
            console.error('[SEO] Failed to generate OG image URL:', error);
            ogImage = getFallbackOgImageUrl();
        }

        const config: MetadataConfig = {
            title,
            description,
            keywords: [
                'machine learning problems',
                'ML challenges',
                'data science',
                'competitions',
                'algorithms',
            ],
            image: ogImage,
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/problems', locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate problems list metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: 'Problems - MLCompete',
                description: 'Explore and solve machine learning challenges',
                locale,
            }),
        );
    }
}

// ============================================================================
// Institutions Page Metadata
// ============================================================================

/**
 * Generate metadata for institutions list page
 */
export async function generateInstitutionsMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as any);

        const title = messages.institutions?.title || 'Institutions';
        const description =
            messages.institutions?.description || 'Browse and join educational institutions';

        const ogImage = generateGenericOgImageUrl('Institutions', description);

        const config: MetadataConfig = {
            title: `${title} - MLCompete`,
            description,
            keywords: ['institutions', 'schools', 'universities', 'education', 'Romania'],
            image: ogImage,
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/institutions', locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate institutions metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: 'Institutions - MLCompete',
                description: 'Browse and join educational institutions',
                locale,
            }),
        );
    }
}

// ============================================================================
// Countries Page Metadata
// ============================================================================

/**
 * Generate metadata for the country directory page.
 */
export async function generateCountriesMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as Locale);

        const title = getNestedValue(messages, 'countries.title') || 'Countries';
        const description =
            getNestedValue(messages, 'countries.description') ||
            getNestedValue(messages, 'institutions.description') ||
            'Explore countries represented on MLCompete, discover their educational institutions, and browse Romania by county on the platform.';

        const ogImage = generateGenericOgImageUrl('Countries', description);

        const config: MetadataConfig = {
            title: `${title} - MLCompete`,
            description,
            keywords: [
                'countries',
                'educational institutions',
                'Romania counties',
                'machine learning community',
            ],
            image: ogImage,
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/countries', locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate countries metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: 'Countries - MLCompete',
                description:
                    'Explore countries represented on MLCompete, discover their educational institutions, and browse Romania by county on the platform.',
                locale,
            }),
        );
    }
}

// ============================================================================
// Counties Page Metadata
// ============================================================================

/**
 * Generate metadata for counties list page
 */
export async function generateCountiesMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as any);

        const title = messages.counties?.title || 'Counties';
        const description =
            messages.counties?.description || 'Browse Romanian counties and their statistics';

        const ogImage = generateGenericOgImageUrl('Counties', description);

        const config: MetadataConfig = {
            title: `${title} - MLCompete`,
            description,
            keywords: ['counties', 'Romania', 'statistics', 'regions', 'education'],
            image: ogImage,
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/counties', locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate counties metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: 'Counties - MLCompete',
                description: 'Browse Romanian counties and their statistics',
                locale,
            }),
        );
    }
}

// ============================================================================
// Rankings Pages Metadata
// ============================================================================

/**
 * Generate metadata for institution rankings page
 */
export async function generateInstitutionRankingsMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as any);

        const title = messages.rankings?.institutionRankings || 'Institution Rankings';
        const description =
            messages.rankings?.institutionRankingsDescription ||
            'View institutions ranked by member count';

        const ogImage = generateGenericOgImageUrl('Institution Rankings', description);

        const config: MetadataConfig = {
            title: `${title} - MLCompete`,
            description,
            keywords: ['rankings', 'institutions', 'leaderboard', 'top institutions'],
            image: ogImage,
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/rankings/institutions', locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate institution rankings metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: 'Institution Rankings - MLCompete',
                description: 'View institutions ranked by member count',
                locale,
            }),
        );
    }
}

/**
 * Generate metadata for county rankings page
 */
export async function generateCountyRankingsMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as any);

        const title = messages.rankings?.countyRankings || 'County Rankings';
        const description =
            messages.rankings?.countyRankingsDescription || 'View counties ranked by user count';

        const ogImage = generateGenericOgImageUrl('County Rankings', description);

        const config: MetadataConfig = {
            title: `${title} - MLCompete`,
            description,
            keywords: ['rankings', 'counties', 'leaderboard', 'top counties'],
            image: ogImage,
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/rankings/counties', locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate county rankings metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: 'County Rankings - MLCompete',
                description: 'View counties ranked by user count',
                locale,
            }),
        );
    }
}

// ============================================================================
// My Requests Page Metadata
// ============================================================================

/**
 * Generate metadata for my requests page
 */
export async function generateMyRequestsMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as any);

        const title = messages.myRequests?.title || 'My Membership Requests';
        const description =
            messages.myRequests?.description ||
            'View and manage your institution membership requests';

        const ogImage = generateGenericOgImageUrl('My Requests', description);

        const config: MetadataConfig = {
            title: `${title} - MLCompete`,
            description,
            keywords: ['membership', 'requests', 'institutions', 'applications'],
            image: ogImage,
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/my-requests', locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate my requests metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: 'My Membership Requests - MLCompete',
                description: 'View and manage your institution membership requests',
                locale,
            }),
        );
    }
}

// ============================================================================
// Roadmap Page Metadata
// ============================================================================

/**
 * Generate metadata for roadmap page
 */
export async function generateRoadmapMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as any);

        const title = messages.roadmap?.title || 'Roadmap';
        const description =
            messages.roadmap?.description ||
            'What we are building next and our vision for the platform';

        const ogImage = generateGenericOgImageUrl('Roadmap', description);

        const config: MetadataConfig = {
            title: `${title} - MLCompete`,
            description,
            keywords: ['roadmap', 'future', 'features', 'development', 'vision'],
            image: ogImage,
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/roadmap', locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate roadmap metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: 'Roadmap - MLCompete',
                description: 'What we are building next and our vision for the platform',
                locale,
            }),
        );
    }
}

// ============================================================================
// My Questions Page Metadata
// ============================================================================

/**
 * Generate metadata for my questions page
 */
export async function generateMyQuestionsMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as any);

        const title = messages.myQuestions?.title || 'My Questions';
        const description =
            messages.myQuestions?.description || 'View and manage your questions about problems';

        const ogImage = generateGenericOgImageUrl('My Questions', description);

        const config: MetadataConfig = {
            title: `${title} - MLCompete`,
            description,
            keywords: ['questions', 'help', 'support', 'problems', 'answers'],
            image: ogImage,
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/my-questions', locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate my questions metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: 'My Questions - MLCompete',
                description: 'View and manage your questions about problems',
                locale,
            }),
        );
    }
}

// ============================================================================
// Competitions List Page Metadata
// ============================================================================

/**
 * Generate metadata for competitions list page
 * Uses SEO key priority: seo.competitions.* → competitions.* → English → default
 */
export async function generateCompetitionsListMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as Locale);

        // Use SEO key priority fallback chain
        const title = await getLocalizedSeoText(
            messages,
            'seo.competitions.title',
            'competitions.list.title',
            'Competitions - MLCompete',
            locale,
        );

        const description = await getLocalizedSeoText(
            messages,
            'seo.competitions.description',
            'competitions.list.subtitle',
            'Join machine learning competitions and test your skills against others.',
            locale,
        );

        // Generate dynamic OG image with fallback
        let ogImage: string;
        try {
            ogImage = generateGenericOgImageUrl(
                'Competitions',
                'Machine learning competitions and challenges',
            );
        } catch (error) {
            console.error('[SEO] Failed to generate OG image URL:', error);
            ogImage = getFallbackOgImageUrl();
        }

        const config: MetadataConfig = {
            title,
            description,
            keywords: [
                'machine learning competitions',
                'ML challenges',
                'data science contests',
                'AI competitions',
                'leaderboard',
            ],
            image: ogImage,
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/competitions', locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate competitions list metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: 'Competitions - MLCompete',
                description: 'Join machine learning competitions and test your skills',
                locale,
            }),
        );
    }
}

// ============================================================================
// Achievements Page Metadata
// ============================================================================

/**
 * Generate metadata for achievements page
 * Uses SEO key priority: seo.achievements.* → achievements.* → English → default
 */
export async function generateAchievementsMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as Locale);

        // Use SEO key priority fallback chain
        const title = await getLocalizedSeoText(
            messages,
            'seo.achievements.title',
            'achievements.pageTitle',
            'Achievements - MLCompete',
            locale,
        );

        const description = await getLocalizedSeoText(
            messages,
            'seo.achievements.description',
            'achievements.pageDescription',
            'Earn achievements by solving problems, competing, and engaging with the platform.',
            locale,
        );

        // Generate dynamic OG image with fallback
        let ogImage: string;
        try {
            ogImage = generateGenericOgImageUrl('Achievements', 'Unlock achievements and earn XP');
        } catch (error) {
            console.error('[SEO] Failed to generate OG image URL:', error);
            ogImage = getFallbackOgImageUrl();
        }

        const config: MetadataConfig = {
            title,
            description,
            keywords: [
                'achievements',
                'badges',
                'rewards',
                'XP',
                'machine learning',
                'gamification',
            ],
            image: ogImage,
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/achievements', locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate achievements metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: 'Achievements - MLCompete',
                description: 'Earn achievements by solving problems and competing',
                locale,
            }),
        );
    }
}

// ============================================================================
// Login Page Metadata
// ============================================================================

/**
 * Generate metadata for login page
 */
export async function generateLoginMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as any);

        const title = messages.auth?.signIn || 'Sign In';
        const description =
            messages.auth?.signInDescription ||
            'Sign in to MLCompete to access competitions, track progress, and compete.';

        const config: MetadataConfig = {
            title: `${title} - MLCompete`,
            description,
            keywords: ['sign in', 'login', 'MLCompete', 'machine learning platform'],
            image: getFallbackOgImageUrl(),
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/login', locale),
            noindex: true, // Don't index login pages
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate login metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: 'Sign In - MLCompete',
                description: 'Sign in to access MLCompete platform',
                locale,
                noindex: true,
            }),
        );
    }
}

// ============================================================================
// Settings Page Metadata
// ============================================================================

/**
 * Generate metadata for settings page
 */
export async function generateSettingsMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as any);

        const title = messages.settings?.title || 'Settings';
        const description =
            messages.settings?.description ||
            'Manage your account settings, profile, and preferences on MLCompete.';

        const config: MetadataConfig = {
            title: `${title} - MLCompete`,
            description,
            keywords: ['settings', 'account', 'profile', 'preferences'],
            image: getFallbackOgImageUrl(),
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/settings', locale),
            noindex: true, // Don't index user settings pages
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate settings metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: 'Settings - MLCompete',
                description: 'Manage your account settings and preferences',
                locale,
                noindex: true,
            }),
        );
    }
}

// ============================================================================
// Privacy Policy Page Metadata
// ============================================================================

/**
 * Generate metadata for privacy policy page
 */
export async function generatePrivacyMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as Locale);
        const isRomanian = locale === 'ro';
        const title =
            getNestedValue(messages, 'legal.privacy.metaTitle') ||
            (isRomanian ? 'Politica de confidențialitate' : 'Privacy Policy');
        const description =
            getNestedValue(messages, 'legal.privacy.metaDescription') ||
            (isRomanian
                ? 'Află cum MLCompete colectează, folosește și protejează datele tale personale, care sunt drepturile tale și cum ne poți contacta.'
                : 'Learn how MLCompete collects, uses, and protects personal data, which privacy rights are available to you, and how to contact us.');

        const config: MetadataConfig = {
            title: `${title} - MLCompete`,
            description,
            keywords: ['privacy policy', 'data protection', 'GDPR', 'personal data', 'MLCompete'],
            image: getFallbackOgImageUrl(),
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/privacy', locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate privacy metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: 'Privacy Policy - MLCompete',
                description: 'Privacy policy and data protection information',
                locale,
            }),
        );
    }
}

// ============================================================================
// Terms of Service Page Metadata
// ============================================================================

/**
 * Generate metadata for terms of service page
 */
export async function generateTermsMetadata(locale: string): Promise<PageMetadata> {
    try {
        const messages = await getMessages(locale as Locale);
        const isRomanian = locale === 'ro';
        const title =
            getNestedValue(messages, 'legal.terms.metaTitle') ||
            (isRomanian ? 'Termeni și condiții' : 'Terms & Conditions');
        const description =
            getNestedValue(messages, 'legal.terms.metaDescription') ||
            (isRomanian
                ? 'Consultă regulile și condițiile de utilizare a platformei MLCompete, inclusiv responsabilitățile contului și participarea la competiții.'
                : 'Review the rules and conditions for using MLCompete, including account responsibilities, acceptable conduct, competition participation, and platform access.');

        const config: MetadataConfig = {
            title: `${title} - MLCompete`,
            description,
            keywords: [
                'terms of service',
                'terms and conditions',
                'user agreement',
                'legal',
                'MLCompete',
            ],
            image: getFallbackOgImageUrl(),
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl('/terms', locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate terms metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: 'Terms & Conditions - MLCompete',
                description: 'Terms and conditions for using the platform',
                locale,
            }),
        );
    }
}

// ============================================================================
// Competition Page Metadata
// ============================================================================

/**
 * Get competition status based on dates
 */
function getCompetitionStatus(startTime: string, endTime: string): 'UPCOMING' | 'ACTIVE' | 'ENDED' {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (now < start) {
        return 'UPCOMING';
    } else if (now > end) {
        return 'ENDED';
    }
    return 'ACTIVE';
}

/**
 * Format date for display in metadata
 */
function formatDateForMetadata(dateString: string, locale: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale === 'ro' ? 'ro-RO' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

/**
 * Generate metadata for competition page with competition details
 * Uses locale-specific competition fields when available
 */
export async function generateCompetitionMetadata(
    competition: Competition,
    locale: string,
): Promise<PageMetadata> {
    try {
        const status = getCompetitionStatus(competition.startTime, competition.endTime);
        const startDate = formatDateForMetadata(competition.startTime, locale);
        const endDate = formatDateForMetadata(competition.endTime, locale);

        // Get localized competition name and description
        const competitionName =
            getLocalizedField(competition as Record<string, unknown>, 'name', locale, 'ro') ||
            competition.name;
        const competitionDescription =
            getLocalizedField(
                competition as Record<string, unknown>,
                'description',
                locale,
                'ro',
            ) || competition.description;

        // Build title with localized name
        const title = `${competitionName} - MLCompete Competition`;

        // Build description with dates and participant count (120-160 chars)
        let description = competitionDescription || '';
        const dateInfo = `${startDate} - ${endDate}`;
        const participantInfo = competition.participantCount
            ? ` | ${competition.participantCount} participants`
            : '';

        // Ensure description fits within SEO limits (120-160 chars)
        const suffix = ` | ${dateInfo}${participantInfo}`;
        const maxDescLength = 160 - suffix.length;

        if (description.length > maxDescLength) {
            description = description.substring(0, maxDescLength - 3) + '...';
        }
        description = description + suffix;

        // Ensure minimum length
        if (description.length < 120) {
            description = `Join ${competitionName} on MLCompete. ${description}`;
        }

        // Generate dynamic OG image with fallback
        let ogImage: string;
        try {
            ogImage = generateCompetitionOgImageUrl(competitionName, status, {
                start: competition.startTime,
                end: competition.endTime,
            });
        } catch (error) {
            console.error('[SEO] Failed to generate competition OG image URL:', error);
            ogImage = getFallbackOgImageUrl();
        }

        const config: MetadataConfig = {
            title,
            description,
            keywords: [
                'machine learning competition',
                'ML challenge',
                competitionName,
                'data science',
                'AI competition',
                status.toLowerCase(),
            ],
            image: ogImage,
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
            canonicalUrl: getCanonicalUrl(`/competitions/${competition.id}`, locale),
        };

        return generateMetadata(config);
    } catch (error) {
        console.error('[SEO] Failed to generate competition metadata:', error);
        return generateMetadata(
            validateMetadataConfig({
                title: `${competition.name} - MLCompete Competition`,
                description: competition.description || 'Machine learning competition on MLCompete',
                locale,
            }),
        );
    }
}
