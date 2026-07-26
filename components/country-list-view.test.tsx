import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getCountryOverviewsMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
    getCountryOverviews: getCountryOverviewsMock,
}));

vi.mock('next/font/google', () => ({
    Onest: () => ({ className: 'platform-sans', variable: '--font-platform-sans' }),
    Unbounded: () => ({ className: 'platform-display', variable: '--font-platform-display' }),
}));

vi.mock('next-intl', () => ({
    useLocale: () => 'en',
    useTranslations: () => (key: string, values?: { count?: number }) =>
        ({
            'common.error': 'Error',
            'common.loading': 'Loading',
            'common.retry': 'Retry',
            'counties.noResultsDescription': 'Try another search',
            'counties.totalInstitutions': 'Institutions',
            'counties.totalUsers': 'Members',
            'settings.errorLoadingCountries': 'Could not load countries',
            'settings.noCountryFound': 'No country found',
            'settings.searchCountries': 'Search countries',
        })[key] ?? (key === 'rankings.resultsCount' ? `${values?.count ?? 0} results` : key),
}));

vi.mock('@/i18n/routing', async () => {
    const React = await import('react');
    return {
        Link: React.forwardRef<
            HTMLAnchorElement,
            React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
        >(({ href, ...props }, ref) => <a ref={ref} href={href} {...props} />),
    };
});

import { CountryListView } from '@/components/country-list-view';

const countryOverviews = [
    {
        country: {
            code: 'RO',
            name: 'Romania',
            nameRo: 'România',
            flagEmoji: '🇷🇴',
        },
        statistics: {
            totalUsers: 30,
            totalInstitutions: 12,
            usersByType: {},
            institutionsByType: {},
            topInstitutions: [],
        },
        hasCountyBreakdown: true,
    },
    {
        country: {
            code: 'DZ',
            name: 'Algeria',
            nameRo: 'Algeria',
            flagEmoji: '🇩🇿',
        },
        statistics: {
            totalUsers: 8,
            totalInstitutions: 30,
            usersByType: {},
            institutionsByType: {},
            topInstitutions: [],
        },
        hasCountyBreakdown: false,
    },
];

describe('CountryListView', () => {
    beforeEach(() => {
        getCountryOverviewsMock.mockReset();
        getCountryOverviewsMock.mockResolvedValue(countryOverviews);
    });

    afterEach(cleanup);

    it('sorts localized country rows and links to canonical country pages', async () => {
        render(<CountryListView />);

        const algeria = await screen.findByRole('link', { name: /Algeria/i });
        const romania = screen.getByRole('link', { name: /Romania/i });
        const links = screen.getAllByRole('link');

        expect(links.indexOf(algeria)).toBeLessThan(links.indexOf(romania));
        expect(algeria.getAttribute('href')).toBe('/countries/DZ');
        expect(romania.getAttribute('href')).toBe('/countries/RO');
    });

    it('filters by localized country name without changing the directory structure', async () => {
        const user = userEvent.setup();
        render(<CountryListView />);
        await screen.findByRole('link', { name: /Algeria/i });

        await user.type(screen.getByLabelText('Search countries'), 'rom');

        await waitFor(() => {
            expect(screen.queryByRole('link', { name: /Algeria/i })).toBeNull();
        });
        expect(screen.getByRole('link', { name: /Romania/i })).toBeTruthy();
    });
});
