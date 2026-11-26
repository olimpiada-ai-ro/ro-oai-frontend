/**
 * Structured Data (JSON-LD) Generators
 *
 * Generate schema.org structured data for rich search results
 */

import {
    OrganizationSchema,
    WebSiteSchema,
    PersonSchema,
    BreadcrumbSchema,
    BreadcrumbItem,
    EventSchema,
    EventStatusType,
    QuizSchema,
    ArticleSchema,
    ImageObjectSchema,
} from './types';
import {
    SITE_CONFIG,
    BASE_URL,
    ORGANIZATION_CONFIG,
    generateCompetitionOgImageUrl,
} from './config';
import type {
    Problem,
    UserProfile,
    GenericLeaderboardEntry,
    CompetitionUserResponse,
} from '@/lib/types';
import { getProblemAuthors } from '@/lib/problem-authors';
import { getProfileUrl } from '@/lib/profile-utils';
import { limitProfileBio } from '@/lib/profile-bio';
import { getUsableAvatarUrl, getUserDisplayName } from '@/lib/user-identity';

const EXPIRING_IMAGE_QUERY_PARAMETERS = new Set([
    'x-amz-algorithm',
    'x-amz-credential',
    'x-amz-date',
    'x-amz-expires',
    'x-amz-signature',
    'x-amz-security-token',
    'x-goog-algorithm',
    'x-goog-credential',
    'x-goog-date',
    'x-goog-expires',
    'x-goog-signature',
    'signature',
]);

/**
 * Structured data must point crawlers at a durable HTTP resource. CSS initials,
 * blob/data URLs, generic placeholders, and expiring storage signatures are
 * deliberately omitted instead of being advertised as a user's photograph.
 */
function getCrawlableAvatarUrl(avatar: string | null | undefined): string | undefined {
    const usableAvatar = getUsableAvatarUrl(avatar);
    if (!usableAvatar) return undefined;

    try {
        const url = new URL(usableAvatar, BASE_URL);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;

        const hasExpiringSignature = Array.from(url.searchParams.keys()).some((parameter) =>
            EXPIRING_IMAGE_QUERY_PARAMETERS.has(parameter.toLowerCase()),
        );
        return hasExpiringSignature ? undefined : url.toString();
    } catch {
        return undefined;
    }
}

function problemAuthorSchemas(problem: Problem, locale: string) {
    return getProblemAuthors(problem).map((author) => ({
        '@type': 'Person' as const,
        name: author.displayName,
        ...(author.userId
            ? { url: `${BASE_URL}/${locale}${getProfileUrl(author.userId, author.username)}` }
            : {}),
    }));
}

// ============================================================================
// Organization Schema
// ============================================================================

/**
 * Generate Organization schema for the homepage
 * Provides company information and social links
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 4.1
 * - Includes Organization schema in JSON-LD on all pages
 * - Contains name, logo (as ImageObject), URL, contact info
 * - Includes sameAs for social media links
 * - Includes foundingDate, alternateName, contactPoint with availableLanguage
 * - Includes inLanguage property matching the current locale
 */
export function generateOrganizationSchema(locale: string = 'en'): OrganizationSchema {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: ORGANIZATION_CONFIG.name,
        alternateName: ORGANIZATION_CONFIG.alternateName,
        url: ORGANIZATION_CONFIG.url,
        logo: {
            '@type': 'ImageObject',
            url: ORGANIZATION_CONFIG.logo,
            width: ORGANIZATION_CONFIG.logoWidth,
            height: ORGANIZATION_CONFIG.logoHeight,
        },
        description:
            locale === 'ro'
                ? 'Platformă de competiții de Machine Learning și Inteligență Artificială'
                : 'Machine Learning and AI Competition Platform',
        email: ORGANIZATION_CONFIG.email,
        foundingDate: ORGANIZATION_CONFIG.foundingDate,
        sameAs: [...ORGANIZATION_CONFIG.sameAs],
        contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            email: ORGANIZATION_CONFIG.email,
            availableLanguage: [...ORGANIZATION_CONFIG.availableLanguages],
        },
        inLanguage: locale,
    };
}

// ============================================================================
// WebSite Schema
// ============================================================================

