// @vitest-environment node

import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/og/route';

import { generateCountryOgImageUrl } from './config';

describe('country Open Graph images', () => {
    it('builds a versioned country image URL with safely encoded parameters', () => {
        const imageUrl = new URL(generateCountryOgImageUrl('Côte d’Ivoire', ' ci '));

        expect(imageUrl.pathname).toBe('/api/og');
        expect(imageUrl.searchParams.get('type')).toBe('country');
        expect(imageUrl.searchParams.get('title')).toBe('Côte d’Ivoire');
        expect(imageUrl.searchParams.get('countryCode')).toBe('CI');
        expect(imageUrl.searchParams.get('v')).toBe('country-2');
    });

    it('returns an image response for a valid country code', async () => {
        const response = await GET(
            new NextRequest(
                'https://platform.olimpiada-ai.ro/api/og?type=country&title=Romania&countryCode=ro',
            ),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('image/png');
        expect(response.headers.get('cache-control')).toContain('s-maxage=604800');
    });

    it.each(['', 'R', 'ROU', 'R0', '<svg>'])(
        'rejects the invalid country code %j',
        async (countryCode) => {
            const requestUrl = new URL('https://platform.olimpiada-ai.ro/api/og');
            requestUrl.searchParams.set('type', 'country');
            requestUrl.searchParams.set('title', 'Country');
            requestUrl.searchParams.set('countryCode', countryCode);

            const response = await GET(new NextRequest(requestUrl));

            expect(response.status).toBe(400);
        },
    );
});
