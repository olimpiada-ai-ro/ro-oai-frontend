/**
 * Local verification helper for the ONIA-v2 Open Graph image system.
 *
 * Run with the application environment loaded:
 *   npx tsx scripts/verify-og-images.ts
 */

import {
    PLATFORM_OG_VERSION,
    generateArticleOgImageUrl,
    generateCompetitionOgImageUrl,
    generateCountryOgImageUrl,
    generateCountyOgImageUrl,
    generateGenericOgImageUrl,
    generateHomeOgImageUrl,
    generateInstitutionOgImageUrl,
    generateProblemOgImageUrl,
    generateProfileOgImageUrl,
    getFallbackOgImageUrl,
} from '@/lib/seo';

const dynamicImages = [
    {
        label: 'Homepage',
        expectedType: 'home',
        url: generateHomeOgImageUrl(),
    },
    {
        label: 'Problems collection',
        expectedType: 'generic',
        url: generateGenericOgImageUrl('Problems', 'Explore machine learning challenges', {
            kind: 'problems',
        }),
    },
    {
        label: 'Problem',
        expectedType: 'problem',
        url: generateProblemOgImageUrl('Predict House Prices', 'Medium', {
            problemId: 248,
            authorLine: 'By the MLCompete community',
        }),
    },
    {
        label: 'Competition',
        expectedType: 'competition',
        url: generateCompetitionOgImageUrl('IOAI 2026', 'UPCOMING', {
            start: '2026-08-02T08:00:00Z',
            end: '2026-08-08T17:00:00Z',
        }),
    },
    {
        label: 'Article',
        expectedType: 'article',
        url: generateArticleOgImageUrl('A practical validation guide', {
            kind: 'PROBLEM_EDITORIAL',
            problemTitle: 'Model Steering',
            authorLine: 'By Ana',
        }),
    },
    {
        label: 'Institution',
        expectedType: 'institution',
        url: generateInstitutionOgImageUrl('Colegiul Național de Informatică', {
            countryCode: 'RO',
            location: 'București, România',
        }),
    },
    {
        label: 'Country',
        expectedType: 'country',
        url: generateCountryOgImageUrl('Romania', 'RO'),
        expectedVersion: 'country-2',
    },
    {
        label: 'County',
        expectedType: 'county',
        url: generateCountyOgImageUrl('Cluj', 'CJ'),
    },
    {
        label: 'Profile',
        expectedType: 'profile',
        url: generateProfileOgImageUrl(
            'john_doe',
            { rank: 5, totalScore: 1250.5, problemsSolved: 15 },
            { countryCode: 'RO' },
        ),
        expectedVersion: 'profile-3',
    },
] as const;

let failed = false;

console.log('ONIA-v2 Open Graph image verification');
console.log('='.repeat(52));

for (const image of dynamicImages) {
    const url = new URL(image.url);
    const expectedVersion =
        'expectedVersion' in image ? image.expectedVersion : PLATFORM_OG_VERSION;
    const valid =
        url.pathname === '/api/og' &&
        url.searchParams.get('type') === image.expectedType &&
        url.searchParams.get('v') === expectedVersion;

    console.log(`${valid ? '✓' : '✗'} ${image.label}: ${url}`);
    failed ||= !valid;
}

const fallback = new URL(getFallbackOgImageUrl());
const validFallback = fallback.pathname === '/og-image-v2.png';
console.log(`${validFallback ? '✓' : '✗'} Static fallback: ${fallback}`);
failed ||= !validFallback;

if (failed) {
    process.exitCode = 1;
} else {
    console.log('\nAll URL contracts are valid.');
    console.log('Start `npm run dev`, then open any URL above for visual verification.');
}