/**
 * Generate WebSite schema with search functionality
 * Enables site search in search results
 *
 * Requirements: 4.2
 * - Includes inLanguage property matching the current locale
 */
export function generateWebSiteSchema(locale: string = 'en'): WebSiteSchema {
    const localePrefix = `/${locale}`;

    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_CONFIG.name,
        url: BASE_URL,
        description: SITE_CONFIG.description,
        potentialAction: {
            '@type': 'SearchAction',
            target: `${BASE_URL}${localePrefix}/problems?search={search_term_string}`,
            'query-input': 'required name=search_term_string',
        },
        inLanguage: locale,
    };
}

// ============================================================================
// Problem Schema (Custom Type)
// ============================================================================

/**
 * Generate custom Problem schema for problem pages
 * Uses schema.org/Thing as base with custom properties
 */
export function generateProblemSchema(problem: Problem, locale: string = 'en'): object {
    const localePrefix = `/${locale}`;
    const problemUrl = `${BASE_URL}${localePrefix}/problems/${problem.id}`;

    return {
        '@context': 'https://schema.org',
        '@type': 'Thing',
        name: problem.title,
        description: problem.shortDescription,
        url: problemUrl,
        identifier: problem.id,
        additionalType: 'MachineLearningProblem',
        author: problemAuthorSchemas(problem, locale),
        difficulty: problem.difficulty,
        aggregateRating: problem.topScore
            ? {
                  '@type': 'AggregateRating',
                  ratingValue: problem.topScore,
                  bestRating: 100,
                  worstRating: 0,
              }
            : undefined,
    };
}

// ============================================================================
// Quiz Schema (for Problems - Google Practice Problems compliant)
// ============================================================================

/**
 * Map difficulty level to educational level
 * Converts problem difficulty to schema.org educationalLevel
 */
function mapDifficultyToEducationalLevel(difficulty: string): string {
    const mapping: Record<string, string> = {
        easy: 'beginner',
        medium: 'intermediate',
        hard: 'advanced',
        expert: 'expert',
    };
    return mapping[difficulty.toLowerCase()] || 'intermediate';
}

/**
 * Generate Quiz schema for problem pages
 * Uses schema.org/Quiz for practice problems (Google Practice Problems compliant)
 *
 * Requirements: 5.1, 5.2, 5.4
 * - Generates Quiz schema when user accesses problem page
 * - Contains name, about (subject), educationalLevel, educationalAlignment
 * - Includes keywords from subtasks (categories) if they exist
 * - Includes author
 */
export function generateQuizSchema(problem: Problem, locale: string = 'en'): QuizSchema {
    const schema: QuizSchema = {
        '@context': 'https://schema.org',
        '@type': 'Quiz',
        name: problem.title,
        inLanguage: locale,
        about: {
            '@type': 'Thing',
            name: 'Machine Learning',
        },
        educationalLevel: mapDifficultyToEducationalLevel(problem.difficulty),
        author: problemAuthorSchemas(problem, locale),
    };

    // Add educationalAlignment and keywords if subtasks exist (as categories)
    if (problem.subtasks && problem.subtasks.length > 0) {
        schema.educationalAlignment = problem.subtasks.map((subtask) => ({
            '@type': 'AlignmentObject',
            alignmentType: 'educationalSubject',
            targetName: subtask.subtaskName,
        }));

        // Add keywords from subtask names (Requirement 5.4)
        schema.keywords = problem.subtasks.map((subtask) => subtask.subtaskName);
    }

    return schema;
}

// ============================================================================
// Competition Schema (Event)
// ============================================================================

/**
 * Get schema.org event status based on competition dates
 *
 * Returns the appropriate EventStatusType based on current time relative to
 * competition start and end times.
 *
 * @param startTime - ISO 8601 formatted start time
 * @param endTime - ISO 8601 formatted end time
 * @returns EventStatusType URL string
 */
export function getEventStatus(startTime: string, endTime: string): EventStatusType {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (now < start) {
        return 'https://schema.org/EventScheduled';
    } else if (now > end) {
        // Note: EventEnded is not a standard schema.org status, using EventScheduled for past events
        // as Google recommends keeping the status as scheduled for completed events
        return 'https://schema.org/EventScheduled';
    }
    // Event is currently ongoing
    return 'https://schema.org/EventScheduled';
}

