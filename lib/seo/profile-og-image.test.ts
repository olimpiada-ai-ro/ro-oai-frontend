// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolvePublicProfileAvatarDataUrlMock = vi.hoisted(() => vi.fn());
const ONE_PIXEL_PNG_DATA_URL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

vi.mock('@/lib/seo/og/profile-avatar', () => ({
    resolvePublicProfileAvatarDataUrl: resolvePublicProfileAvatarDataUrlMock,
}));

import { GET } from '@/app/api/og/route';

import { generateProfileOgImageUrl } from './config';

describe('profile Open Graph images', () => {
    beforeEach(() => {
        resolvePublicProfileAvatarDataUrlMock.mockReset();
        resolvePublicProfileAvatarDataUrlMock.mockResolvedValue(undefined);
    });

    it('builds a versioned profile image URL with country and valid statistics', () => {
        const imageUrl = new URL(
            generateProfileOgImageUrl(
                'ana.popescu',
                {
                    rank: 7,
                    totalScore: 86.25,
                    problemsSolved: 14,
                },
                { countryCode: ' ro ', hasAvatar: true },
            ),
        );

        expect(imageUrl.pathname).toBe('/api/og');
        expect(imageUrl.searchParams.get('type')).toBe('profile');
        expect(imageUrl.searchParams.get('username')).toBe('ana.popescu');
        expect(imageUrl.searchParams.get('rank')).toBe('7');
        expect(imageUrl.searchParams.get('totalScore')).toBe('86.25');
        expect(imageUrl.searchParams.get('problemsSolved')).toBe('14');
        expect(imageUrl.searchParams.get('countryCode')).toBe('RO');
        expect(imageUrl.searchParams.get('avatar')).toBe('1');
        expect(imageUrl.searchParams.get('v')).toBe('profile-3');
        expect(imageUrl.searchParams.has('avatarUrl')).toBe(false);
        expect(imageUrl.toString()).not.toContain('X-Amz');
    });

    it('omits invalid statistics and country codes from generated URLs', () => {
        const imageUrl = new URL(
            generateProfileOgImageUrl(
                'competitor',
                {
                    rank: 1_000_000_001,
                    totalScore: Number.NaN,
                    problemsSolved: 1_000_000_001,
                },
                { countryCode: 'ROU' },
            ),
        );

        expect(imageUrl.searchParams.has('rank')).toBe(false);
        expect(imageUrl.searchParams.has('totalScore')).toBe(false);
        expect(imageUrl.searchParams.has('problemsSolved')).toBe(false);
        expect(imageUrl.searchParams.has('countryCode')).toBe(false);
        expect(imageUrl.searchParams.has('avatar')).toBe(false);
    });

    it('returns a cached PNG response with a country flag', async () => {
        const response = await GET(
            new NextRequest(
                'https://platform.olimpiada-ai.ro/api/og?type=profile&username=ana.popescu&rank=7&totalScore=86.25&problemsSolved=14&countryCode=ro',
            ),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('image/png');
        expect(response.headers.get('cache-control')).toContain('s-maxage=604800');
    });

    it('resolves a configured avatar by public profile identity without accepting an image URL', async () => {
        resolvePublicProfileAvatarDataUrlMock.mockResolvedValue(ONE_PIXEL_PNG_DATA_URL);

        const avatarResponse = await GET(
            new NextRequest(
                'https://platform.olimpiada-ai.ro/api/og?type=profile&username=ana.popescu&avatar=1',
            ),
        );
        const avatarImage = Buffer.from(await avatarResponse.arrayBuffer());
        const fallbackResponse = await GET(
            new NextRequest(
                'https://platform.olimpiada-ai.ro/api/og?type=profile&username=ana.popescu',
            ),
        );
        const fallbackImage = Buffer.from(await fallbackResponse.arrayBuffer());

        expect(avatarResponse.status).toBe(200);
        expect(Array.from(avatarImage.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
        expect(avatarImage.equals(fallbackImage)).toBe(false);
        expect(resolvePublicProfileAvatarDataUrlMock).toHaveBeenCalledOnce();
        expect(resolvePublicProfileAvatarDataUrlMock).toHaveBeenCalledWith('ana.popescu');
    });

    it('does not resolve an avatar for legacy or avatar-free profile cards', async () => {
        const response = await GET(
            new NextRequest(
                'https://platform.olimpiada-ai.ro/api/og?type=profile&username=competitor&avatarUrl=https%3A%2F%2Fevil.example%2Fimage.png',
            ),
        );

        expect(response.status).toBe(200);
        expect(resolvePublicProfileAvatarDataUrlMock).not.toHaveBeenCalled();
    });

    it('keeps legacy and malformed optional parameters safe', async () => {
        const legacyResponse = await GET(
            new NextRequest(
                'https://platform.olimpiada-ai.ro/api/og?type=profile&username=competitor',
            ),
        );
        const malformedResponse = await GET(
            new NextRequest(
                'https://platform.olimpiada-ai.ro/api/og?type=profile&username=competitor&rank=-4&totalScore=NaN&problemsSolved=3.5&countryCode=ROU',
            ),
        );

        expect(legacyResponse.status).toBe(200);
        expect(malformedResponse.status).toBe(200);
    });

    it('requires a non-empty username', async () => {
        const missingUsername = await GET(
            new NextRequest('https://platform.olimpiada-ai.ro/api/og?type=profile'),
        );
        const whitespaceUsername = await GET(
            new NextRequest(
                'https://platform.olimpiada-ai.ro/api/og?type=profile&username=%20%20%20',
            ),
        );

        expect(missingUsername.status).toBe(400);
        expect(whitespaceUsername.status).toBe(400);
    });
});
