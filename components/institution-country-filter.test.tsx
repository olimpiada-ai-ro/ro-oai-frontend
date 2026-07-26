import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
    fetchApi: vi.fn(),
    getCounties: vi.fn(),
    getCountries: vi.fn(),
    getInstitutions: vi.fn(),
    getMyMembershipRequests: vi.fn(),
}));
const routerReplaceMock = vi.hoisted(() => vi.fn());
let currentSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
    usePathname: () => '/en/institutions',
    useRouter: () => ({ replace: routerReplaceMock }),
    useSearchParams: () => currentSearchParams,
}));

vi.mock('next-auth/react', () => ({
    useSession: () => ({ data: null }),
}));

vi.mock('next/font/google', () => ({
    Onest: () => ({ className: 'platform-sans', variable: '--font-platform-sans' }),
    Unbounded: () => ({ className: 'platform-display', variable: '--font-platform-display' }),
}));

vi.mock('next-intl', () => ({
    useLocale: () => 'en',
    useTranslations: () => (key: string, values?: { count?: number }) =>
        key === 'institutions.resultsCount' ? `${values?.count ?? 0} institutions` : key,
}));

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/api', () => ({
    createMembershipRequest: vi.fn(),
    ...apiMocks,
}));

vi.mock('@/components/country-selector', () => ({
    CountrySelector: ({ value }: { value?: string | null }) => (
        <div data-testid="country-selector">{value ?? 'ALL'}</div>
    ),
}));

vi.mock('@/components/membership-request-dialog', () => ({
    MembershipRequestDialog: () => null,
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

import { InstitutionListView } from '@/components/institution-list-view';

describe('InstitutionListView country hierarchy', () => {
    beforeEach(() => {
        currentSearchParams = new URLSearchParams();
        routerReplaceMock.mockReset();
        Object.values(apiMocks).forEach((mock) => mock.mockReset());
        apiMocks.getCountries.mockResolvedValue([]);
        apiMocks.getCounties.mockResolvedValue([
            { id: 7, name: 'Cluj', code: 'CJ' },
            { id: 999, name: 'International', code: 'XX' },
        ]);
        apiMocks.getInstitutions.mockResolvedValue({
            content: [],
            totalElements: 0,
            totalPages: 0,
            size: 12,
            number: 0,
        });
        apiMocks.getMyMembershipRequests.mockResolvedValue([]);
    });

    afterEach(cleanup);

    it('filters a non-Romanian directory by country without exposing counties', async () => {
        currentSearchParams = new URLSearchParams('countryCode=DZ');
        render(<InstitutionListView />);

        await waitFor(() => expect(apiMocks.getInstitutions).toHaveBeenCalled());

        expect(screen.getByTestId('country-selector').textContent).toBe('DZ');
        expect(screen.queryByText('institutions.filterByCounty')).toBeNull();
        expect(apiMocks.getCounties).not.toHaveBeenCalled();
        expect(apiMocks.getInstitutions).toHaveBeenCalledWith(
            expect.objectContaining({
                countryCode: 'DZ',
                sort: 'country',
                direction: 'asc',
            }),
            0,
            12,
        );
    });

    it('treats legacy countyId-only links as Romania and excludes International', async () => {
        currentSearchParams = new URLSearchParams('countyId=7');
        render(<InstitutionListView />);

        await waitFor(() => expect(apiMocks.getCounties).toHaveBeenCalled());
        await waitFor(() =>
            expect(apiMocks.getInstitutions).toHaveBeenCalledWith(
                expect.objectContaining({
                    countryCode: 'RO',
                    countyId: 7,
                }),
                0,
                12,
            ),
        );

        expect(screen.getByTestId('country-selector').textContent).toBe('RO');
        expect(screen.getByText('institutions.filterByCounty')).toBeTruthy();
        expect(screen.queryByText('International')).toBeNull();
    });
});