/**
 * Locale suffix mapping for competition translation fields
 * Maps locale codes to the suffix used in CompetitionUserResponse fields
 */
const LOCALE_FIELD_SUFFIX_MAP: Record<string, string> = {
    en: 'En',
    de: 'De',
    bg: 'Bg',
    sr: 'Sr',
    uk: 'Uk',
    hu: 'Hu',
};

/**
 * Get localized competition field value
 * Resolves locale-specific field with fallback to default field
 *
 * @param competition - The competition object
 * @param field - The base field name ('name', 'description', 'shortDescription', 'rules')
 * @param locale - The target locale
 * @returns The localized field value or the default field value
 */
export function getLocalizedCompetitionField(
    competition: CompetitionUserResponse,
    field: 'name' | 'description' | 'shortDescription' | 'rules',
    locale: string,
): string {
    const suffix = LOCALE_FIELD_SUFFIX_MAP[locale];

    if (suffix) {
        // Try to get the locale-specific field
        const localizedFieldName = `${field}${suffix}` as keyof CompetitionUserResponse;
        const localizedValue = competition[localizedFieldName];

        if (localizedValue && typeof localizedValue === 'string') {
            return localizedValue;
        }
    }

    // Fall back to the default field (Romanian)
    return competition[field] || '';
}

/**
 * Generate Event schema for competition pages
 * Uses schema.org/Event for competitions
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 * - Generates Event schema when user accesses competition page
 * - Contains name, startDate, endDate, location (online), description, organizer
 * - Includes eventStatus to indicate competition state
 * - Includes eventAttendanceMode set to OnlineEventAttendanceMode
 * - Includes image from competition or fallback
 * - Includes offers with price, availability, validFrom
 * - Organizer is complete Organization schema
 * - Uses locale-specific name and description when available
 * - Includes inLanguage property matching the current locale
 */
export function generateCompetitionSchema(
    competition: CompetitionUserResponse,
    locale: string = 'en',
): EventSchema {
    const localePrefix = `/${locale}`;
    const competitionUrl = `${BASE_URL}${localePrefix}/competitions/${competition.id}`;

    // Get localized name and description
    const name = getLocalizedCompetitionField(competition, 'name', locale);
    const description = getLocalizedCompetitionField(competition, 'description', locale);
    const now = Date.now();
    const startTimestamp = Date.parse(competition.startTime);
    const endTimestamp = Date.parse(competition.endTime);
    const ogStatus = now < startTimestamp ? 'UPCOMING' : now > endTimestamp ? 'ENDED' : 'ACTIVE';

    return {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name,
        description,
        startDate: competition.startTime,
        endDate: competition.endTime,
        eventStatus: getEventStatus(competition.startTime, competition.endTime),
        eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
        location: {
            '@type': 'VirtualLocation',
            url: competitionUrl,
        },
        organizer: {
            '@type': 'Organization',
            name: ORGANIZATION_CONFIG.name,
            url: ORGANIZATION_CONFIG.url,
        },
        image: generateCompetitionOgImageUrl(name, ogStatus, {
            start: competition.startTime,
            end: competition.endTime,
        }),
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'RON',
            availability: 'https://schema.org/InStock',
            url: competitionUrl,
            validFrom: competition.startTime,
        },
        inLanguage: locale,
    };
}

// ============================================================================
// Article Schema (for Roadmap pages)
// ============================================================================

/**
 * Input type for Article schema generation
 * Extends RoadmapPagePublicResponse with optional metadata fields
 */
export interface ArticleInput {
    title: string;
    slug: string;
    html?: string;
    description?: string;
    datePublished?: string;
    dateModified?: string;
    image?: string;
}

/**
 * Generate Article schema for roadmap pages
 * Uses schema.org/Article for educational content
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 * - Generates Article schema when user accesses roadmap page
 * - Contains headline, author, datePublished, dateModified
 * - Includes publisher as Organization schema
 * - Includes mainEntityOfPage
 * - Includes image if available
 */
