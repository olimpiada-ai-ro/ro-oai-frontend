/**
 * SEO Module
 *
 * Central export point for all SEO utilities
 */

// Configuration
export {
    SITE_CONFIG,
    ORGANIZATION_CONFIG,
    DEFAULT_METADATA,
    OG_DEFAULTS,
    TWITTER_DEFAULTS,
    ROBOTS_CONFIG,
    SITEMAP_CONFIG,
    SEO_LIMITS,
    BASE_URL,
    ENVIRONMENT,
    SUPPORTED_LOCALES,
    DEFAULT_LOCALE,
    PLATFORM_OG_VERSION,
    OG_IMAGE_DIMENSIONS,
    getFullUrl,
    isTitleValid,
    isDescriptionValid,
    truncateText,
    ensureTitleLength,
    ensureDescriptionLength,
    getLocalizedUrl,
    isProduction,
    isDevelopment,
    generateHomeOgImageUrl,
    generateProblemOgImageUrl,
    generateProfileOgImageUrl,
    generateGenericOgImageUrl,
    generatePlatformOgImageUrl,
    generateArticleOgImageUrl,
    generateInstitutionOgImageUrl,
    generateCountyOgImageUrl,
    generateCountryOgImageUrl,
    generateCompetitionOgImageUrl,
    getFallbackOgImageUrl,
} from './config';

export type { PlatformOgKind } from './config';

// Metadata Generation
export { generateMetadata, validateMetadataConfig, mergeMetadataConfig } from './metadata';

// Page-Specific Metadata
export {
    generateHomeMetadata,
    generateProblemMetadata,
    generateProfileMetadata,
    generateLeaderboardMetadata,
    generateProblemsListMetadata,
} from './page-metadata';

// Canonical URLs and Hreflang
export {
    generateCanonicalUrl,
    getCanonicalUrl,
    generateHreflangTags,
    getHreflangTags,
    generateAlternateLanguages,
    isValidUrl,
    extractPath,
    isAbsoluteUrl,
    toAbsoluteUrl,
    getLocaleFromPath,
    removeLocaleFromPath,
} from './canonical';

// Structured Data (JSON-LD)
export {
    generateOrganizationSchema,
    generateWebSiteSchema,
    generateProblemSchema,
    generatePersonSchema,
    generateItemListSchema,
    generateBreadcrumbSchema,
    generateStructuredData,
    validateStructuredData,
    sanitizeStructuredData,
    combineStructuredData,
} from './structured-data';

// Sitemap Generation
export {
    generateSitemap,
    generateStaticPagesSitemap,
    generateProblemsSitemap,
    generateProfilesSitemap,
} from './sitemap';

// Robots.txt Configuration
export {
    generateRobotsConfig,
    isPathDisallowed,
    getRobotsMetaTag,
    formatRobotsTxt,
    validateRobotsConfig,
} from './robots';

// Types
export type {
    SiteConfig,
    MetadataConfig,
    OpenGraphMetadata,
    TwitterMetadata,
    PageMetadata,
    PageSEO,
    StructuredDataType,
    StructuredDataProps,
    OrganizationSchema,
    WebSiteSchema,
    PersonSchema,
    BreadcrumbItem,
    BreadcrumbSchema,
    EventSchema,
    EventStatusType,
    ArticleSchema,
    QuizSchema,
    QuestionSchema,
    ImageObjectSchema,
    SitemapEntry,
    SitemapConfig,
    RobotsRule,
    RobotsConfig,
    CanonicalUrlConfig,
    HreflangTag,
    HreflangConfig,
} from './types';

// Export SupportedLocale type from config
export type { SupportedLocale } from './config';
