import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    redeemStoredCompetitionInvitation: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
}));

vi.mock('next-intl', () => ({
    useTranslations: () => (key: string, values?: Record<string, string>) =>
        values?.organizer ? `${key} ${values.organizer}` : key,
}));

vi.mock('@/i18n/routing', () => ({
    Link: ({ href, children, ...props }: ComponentProps<'a'> & { children: ReactNode }) => (
        <a href={typeof href === 'string' ? href : '#'} {...props}>
            {children}
        </a>
    ),
    useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

vi.mock('@/lib/competition-hosting', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/competition-hosting')>()),
    redeemStoredCompetitionInvitation: mocks.redeemStoredCompetitionInvitation,
}));

import { CompetitionInvitation } from '@/components/competition-hosting/competition-invitation';

describe('competition invitation consent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.redeemStoredCompetitionInvitation.mockResolvedValue({ competitionId: 42 });
    });

    it('requires a separate unchecked choice and forwards an explicit opt-in', async () => {
        render(
            <CompetitionInvitation
                invitationHandle="safe-handle"
                locale="en"
                authenticated
                invitation={{
                    valid: true,
                    thirdPartyHosted: true,
                    status: 'PENDING',
                    maskedEmail: 'a***@example.org',
                    competition: { id: 42, name: 'Community AI Cup' },
                    organizerName: 'Community Foundation',
                    expiresAt: '2026-08-01T10:00:00Z',
                    message: null,
                    consentNoticeVersion: '2026-07-22',
                }}
            />,
        );

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();
        fireEvent.click(checkbox);
        fireEvent.click(screen.getByRole('button', { name: 'accept' }));

        await waitFor(() =>
            expect(mocks.redeemStoredCompetitionInvitation).toHaveBeenCalledWith(
                'safe-handle',
                true,
                undefined,
            ),
        );
        expect(mocks.replace).toHaveBeenCalledWith('/competitions/42');
    });

    it('collects only the configured fields when redeeming a shared competition link', async () => {
        render(
            <CompetitionInvitation
                invitationHandle="safe-handle"
                locale="ro"
                authenticated
                invitation={{
                    sharedLink: true,
                    requiredFields: ['firstName', 'phone'],
                    validGrades: [],
                    valid: true,
                    thirdPartyHosted: false,
                    status: 'PENDING',
                    maskedEmail: null,
                    competition: { id: 42, name: 'Junior AI' },
                    organizerName: null,
                    expiresAt: null,
                    message: null,
                    consentNoticeVersion: null,
                }}
            />,
        );
        expect(screen.queryByRole('textbox', { name: 'fields.grade' })).toBeNull();
        fireEvent.change(screen.getByLabelText('fields.firstName'), { target: { value: 'Ana' } });
        fireEvent.change(screen.getByLabelText('fields.phone'), {
            target: { value: '0700000000' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'accept' }));
        await waitFor(() =>
            expect(mocks.redeemStoredCompetitionInvitation).toHaveBeenCalledWith(
                'safe-handle',
                undefined,
                { firstName: 'Ana', phone: '0700000000' },
            ),
        );
        expect(mocks.replace).toHaveBeenCalledWith('/competitions/42');
    });

    it('explains third-party sharing before an invited user signs in', () => {
        render(
            <CompetitionInvitation
                invitationHandle="safe-handle"
                locale="en"
                authenticated={false}
                invitation={{
                    valid: true,
                    thirdPartyHosted: true,
                    status: 'PENDING',
                    maskedEmail: null,
                    competition: { id: 42, name: 'Community AI Cup' },
                    organizerName: 'Community Foundation',
                    expiresAt: null,
                    message: null,
                    consentNoticeVersion: '2026-07-22',
                }}
            />,
        );

        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        expect(screen.getByText('thirdPartyExplanation Community Foundation')).toBeVisible();
        expect(screen.getByRole('link', { name: /signIn/ })).toHaveAttribute(
            'href',
            '/login?callbackUrl=%2Fen%2Fcompetition-invitations%2Fcontinue%2Fsafe-handle',
        );
    });
});