export function generateArticleSchema(article: ArticleInput, locale: string = 'en'): ArticleSchema {
    const localePrefix = `/${locale}`;
    const articleUrl = `${BASE_URL}${localePrefix}/roadmap/${article.slug}`;

    // Extract description from HTML content or use provided description
    const description =
        article.description ||
        (article.html
            ? article.html
                  .replace(/<[^>]*>/g, '') // Strip HTML tags
                  .substring(0, 160)
                  .trim()
            : undefined);

    // Use current date as fallback for datePublished
    const datePublished = article.datePublished || new Date().toISOString();

    const schema: ArticleSchema = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        datePublished,
        author: {
            '@type': 'Organization',
            name: ORGANIZATION_CONFIG.name,
            url: ORGANIZATION_CONFIG.url,
        },
        publisher: {
            '@type': 'Organization',
            name: ORGANIZATION_CONFIG.name,
            logo: {
                '@type': 'ImageObject',
                url: ORGANIZATION_CONFIG.logo,
            },
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': articleUrl,
        },
    };

    // Add optional description
    if (description) {
        schema.description = description;
    }

    // Add dateModified if provided
    if (article.dateModified) {
        schema.dateModified = article.dateModified;
    }

    // Requirement 3.4: Include image if available
    if (article.image) {
        schema.image = article.image;
    }

    return schema;
}

// ============================================================================
// ImageObject Schema (for Image License Metadata)
// ============================================================================

/**
 * Options for generating ImageObject schema
 */
export interface ImageObjectOptions {
    license?: string;
    acquireLicensePage?: string;
    creditText?: string;
    creator?: string;
    copyrightNotice?: string;
    width?: number;
    height?: number;
}

/**
 * Generate ImageObject schema for image license metadata
 * Uses schema.org/ImageObject for images with licensing information
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 * - Generates ImageObject schema when homepage is loaded
 * - Contains contentUrl, license, acquireLicensePage, creditText
 * - Specifies creator if available
 * - Includes copyrightNotice if image has usage restrictions
 */
export function generateImageObjectSchema(
    imageUrl: string,
    options?: ImageObjectOptions,
): ImageObjectSchema {
    const schema: ImageObjectSchema = {
        '@context': 'https://schema.org',
        '@type': 'ImageObject',
        contentUrl: imageUrl,
    };

    // Add url as alias for contentUrl (some consumers prefer this)
    schema.url = imageUrl;

    // Add dimensions if provided
    if (options?.width) {
        schema.width = options.width;
    }
    if (options?.height) {
        schema.height = options.height;
    }

    // Requirement 6.2: Add license information
    if (options?.license) {
        schema.license = options.license;
    } else {
        // Default to Creative Commons BY-NC 4.0
        schema.license = 'https://creativecommons.org/licenses/by-nc/4.0/';
    }

    // Requirement 6.2: Add acquireLicensePage
    if (options?.acquireLicensePage) {
        schema.acquireLicensePage = options.acquireLicensePage;
    } else {
        schema.acquireLicensePage = `${BASE_URL}/terms`;
    }

    // Requirement 6.2: Add creditText
    if (options?.creditText) {
        schema.creditText = options.creditText;
    } else {
        schema.creditText = ORGANIZATION_CONFIG.name;
    }

    // Requirement 6.3: Add creator if available
    schema.creator = {
        '@type': 'Organization',
        name: options?.creator || ORGANIZATION_CONFIG.name,
    };

    // Requirement 6.4: Add copyrightNotice if image has usage restrictions
    if (options?.copyrightNotice) {
        schema.copyrightNotice = options.copyrightNotice;
    } else {
        schema.copyrightNotice = `© ${new Date().getFullYear()} ${ORGANIZATION_CONFIG.name}`;
    }

    return schema;
}

// ============================================================================
// Person Schema
// ============================================================================

/**
 * Generate Person schema for user profile pages
 * Includes user stats and bio
 */
export function generatePersonSchema(profile: UserProfile, locale: string = 'en'): PersonSchema {
    const localePrefix = `/${locale}`;
    const profileUrl = `${BASE_URL}${localePrefix}${getProfileUrl(
        profile.userId,
        profile.username,
    )}`;
    const publicName = getUserDisplayName(profile);
    const avatarUrl = getCrawlableAvatarUrl(profile.avatar);

    const sameAs: string[] = [];
    if (profile.website) sameAs.push(profile.website);
    if (profile.github) sameAs.push(`https://github.com/${profile.github}`);

    return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: publicName,
        alternateName: publicName !== profile.username ? profile.username : undefined,
        url: profileUrl,
        image: avatarUrl,
        description:
            limitProfileBio(profile.bio) ||
            `${publicName} - Machine Learning Competitor on MLCompete`,
        sameAs: sameAs.length > 0 ? sameAs : undefined,
    };
}

