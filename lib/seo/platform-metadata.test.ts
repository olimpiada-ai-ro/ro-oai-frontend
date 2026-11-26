import { describe, expect, it } from 'vitest';

import {
    generateAchievementsMetadata,
    generateCompetitionMetadata,
    generateCompetitionsListMetadata,
    generateCountriesMetadata,
    generateHomeMetadata,
    generateInstitutionsMetadata,
    generateLeaderboardMetadata,
    generateMyQuestionsMetadata,
    generateMyRequestsMetadata,
    generatePrivacyMetadata,
    generateProblemMetadata,
    generateProblemsListMetadata,
    generateTermsMetadata,
} from './page-metadata';

function socialImageUrls(metadata: Awaited<ReturnType<typeof generateHomeMetadata>>) {
    return {
        openGraph: new URL(metadata.openGraph.images[0].url),
        twitter: new URL(metadata.twitter.images[0]),
    };
}

describe('platform metadata Open Graph coverage', () => {
    it.each([
        ['home', generateHomeMetadata, 'home', null],
        ['problems', generateProblemsListMetadata, 'generic', 'problems'],
        ['competitions', generateCompetitionsListMetadata, 'generic', 'competitions'],
        ['leaderboard', generateLeaderboardMetadata, 'generic', 'leaderboard'],
        ['institutions', generateInstitutionsMetadata, 'generic', 'institutions'],
        ['countries', generateCountriesMetadata, 'generic', 'countries'],
        ['achievements', generateAchievementsMetadata, 'generic', 'achievements'],
        ['privacy', generatePrivacyMetadata, 'generic', 'legal'],
        ['terms', generateTermsMetadata, 'generic', 'legal'],
    ] as const)(
        'uses the ONIA-v2 %s card for Open Graph and Twitter',
        async (_label, generator, expectedType, expectedKind) => {
            const metadata = await generator('en');
            const images = socialImageUrls(metadata);

            expect(images.openGraph.toString()).toBe(images.twitter.toString());
            expect(images.openGraph.pathname).toBe('/api/og');
            expect(images.openGraph.searchParams.get('type')).toBe(expectedType);
            expect(images.openGraph.searchParams.get('kind')).toBe(expectedKind);
            expect(images.openGraph.searchParams.get('v')).toBe('onia-og-2');
        },
    );

    it('includes public problem identity and preserves one social image URL', async () => {
        const metadata = await generateProblemMetadata(
            {
                id: 248,
                title: 'Model Steering',
                shortDescription: 'Train a robust steering model.',
                difficulty: 'Hard',
                author: 'IOAI Scientific Committee',
            },
            'en',
        );
        const images = socialImageUrls(metadata);

        expect(images.openGraph.toString()).toBe(images.twitter.toString());
        expect(images.openGraph.searchParams.get('type')).toBe('problem');
        expect(images.openGraph.searchParams.get('problemId')).toBe('248');
        expect(images.openGraph.searchParams.get('difficulty')).toBe('Hard');
        expect(images.openGraph.searchParams.get('v')).toBe('onia-og-2');
    });

    it('uses the competition timeline image for metadata', async () => {
        const metadata = await generateCompetitionMetadata(
            {
                id: 26,
                name: 'IOAI 2026',
                description: 'International Olympiad in Artificial Intelligence preparation.',
                startTime: '2026-08-02T08:00:00Z',
                endTime: '2026-08-08T17:00:00Z',
                problemCount: 6,
            },
            'en',
        );
        const images = socialImageUrls(metadata);

        expect(images.openGraph.toString()).toBe(images.twitter.toString());
        expect(images.openGraph.searchParams.get('type')).toBe('competition');
        expect(images.openGraph.searchParams.get('startDate')).toBe('2026-08-02T08:00:00Z');
        expect(images.openGraph.searchParams.get('endDate')).toBe('2026-08-08T17:00:00Z');
        expect(images.openGraph.searchParams.get('v')).toBe('onia-og-2');
    });

    it.each([generateMyRequestsMetadata, generateMyQuestionsMetadata])(
        'keeps authenticated utility pages out of indexing and uses the static fallback',
        async (generator) => {
            const metadata = await generator('en');
            const images = socialImageUrls(metadata);

            expect(metadata.robots).toMatchObject({ index: false, follow: false });
            expect(images.openGraph.pathname).toBe('/og-image-v2.png');
            expect(images.openGraph.toString()).toBe(images.twitter.toString());
        },
    );
});
