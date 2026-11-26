import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BasicCompetitionUserResponse } from '@/lib/types';
import type { CompetitionOrganizerDataConsent } from '@/lib/competition-hosting';

const mocks = vi.hoisted(() => ({
    fetchApi: vi.fn(),
    push: vi.fn(),
    resetProgress: vi.fn(),
}));

vi.mock('next-intl', () => ({
    useTranslations: () => (key: string, values?: Record<string, string>) =>
        values?.organizer ? `${key} ${values.organizer}` : key,
}));

vi.mock('next/font/google', () => ({
    Onest: () => ({ className: '', variable: '' }),
    Unbounded: () => ({ className: '', variable: '' }),
}));

vi.mock('@/i18n/routing', () => ({
    Link: ({ href, children, ...props }: ComponentProps<'a'> & { children: ReactNode }) => (
        <a href={typeof href === 'string' ? href : '#'} {...props}>
            {children}
        </a>
    ),
    useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@/lib/api', () => ({ fetchApi: mocks.fetchApi }));
vi.mock('@/hooks/use-onboarding-progress', () => ({
    useOnboardingProgress: () => ({ resetProgress: mocks.resetProgress }),
}));

import { JoinCompetition } from '@/components/join-competition';

const competition: BasicCompetitionUserResponse = {
    id: 42,
    name: 'Community AI Cup',
    isPrivate: false,
    antiCheatEnabled: false,
    hasInstitution: true,
    joined: false,
};

const organizerDataConsent: CompetitionOrganizerDataConsent = {
    thirdPartyHosted: true,
    organizerDisplayName: 'Community Foundation',
    noticeVersion: '2026-07-22',
    joined: false,
    sharePersonalDataWithOrganizer: null,
    consentedAt: null,
    decisionUpdatedAt: null,
};

function joinRequestBody(): Record<string, unknown> {
    const init = mocks.fetchApi.mock.calls[0]?.[1] as RequestInit;
    return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe('competition join organizer consent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test';
        mocks.fetchApi.mockResolvedValue(new Response(null, { status: 200 }));
    });

    it('shows the invitation instructions for link-only competition registration', () => {
        render(
            <JoinCompetition
                competition={{ ...competition, isPrivate: true, inviteLinkOnly: true }}
            />,
        );
        expect(screen.getByText('inviteLinkRequired')).toBeVisible();
        expect(screen.queryByLabelText('password')).toBeNull();
        expect(screen.queryByRole('button', { name: 'submit' })).toBeNull();
    });

    it('allows joining while the optional sharing choice remains unchecked', async () => {
        render(
            <JoinCompetition
                competition={competition}
                organizerDataConsent={organizerDataConsent}
            />,
        );

        expect(screen.getByRole('checkbox')).not.toBeChecked();
        fireEvent.click(screen.getByRole('button', { name: 'submit' }));

        await waitFor(() => expect(mocks.fetchApi).toHaveBeenCalledTimes(1));
        expect(joinRequestBody()).toMatchObject({ sharePersonalDataWithOrganizer: false });
        expect(mocks.push).toHaveBeenCalledWith('/competitions/42');
    });

    it('transmits true only after an explicit opt-in', async () => {
        render(
            <JoinCompetition
                competition={competition}
                organizerDataConsent={organizerDataConsent}
            />,
        );

        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: 'submit' }));

        await waitFor(() => expect(mocks.fetchApi).toHaveBeenCalledTimes(1));
        expect(joinRequestBody()).toMatchObject({ sharePersonalDataWithOrganizer: true });
    });

    it('preserves an existing active sharing choice on a reused join page', () => {
        render(
            <JoinCompetition
                competition={{ ...competition, joined: true }}
                organizerDataConsent={{
                    ...organizerDataConsent,
                    joined: true,
                    sharePersonalDataWithOrganizer: true,
                }}
            />,
        );

        expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('omits a consent decision when the organizer notice could not be loaded', async () => {
        render(<JoinCompetition competition={competition} />);

        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'submit' }));

        await waitFor(() => expect(mocks.fetchApi).toHaveBeenCalledTimes(1));
        expect(joinRequestBody()).not.toHaveProperty('sharePersonalDataWithOrganizer');
    });
});