// ============================================================================
// ItemList Schema
// ============================================================================

/**
 * Generate ItemList schema for leaderboard rankings
 * Displays ranked list in search results
 */
export function generateItemListSchema(
    items: GenericLeaderboardEntry[],
    locale: string = 'en',
    totalItems: number = items.length,
): object {
    const localePrefix = `/${locale}`;
    const leaderboardUrl = `${BASE_URL}${localePrefix}/leaderboard`;

    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'MLCompete Leaderboard',
        description: 'Top machine learning competitors ranked by total score',
        url: leaderboardUrl,
        numberOfItems: totalItems,
        itemListElement: items.map((entry) => ({
            '@type': 'ListItem',
            position: entry.rank,
            item: {
                '@type': 'Person',
                name: entry.username,
                url: `${BASE_URL}${localePrefix}${getProfileUrl(entry.userId, entry.username)}`,
                image: getCrawlableAvatarUrl(entry.avatar),
                description: `Rank #${entry.rank} with ${entry.totalScore} points`,
            },
        })),
    };
}

// ============================================================================
// Breadcrumb Schema
// ============================================================================

/**
 * Generate BreadcrumbList schema for navigation breadcrumbs
 * Helps search engines understand site structure
 */
export function generateBreadcrumbSchema(items: BreadcrumbItem[]): BreadcrumbSchema {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url,
        })),
    };
}

// ============================================================================
// Generic Structured Data Generator
// ============================================================================

/**
 * Generate structured data based on type
 * Provides a unified interface for all schema types
 */
export function generateStructuredData(type: string, data: any, locale: string = 'en'): object {
    switch (type) {
        case 'Organization':
            return generateOrganizationSchema(locale);

        case 'WebSite':
            return generateWebSiteSchema(locale);

        case 'Problem':
            return generateProblemSchema(data as Problem, locale);

        case 'Quiz':
            return generateQuizSchema(data as Problem, locale);

        case 'Competition':
            return generateCompetitionSchema(data as CompetitionUserResponse, locale);

        case 'Article':
            return generateArticleSchema(data as ArticleInput, locale);

        case 'Person':
            return generatePersonSchema(data as UserProfile, locale);

        case 'ItemList':
            return generateItemListSchema(data as GenericLeaderboardEntry[], locale);

        case 'BreadcrumbList':
            return generateBreadcrumbSchema(data as BreadcrumbItem[]);

        case 'ImageObject':
            return generateImageObjectSchema(
                data.imageUrl as string,
                data.options as ImageObjectOptions | undefined,
            );

        default:
            throw new Error(`Unknown structured data type: ${type}`);
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate structured data against basic schema.org requirements
 *
 * Requirements: 7.1, 7.2
 * - Validates JSON-LD structure with @context and @type
 * - Ensures @context contains schema.org
 * - Checks for valid JSON structure
 *
 * @param data - The structured data object to validate
 * @returns true if valid, false otherwise
 */
export function validateStructuredData(data: object): boolean {
    // Check if data is a valid object
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return false;
    }

    const schema = data as Record<string, unknown>;

    // Check for required @context and @type
    if (!schema['@context'] || !schema['@type']) {
        return false;
    }

    // Check that @context is schema.org (string or contains schema.org)
    const context = schema['@context'];
    if (typeof context === 'string') {
        if (!context.includes('schema.org')) {
            return false;
        }
    } else if (Array.isArray(context)) {
        // Context can be an array in JSON-LD
        const hasSchemaOrg = context.some((c) => typeof c === 'string' && c.includes('schema.org'));
        if (!hasSchemaOrg) {
            return false;
        }
    } else {
        return false;
    }

    // Check that @type is a non-empty string
    if (typeof schema['@type'] !== 'string' || schema['@type'].trim() === '') {
        return false;
    }

    // Verify the object can be serialized to valid JSON
    try {
        JSON.stringify(data);
    } catch {
        return false;
    }

    return true;
}

/**
 * Sanitize structured data to prevent XSS attacks
 * Removes any potentially dangerous content from string values
 *
 * Requirements: 7.4
 * - Escapes special characters in JSON values
 * - Removes script tags
 * - Removes javascript: URLs
 * - Removes event handlers (onclick, onerror, etc.)
 * - Removes data: URLs that could contain scripts
 *
 * @param data - The structured data object to sanitize
 * @returns Sanitized copy of the data
 */
export function sanitizeStructuredData(data: object): object {
    // Deep clone to avoid mutating original
    const sanitized = JSON.parse(JSON.stringify(data));

    // Keep every expression bounded. Structured data can include authored
    // content, so patterns that scan until a distant closing tag can turn a
    // repeated, unmatched `<script ` sequence into quadratic work.
    const dangerousPatterns = [
        /<script\b/gi,
        /<\/script>/gi,
        /javascript\s*:/gi,
        /vbscript\s*:/gi,
        /data\s*:\s*text\/html/gi,
        /\bon\w+\s*=/gi,
        /expression\s*\(/gi,
        /&#x?[0-9a-f]+;?/gi,
    ];

    /**
     * Sanitize a single value recursively
     */
    const sanitizeValue = (value: unknown): unknown => {
        if (typeof value === 'string') {
            let sanitizedString = value.replace(/\s+/g, ' ').trim();

            // Apply all dangerous pattern removals
            for (const pattern of dangerousPatterns) {
                sanitizedString = sanitizedString.replace(pattern, '');
            }

            // If the string became empty after sanitization, return empty string
            // This prevents null/undefined issues
            return sanitizedString;
        }

        if (Array.isArray(value)) {
            return value.map(sanitizeValue);
        }

        if (typeof value === 'object' && value !== null) {
            return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitizeValue(v)]));
        }

        // Return primitives (numbers, booleans, null) as-is
        return value;
    };

    return sanitizeValue(sanitized) as object;
}

