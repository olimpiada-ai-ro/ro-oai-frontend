/**
 * Dynamic Open Graph image generator.
 *
 * All public variants share the theme-invariant ONIA-v2 notebook language so
 * social previews remain recognizable regardless of a viewer's saved theme.
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import type { ReactElement } from 'react';

import {
    generateArticleImage,
    generateCompetitionImage,
    generateCountryImage,
    generateCountyImage,
    generateGenericImage,
    generateHomeImage,
    generateInstitutionImage,
    generateProblemImage,
    generateProfileImage,
    type ArticleOgKind,
    type CompetitionStatus,
    type PlatformOgKind,
    type ProblemDifficulty,
} from '@/lib/seo/og/templates';
import { OG_FRAME } from '@/lib/seo/og/theme';
import { resolvePublicProfileAvatarDataUrl } from '@/lib/seo/og/profile-avatar';
import {
    normalizeCountryCode,
    normalizeIsoDate,
    normalizeOgText,
    parsePositiveInteger,
    parsePublicMetric,
} from '@/lib/seo/og/text';

// runtime: 'edge' is not compatible with Next.js 16 Cache Components.
// export const runtime = 'edge';

const CACHE_CONTROL = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000';

const PLATFORM_KINDS = new Set<PlatformOgKind>([
    'generic',
    'problems',
    'competitions',
    'articles',
    'leaderboard',
    'institutions',
    'countries',
    'roadmap',
    'achievements',
    'legal',
]);
const PROBLEM_DIFFICULTIES = new Set<ProblemDifficulty>(['Easy', 'Medium', 'Hard']);
const COMPETITION_STATUSES = new Set<CompetitionStatus>(['UPCOMING', 'ACTIVE', 'ENDED']);
const ARTICLE_KINDS = new Set<ArticleOgKind>(['ARTICLE', 'PROBLEM_EDITORIAL']);
const SUPPORTED_TYPES = new Set([
    'home',
    'generic',
    'problem',
    'competition',
    'article',
    'institution',
    'country',
    'county',
    'profile',
]);

function parsePlatformKind(value: string | null): PlatformOgKind {
    return value && PLATFORM_KINDS.has(value as PlatformOgKind)
        ? (value as PlatformOgKind)
        : 'generic';
}

function parseProblemDifficulty(value: string | null): ProblemDifficulty | null {
    if (!value) return null;
    const normalized = `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}`;
    return PROBLEM_DIFFICULTIES.has(normalized as ProblemDifficulty)
        ? (normalized as ProblemDifficulty)
        : null;
}

function parseCompetitionStatus(value: string | null): CompetitionStatus | null {
    const normalized = value?.trim().toUpperCase() ?? '';
    return COMPETITION_STATUSES.has(normalized as CompetitionStatus)
        ? (normalized as CompetitionStatus)
        : null;
}

function parseArticleKind(value: string | null): ArticleOgKind {
    const normalized = value?.trim().toUpperCase() ?? '';
    return ARTICLE_KINDS.has(normalized as ArticleOgKind)
        ? (normalized as ArticleOgKind)
        : 'ARTICLE';
}

function createImageResponse(imageElement: ReactElement) {
    return new ImageResponse(imageElement, {
        width: OG_FRAME.width,
        height: OG_FRAME.height,
        emoji: 'twemoji',
        headers: {
            'Cache-Control': CACHE_CONTROL,
            'X-Content-Type-Options': 'nosniff',
        },
    });
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;
        const type = searchParams.get('type') || 'home';

        if (!SUPPORTED_TYPES.has(type)) {
            return new Response('Unsupported image type', { status: 400 });
        }

        const title = normalizeOgText(searchParams.get('title'), 96, 'MLCompete');
        const subtitle = normalizeOgText(searchParams.get('subtitle'), 160) || undefined;
        const logoUrl = new URL('/logo.png', request.nextUrl.origin).toString();

        switch (type) {
            case 'home':
                return createImageResponse(generateHomeImage(title, subtitle, logoUrl));

            case 'generic':
                return createImageResponse(
                    generateGenericImage(
                        title,
                        subtitle,
                        parsePlatformKind(searchParams.get('kind')),
                        logoUrl,
                        normalizeCountryCode(searchParams.get('countryCode')),
                    ),
                );

            case 'problem': {
                const difficulty = parseProblemDifficulty(searchParams.get('difficulty'));
                if (!difficulty) {
                    return new Response('Missing or invalid difficulty parameter', {
                        status: 400,
                    });
                }

                return createImageResponse(
                    generateProblemImage(
                        title,
                        difficulty,
                        parsePositiveInteger(searchParams.get('problemId')),
                        logoUrl,
                        normalizeOgText(searchParams.get('authorLine'), 72) || undefined,
                    ),
                );
            }

            case 'competition': {
                const status = parseCompetitionStatus(searchParams.get('status'));
                const startDate = normalizeIsoDate(searchParams.get('startDate'));
                const endDate = normalizeIsoDate(searchParams.get('endDate'));
                if (
                    !status ||
                    !startDate ||
                    !endDate ||
                    Date.parse(endDate) < Date.parse(startDate)
                ) {
                    return new Response('Missing or invalid competition parameters', {
                        status: 400,
                    });
                }

                return createImageResponse(
                    generateCompetitionImage(
                        title,
                        status,
                        startDate,
                        endDate,
                        logoUrl,
                        normalizeOgText(searchParams.get('detailsLine'), 72) || undefined,
                    ),
                );
            }

            case 'article':
                return createImageResponse(
                    generateArticleImage(
                        title,
                        parseArticleKind(searchParams.get('articleKind')),
                        logoUrl,
                        {
                            excerpt: subtitle,
                            problemTitle:
                                normalizeOgText(searchParams.get('problemTitle'), 72) || undefined,
                            authorLine:
                                normalizeOgText(searchParams.get('authorLine'), 72) || undefined,
                        },
                    ),
                );

            case 'institution':
                return createImageResponse(
                    generateInstitutionImage(
                        title,
                        logoUrl,
                        normalizeCountryCode(searchParams.get('countryCode')),
                        normalizeOgText(searchParams.get('location'), 72) || undefined,
                    ),
                );

            case 'country': {
                const countryCode = normalizeCountryCode(searchParams.get('countryCode'));
                if (!countryCode) {
                    return new Response('Missing or invalid countryCode parameter', {
                        status: 400,
                    });
                }
                return createImageResponse(generateCountryImage(title, countryCode, logoUrl));
            }

            case 'county':
                return createImageResponse(
                    generateCountyImage(
                        title,
                        normalizeOgText(searchParams.get('countyCode'), 12) || undefined,
                        logoUrl,
                    ),
                );

            case 'profile': {
                const username = normalizeOgText(searchParams.get('username'), 64);
                if (!username) {
                    return new Response('Missing username parameter', { status: 400 });
                }
                const avatarDataUrl =
                    searchParams.get('avatar') === '1'
                        ? await resolvePublicProfileAvatarDataUrl(username)
                        : undefined;
                return createImageResponse(
                    generateProfileImage(
                        username,
                        {
                            rank: parsePositiveInteger(searchParams.get('rank')),
                            totalScore: parsePublicMetric(searchParams.get('totalScore')),
                            problemsSolved: parsePublicMetric(searchParams.get('problemsSolved'), {
                                integerOnly: true,
                            }),
                        },
                        normalizeCountryCode(searchParams.get('countryCode')),
                        logoUrl,
                        avatarDataUrl,
                    ),
                );
            }
        }
    } catch (error) {
        console.error('[OG Image] Generation failed:', error);
        return new Response('Failed to generate image', { status: 500 });
    }
}
