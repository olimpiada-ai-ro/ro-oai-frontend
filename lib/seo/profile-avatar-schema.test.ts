import { describe, expect, it } from 'vitest';

import { BASE_URL } from '@/lib/seo/config';
import { generateItemListSchema, generatePersonSchema } from '@/lib/seo/structured-data';
import type { GenericLeaderboardEntry, UserProfile } from '@/lib/types';

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
    return {
        userId: 'user-1',
        username: 'mark_twain',
        firstName: 'Mark',
        lastName: 'Twain',
        email: null,
        joinedAt: new Date('2026-01-01T00:00:00Z'),
        avatar: null,
        bio: null,
        location: null,
        website: null,
        github: null,
        totalScore: 100,
        problemsSolved: 4,
        averageScore: 25,
        rank: 3,
        leaderboardPlaced: true,
        ...overrides,
    };
}

describe('profile avatar structured data', () => {
    it('uses the public full name while preserving the username as an alternate name', () => {
        const schema = generatePersonSchema(profile(), 'ro');

        expect(schema.name).toBe('Mark Twain');
        expect(schema.alternateName).toBe('mark_twain');
        expect(schema.url).toBe(`${BASE_URL}/ro/profile/mark_twain`);
        expect(schema.image).toBeUndefined();
    });

    it('omits generic placeholders and expiring signed avatar URLs', () => {
        expect(
            generatePersonSchema(profile({ avatar: '/placeholder.svg' }), 'en').image,
        ).toBeUndefined();
        expect(
            generatePersonSchema(
                profile({
                    avatar: 'https://storage.example/avatar.png?X-Amz-Signature=temporary&X-Amz-Expires=900',
                }),
                'en',
            ).image,
        ).toBeUndefined();
    });

    it('publishes a stable absolute avatar URL when one exists', () => {
        const schema = generatePersonSchema(profile({ avatar: '/avatars/user-1.webp' }), 'en');

        expect(schema.image).toBe(`${BASE_URL}/avatars/user-1.webp`);
    });

    it('bounds legacy biographies in Person structured data', () => {
        const schema = generatePersonSchema(profile({ bio: 'a'.repeat(50_000) }), 'en');

        expect(schema.description).toHaveLength(500);
    });

    it('does not advertise a generic image for leaderboard entries without photos', () => {
        const entries: GenericLeaderboardEntry[] = [
            {
                rank: 1,
                userId: 'user-1',
                username: 'mark_twain',
                avatar: null,
                totalScore: 100,
            },
        ];

        const schema = generateItemListSchema(entries, 'ro') as {
            itemListElement: Array<{ item: { image?: string; url: string } }>;
        };

        expect(schema.itemListElement[0].item.image).toBeUndefined();
        expect(schema.itemListElement[0].item.url).toBe(`${BASE_URL}/ro/profile/mark_twain`);
    });
});