/**
 * Check if a string contains any XSS attack vectors
 * Useful for testing sanitization effectiveness
 *
 * @param str - The string to check
 * @returns true if the string contains potential XSS vectors
 */
export function containsXSSVectors(str: string): boolean {
    const xssPatterns = [
        /<script/i,
        /javascript\s*:/i,
        /vbscript\s*:/i,
        /data\s*:\s*text\/html/i,
        /\bon\w+\s*=/i,
        /expression\s*\(/i,
    ];

    return xssPatterns.some((pattern) => pattern.test(str));
}

/**
 * Combine multiple structured data objects
 * Filters out invalid schemas and removes duplicates by @type
 *
 * Requirements: 7.2
 * - Avoids duplicate or conflicting properties in the same document
 *
 * @param schemas - Array of structured data objects to combine
 * @returns Array of valid, unique schemas
 */
export function combineStructuredData(...schemas: object[]): object[] {
    const validSchemas = schemas.filter((schema) => validateStructuredData(schema));

    // Remove duplicates by @type (keep first occurrence)
    const seenTypes = new Set<string>();
    return validSchemas.filter((schema) => {
        const type = (schema as Record<string, unknown>)['@type'] as string;
        if (seenTypes.has(type)) {
            return false;
        }
        seenTypes.add(type);
        return true;
    });
}

/**
 * Serialize structured data to JSON-LD string
 * Ensures proper escaping for embedding in HTML
 *
 * @param data - The structured data object to serialize
 * @returns JSON string safe for embedding in script tags
 */
export function serializeStructuredData(data: object): string {
    // Validate before serializing
    if (!validateStructuredData(data)) {
        throw new Error('Invalid structured data: missing @context or @type');
    }

    // Sanitize before serializing
    const sanitized = sanitizeStructuredData(data);

    // In an HTML script element the HTML parser, not the JavaScript parser,
    // decides where the element ends. Escaping every less-than character keeps
    // even non-canonical closing tags such as `</script >` inert while
    // preserving valid JSON after parsing.
    return JSON.stringify(sanitized).replace(/</g, '\\u003c');
}
