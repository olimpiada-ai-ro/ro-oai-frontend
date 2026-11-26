import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CountryOverview } from '@/lib/types';

const getMessagesMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/i18n-server', () => ({
    getMessages: getMessagesMock,
}));

import { generateCountryDetailMetadata } from './page-metadata';

const romaniaOverview: CountryOverview = {
    country: {
        code: 'RO',
        name: 'Romania',
        nameRo: 'România',
        flagEmoji: '🇷🇴',
    },
    statistics: {
        totalUsers: 42,
        totalInstitutions: 12,
        usersByType: {
            GIMNAZIU: 2,
            LICEU: 38,
            FACULTATE: 2,
        },
        institutionsByType: {
            GIMNAZIU: 1,
            LICEU: 10,
            FACULTATE: 1,
        },
        topInstitutions: [],
    },
    hasCountyBreakdown: true,
};

describe('country detail metadata', () => {
    beforeEach(() => {
        getMessagesMock.mockReset();
        getMessagesMock.mockResolvedValue({
            countries: { description: 'Explore countries on MLCompete.' },
            counties: { description: 'Browse Romanian counties and their institutions.' },
            institutions: { description: 'Browse schools and their competitors.' },
        });
    });

    it('uses the route locale and includes the same country card in Open Graph and Twitter', async () => {
        getMessagesMock.mockResolvedValue({
            countries: { description: 'Explorează țările din MLCompete.' },
            counties: { description: 'Explorează județele României și instituțiile lor.' },
            institutions: { description: 'Explorează instituțiile și concurenții lor.' },
        });

        const metadata = await generateCountryDetailMetadata('ro', 'ro', romaniaOverview);
        const openGraphImage = new URL(metadata.openGraph.images[0].url);
        const twitterImage = new URL(metadata.twitter.images[0]);

        expect(getMessagesMock).toHaveBeenCalledWith('ro');
        expect(metadata.title).toContain('România');
        expect(metadata.openGraph.description).toContain('județe');
        expect(openGraphImage.searchParams.get('type')).toBe('country');
        expect(openGraphImage.searchParams.get('title')).toBe('Romania');
        expect(openGraphImage.searchParams.get('countryCode')).toBe('RO');
        expect(twitterImage.toString()).toBe(openGraphImage.toString());
        expect(metadata.openGraph.url).toContain('/ro/countries/RO');
    });

    it('keeps a country-specific preview when the overview API is unavailable', async () => {
        const metadata = await generateCountryDetailMetadata('dz', 'en');
        const imageUrl = new URL(metadata.openGraph.images[0].url);

        expect(metadata.title).toContain('Algeria');
        expect(imageUrl.searchParams.get('type')).toBe('country');
        expect(imageUrl.searchParams.get('title')).toBe('Algeria');
        expect(imageUrl.searchParams.get('countryCode')).toBe('DZ');
        expect(metadata.openGraph.description).toBe('Browse schools and their competitors.');
    });
});
