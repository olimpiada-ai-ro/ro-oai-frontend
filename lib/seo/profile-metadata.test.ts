import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMessagesMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/i18n-server', () => ({
    getMessages: getMessagesMock,
}));

import { generateProfileMetadata } from './page-metadata';

const placedProfile = {
    username: 'ana.popescu',
    avatar: 'https://storage.example/avatars/ana?X-Amz-Signature=secret',
    firstName: null,
    lastName: null,
    bio: null,
    totalScore: 86.25,
    problemsSolved: 14,
    averageScore: 74.5,
    rank: 7,
    leaderboardPlaced: true,
};

describe('profile metadata', () => {
    beforeEach(() => {
        getMessagesMock.mockReset();
        getMessagesMock.mockResolvedValue({
            profile: {
                title: 'Profile',
                problemsSolved: 'Problems solved',
                averageScore: 'Average score',
                rank: 'Rank',
            },
        });
    });

    it('uses one country-aware image for Open Graph and Twitter', async () => {
        const metadata = await generateProfileMetadata(placedProfile, 'en', {
            countryCode: 'ro',
        });
        const openGraphImage = new URL(metadata.openGraph.images[0].url);
        const twitterImage = new URL(metadata.twitter.images[0]);

        expect(getMessagesMock).toHaveBeenCalledWith('en');
        expect(openGraphImage.searchParams.get('type')).toBe('profile');
        expect(openGraphImage.searchParams.get('username')).toBe('ana.popescu');
        expect(openGraphImage.searchParams.get('countryCode')).toBe('RO');
        expect(openGraphImage.searchParams.get('rank')).toBe('7');
        expect(openGraphImage.searchParams.get('totalScore')).toBe('86.25');
        expect(openGraphImage.searchParams.get('problemsSolved')).toBe('14');
        expect(openGraphImage.searchParams.get('avatar')).toBe('1');
        expect(openGraphImage.searchParams.get('v')).toBe('profile-3');
        expect(openGraphImage.toString()).not.toContain('storage.example');
        expect(openGraphImage.toString()).not.toContain('X-Amz');
        expect(openGraphImage.toString()).not.toContain('secret');
        expect(twitterImage.toString()).toBe(openGraphImage.toString());
        expect(metadata.openGraph.url).toContain('/en/profile/anapopescu');
    });

    it('does not expose placeholder statistics or invent a country for unranked users', async () => {
        const metadata = await generateProfileMetadata(
            {
                ...placedProfile,
                leaderboardPlaced: false,
                avatar: '/placeholder.svg',
                rank: 0,
                totalScore: 0,
                problemsSolved: 0,
                averageScore: 0,
            },
            'en',
        );
        const imageUrl = new URL(metadata.openGraph.images[0].url);

        expect(imageUrl.searchParams.has('rank')).toBe(false);
        expect(imageUrl.searchParams.has('totalScore')).toBe(false);
        expect(imageUrl.searchParams.has('problemsSolved')).toBe(false);
        expect(imageUrl.searchParams.has('countryCode')).toBe(false);
        expect(imageUrl.searchParams.has('avatar')).toBe(false);
        expect(metadata.description).not.toContain('#0');
    });

    it('preserves the profile image if localized messages fail to load', async () => {
        getMessagesMock.mockRejectedValue(new Error('translations unavailable'));
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            const metadata = await generateProfileMetadata(placedProfile, 'en', {
                countryCode: 'DZ',
            });
            const imageUrl = new URL(metadata.openGraph.images[0].url);

            expect(imageUrl.searchParams.get('type')).toBe('profile');
            expect(imageUrl.searchParams.get('countryCode')).toBe('DZ');
            expect(metadata.openGraph.url).toContain('/en/profile/anapopescu');
        } finally {
            consoleError.mockRestore();
        }
    });
});
