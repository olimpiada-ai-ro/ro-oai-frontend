import type { Metadata } from 'next';

import { getArticleAuthorName, type ArticleDetail } from '@/lib/articles';
import { getProfileUrl } from '@/lib/profile-utils';
import {
    BASE_URL,
    OG_IMAGE_DIMENSIONS,
    ORGANIZATION_CONFIG,
    SITE_CONFIG,
    SUPPORTED_LOCALES,
    TWITTER_DEFAULTS,
    generateArticleOgImageUrl,
    getOgLocale,
} from '@/lib/seo/config';
import type { Locale } from '@/lib/types';

export type CommunityArticleSeoLabels = {
    authorFallback: string;
    generalSection: string;
    editorialSection: string;
};

function compactText(value: string, maxLength: number): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;

    const available = normalized.slice(0, maxLength - 1).trimEnd();
    const lastWordBoundary = available.lastIndexOf(' ');
    const shortened =
        lastWordBoundary >= Math.floor(maxLength * 0.65)
            ? available.slice(0, lastWordBoundary)
            : available;
    return `${shortened.trimEnd()}…`;
}

function validIsoDate(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
}

function articleDates(article: ArticleDetail): { published?: string; modified?: string } {
    const published = validIsoDate(article.publishedAt) ?? validIsoDate(article.updatedAt);
    const updated = validIsoDate(article.updatedAt) ?? published;
    if (!published) return {};
    const safeModified =
        updated && Date.parse(updated) >= Date.parse(published) ? updated : published;

    return { published, modified: safeModified };
}

function articleSection(article: ArticleDetail, labels: CommunityArticleSeoLabels): string {
    return article.kind === 'PROBLEM_EDITORIAL' ? labels.editorialSection : labels.generalSection;
}

function absoluteAuthorUrl(article: ArticleDetail, locale: Locale, authorIndex: number): string {
    const author = article.authors[authorIndex];
    if (!author) return ORGANIZATION_CONFIG.url;
    return `${BASE_URL}/${locale}${getProfileUrl(author.userId, author.username)}`;
}

export function getCommunityArticleCanonicalUrl(article: ArticleDetail): string {
    return `${BASE_URL}/${article.language}/articles/${encodeURIComponent(article.slug)}`;
}

export function getCommunityArticleImageUrl(
    article: ArticleDetail,
    labels?: CommunityArticleSeoLabels,
): string {
    const authorLine = article.authors
        .map((author) => getArticleAuthorName(author, labels?.authorFallback || 'Author'))
        .join(', ');

    return generateArticleOgImageUrl(compactText(article.title, 90), {
        excerpt: compactText(article.excerpt, 180),
        kind: article.kind === 'PROBLEM_EDITORIAL' ? 'PROBLEM_EDITORIAL' : 'ARTICLE',
        problemTitle: article.problem?.title,
        authorLine: authorLine ? `By ${authorLine}` : undefined,
        revision: article.updatedAt || article.publishedAt || String(article.id),
    });
}

export function generateCommunityArticleMetadata(
    article: ArticleDetail,
    labels: CommunityArticleSeoLabels,
): Metadata {
    const canonical = getCommunityArticleCanonicalUrl(article);
    const image = getCommunityArticleImageUrl(article, labels);
    const title = compactText(article.title, 65);
    const description = compactText(article.excerpt, 160);
    const section = articleSection(article, labels);
    const { published, modified } = articleDates(article);
    const authorNames = article.authors.map((author) =>
        getArticleAuthorName(author, labels.authorFallback),
    );
    const authorUrls = article.authors.map((_, index) =>
        absoluteAuthorUrl(article, article.language, index),
    );

    return {
        title,
        description,
        authors: article.authors.map((_, index) => ({
            name: authorNames[index],
            url: authorUrls[index],
        })),
        creator: authorNames.join(', ') || ORGANIZATION_CONFIG.name,
        publisher: ORGANIZATION_CONFIG.name,
        category: section,
        alternates: {
            canonical,
            languages: {
                [article.language]: canonical,
                'x-default': canonical,
            },
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                'max-image-preview': 'large',
                'max-snippet': -1,
                'max-video-preview': -1,
            },
        },
        openGraph: {
            type: 'article',
            title,
            description,
            url: canonical,
            siteName: SITE_CONFIG.name,
            locale: getOgLocale(article.language),
            publishedTime: published,
            modifiedTime: modified,
            authors: authorUrls,
            section,
            tags: [
                section,
                'machine learning',
                'artificial intelligence',
                ...(article.problem ? [article.problem.title] : []),
            ],
            images: [
                {
                    url: image,
                    width: OG_IMAGE_DIMENSIONS.width,
                    height: OG_IMAGE_DIMENSIONS.height,
                    type: 'image/png',
                    alt: title,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [{ url: image, alt: title }],
            site: TWITTER_DEFAULTS.site,
            creator: TWITTER_DEFAULTS.creator,
        },
    };
}

export function generateCommunityArticleSchema(
    article: ArticleDetail,
    labels: CommunityArticleSeoLabels,
) {
    const canonical = getCommunityArticleCanonicalUrl(article);
    const image = getCommunityArticleImageUrl(article, labels);
    const section = articleSection(article, labels);
    const { published, modified } = articleDates(article);
    const authors = article.authors.map((author, index) => ({
        '@type': 'Person',
        name: getArticleAuthorName(author, labels.authorFallback),
        url: absoluteAuthorUrl(article, article.language, index),
    }));

    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        '@id': `${canonical}#article`,
        url: canonical,
        headline: article.title,
        description: article.excerpt,
        image: {
            '@type': 'ImageObject',
            url: image,
            width: OG_IMAGE_DIMENSIONS.width,
            height: OG_IMAGE_DIMENSIONS.height,
        },
        thumbnailUrl: image,
        ...(published ? { datePublished: published } : {}),
        ...(modified ? { dateModified: modified } : {}),
        inLanguage: article.language,
        isAccessibleForFree: true,
        articleSection: section,
        keywords: [
            section,
            'machine learning',
            'artificial intelligence',
            ...(article.problem ? [article.problem.title] : []),
        ],
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
        ...(authors.length > 0 ? { author: authors } : {}),
        publisher: {
            '@type': 'Organization',
            name: ORGANIZATION_CONFIG.name,
            url: ORGANIZATION_CONFIG.url,
            logo: {
                '@type': 'ImageObject',
                url: ORGANIZATION_CONFIG.logo,
                width: ORGANIZATION_CONFIG.logoWidth,
                height: ORGANIZATION_CONFIG.logoHeight,
            },
        },
        ...(article.problem
            ? {
                  about: {
                      '@type': 'LearningResource',
                      name: article.problem.title,
                      url: `${BASE_URL}/${article.language}/problems/${article.problem.id}`,
                  },
              }
            : {}),
    };
}

export function isCommunityArticleLanguage(value: string): value is Locale {
    return SUPPORTED_LOCALES.includes(value as Locale);
}
