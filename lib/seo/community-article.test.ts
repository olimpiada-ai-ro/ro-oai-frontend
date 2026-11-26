import { describe, expect, it } from 'vitest';

import type { ArticleDetail } from '@/lib/articles';
import {
    generateCommunityArticleMetadata,
    generateCommunityArticleSchema,
    getCommunityArticleCanonicalUrl,
} from '@/lib/seo/community-article';
import { BASE_URL, OG_IMAGE_DIMENSIONS } from '@/lib/seo/config';

const labels = {
    authorFallback: 'Author',
    generalSection: 'Article',
    editorialSection: 'Problem editorial',
};

function article(overrides: Partial<ArticleDetail> = {}): ArticleDetail {
    return {
        id: 42,
        slug: 'grid-search-explained',
        language: 'ro',
        title: 'A'.repeat(80) + ' practical GridSearch explanation for competitors',
        excerpt:
            'A focused introduction that explains how to validate parameters, compare models, and avoid common evaluation mistakes. '.repeat(
                3,
            ),
        kind: 'PROBLEM_EDITORIAL',
        publicationStatus: 'PUBLISHED',
        publishedAt: '2026-07-10T08:00:00+03:00',
        updatedAt: '2026-07-14T11:30:00+03:00',
        authors: [
            {
                userId: 'user-1',
                username: 'pixel-testerson',
                displayName: 'Pixel Testerson',
            },
            {
                userId: 'user-2',
                username: 'second_author',
                displayName: 'Second Author',
            },
        ],
        problem: {
            id: 289,
            title: 'GridSearch',
            authors: [
                {
                    userId: 'user-1',
                    firstName: 'Pixel',
                    lastName: 'Testerson',
                    displayName: 'Pixel Testerson',
                },
            ],
        },
        sanitizedHtml: '<p>Article body</p>',
        ...overrides,
    };
}

describe('community article SEO', () => {
    it('builds compact, indexable metadata around the article content language', () => {
        const source = article();
        const metadata = generateCommunityArticleMetadata(source, labels);
        const canonical = getCommunityArticleCanonicalUrl(source);

        expect(canonical).toBe(`${BASE_URL}/ro/articles/grid-search-explained`);
        expect(String(metadata.title)).toHaveLength(65);
        expect(metadata.description?.length).toBeLessThanOrEqual(160);
        expect(metadata.alternates).toEqual({
            canonical,
            languages: { ro: canonical, 'x-default': canonical },
        });
        expect(metadata.robots).toMatchObject({
            index: true,
            follow: true,
            googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
        });
        expect(metadata.authors).toEqual([
            {
                name: 'Pixel Testerson',
                url: `${BASE_URL}/ro/profile/pixel-testerson`,
            },
            {
                name: 'Second Author',
                url: `${BASE_URL}/ro/profile/second_author`,
            },
        ]);

        expect(metadata.openGraph).toMatchObject({
            type: 'article',
            url: canonical,
            siteName: 'MLCompete',
            locale: 'ro_RO',
            publishedTime: '2026-07-10T05:00:00.000Z',
            modifiedTime: '2026-07-14T08:30:00.000Z',
            section: 'Problem editorial',
            authors: [
                `${BASE_URL}/ro/profile/pixel-testerson`,
                `${BASE_URL}/ro/profile/second_author`,
            ],
            images: [
                expect.objectContaining({
                    width: OG_IMAGE_DIMENSIONS.width,
                    height: OG_IMAGE_DIMENSIONS.height,
                    type: 'image/png',
                }),
            ],
        });
        expect(metadata.twitter).toMatchObject({
            card: 'summary_large_image',
            site: '@mlcompete',
            creator: '@mlcompete',
            images: [expect.objectContaining({ alt: metadata.title })],
        });
    });

    it('does not advertise untranslated locale variants', () => {
        const source = article({ language: 'en' });
        const metadata = generateCommunityArticleMetadata(source, labels);
        const canonical = getCommunityArticleCanonicalUrl(source);

        expect(canonical).toContain('/en/articles/');
        expect(metadata.alternates?.languages).toEqual({
            en: canonical,
            'x-default': canonical,
        });
        expect(metadata.openGraph).toMatchObject({ locale: 'en_US' });
    });

    it('emits Google Article fields that match the canonical and social image', () => {
        const source = article();
        const metadata = generateCommunityArticleMetadata(source, labels);
        const schema = generateCommunityArticleSchema(source, labels);
        const canonical = getCommunityArticleCanonicalUrl(source);
        const openGraphImage = Array.isArray(metadata.openGraph?.images)
            ? metadata.openGraph.images[0]
            : undefined;
        const imageUrl =
            typeof openGraphImage === 'object' && openGraphImage
                ? new URL(openGraphImage.url)
                : null;

        expect(imageUrl?.searchParams.get('type')).toBe('article');
        expect(imageUrl?.searchParams.get('articleKind')).toBe('PROBLEM_EDITORIAL');
        expect(imageUrl?.searchParams.get('problemTitle')).toBe(source.problem?.title);
        expect(imageUrl?.searchParams.get('v')).toBe('onia-og-2');

        expect(schema).toMatchObject({
            '@context': 'https://schema.org',
            '@type': 'Article',
            '@id': `${canonical}#article`,
            url: canonical,
            headline: source.title,
            description: source.excerpt,
            datePublished: '2026-07-10T05:00:00.000Z',
            dateModified: '2026-07-14T08:30:00.000Z',
            inLanguage: 'ro',
            isAccessibleForFree: true,
            articleSection: 'Problem editorial',
            mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
            image: {
                '@type': 'ImageObject',
                url:
                    typeof openGraphImage === 'object' && openGraphImage
                        ? openGraphImage.url
                        : undefined,
                width: 1200,
                height: 630,
            },
            author: [
                {
                    '@type': 'Person',
                    name: 'Pixel Testerson',
                    url: `${BASE_URL}/ro/profile/pixel-testerson`,
                },
                expect.objectContaining({ '@type': 'Person', name: 'Second Author' }),
            ],
            publisher: {
                '@type': 'Organization',
                name: 'Olimpiada de Inteligență Artificială',
                logo: expect.objectContaining({ width: 512, height: 512 }),
            },
            about: {
                '@type': 'LearningResource',
                name: 'GridSearch',
                url: `${BASE_URL}/ro/problems/289`,
            },
        });
    });

    it('never reports a modification before publication during a mixed-version rollout', () => {
        const source = article({
            publishedAt: '2026-07-15T10:00:00Z',
            updatedAt: '2026-07-14T10:00:00Z',
        });

        expect(generateCommunityArticleSchema(source, labels)).toMatchObject({
            datePublished: '2026-07-15T10:00:00.000Z',
            dateModified: '2026-07-15T10:00:00.000Z',
        });
    });
});
