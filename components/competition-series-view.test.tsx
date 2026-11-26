import { cleanup, render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({
    Onest: () => ({ className: 'platform-sans', variable: '--font-platform-sans' }),
    Unbounded: () => ({ className: 'platform-display', variable: '--font-platform-display' }),
}));

vi.mock('@/i18n/routing', () => ({
    Link: ({
        href,
        children,
        ...props
    }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
        href: string | { pathname: string; query?: Record<string, string> };
        children: ReactNode;
    }) => {
        const path =
            typeof href === 'string'
                ? href
                : `${href.pathname}${
                      href.query ? `?${new URLSearchParams(href.query).toString()}` : ''
                  }`;
        return (
            <a href={path} {...props}>
                {children}
            </a>
        );
    },
}));

import {
    CompetitionSeriesView,
    type CompetitionSeriesMessages,
} from '@/components/competition-series-view';
import type {
    CompetitionSeriesDetail,
    CompetitionSeriesLeaderboard,
} from '@/lib/competition-series/types';

const messages: CompetitionSeriesMessages = {
    eyebrow: 'Competition series',
    modes: { multiRound: 'Multi-round', divisions: 'Divisions' },
    tabs: { overview: 'Overview', children: 'Rounds', combined: 'Combined' },
    period: 'Period',
    periodHint: 'Calculated automatically from every round.',
    starts: 'Starts',
    ends: 'Ends',
    events: (count) => `${count} events`,
    problems: (count) => `${count} problems`,
    roundLabel: (number) => `Round ${number}`,
    divisionLabel: (number) => `Division ${number}`,
    childrenTitle: 'Events',
    childrenMultiRoundDescription: 'Complete each round.',
    childrenDivisionsDescription: 'Choose your division.',
    viewCompetition: 'View competition',
    viewLeaderboard: 'View leaderboard',
    combinedTitle: 'Combined leaderboard',
    combinedDescription: 'Cumulative results.',
    childLeaderboardsTitle: 'Event leaderboards',
    childLeaderboardsDescription: 'Results by event.',
    rank: 'Rank',
    participant: 'Participant',
    total: 'Total',
    roundTotals: 'Round totals',
    problemScores: 'Problem scores',
    noResults: 'No results yet',
    unavailable: 'Unavailable',
};

const baseSeries: CompetitionSeriesDetail = {
    id: 8,
    name: 'National League',
    shortDescription: 'Three linked events',
    description: '<p>Official series overview.</p>',
    mode: 'MULTI_ROUND',
    isPrivate: false,
    startTime: '2026-09-01T08:00:00Z',
    endTime: '2026-12-01T08:00:00Z',
    children: [
        {
            id: 11,
            name: 'Round one',
            shortDescription: null,
            startTime: '2026-09-01T08:00:00Z',
            endTime: '2026-09-02T08:00:00Z',
            displayOrder: 1,
            problemCount: 2,
            status: 'FINISHED',
            competitionType: 'CASUAL',
        },
    ],
};

const leaderboard: CompetitionSeriesLeaderboard = {
    mode: 'MULTI_ROUND',
    combined: [
        {
            rank: 1,
            user: {
                id: 'u1',
                username: 'Ada',
                identityPresentation: {
                    title: {
                        id: 2026,
                        code: 'IOAI_2026_GOLD',
                        name: 'IOAI 2026 Champion',
                        prefixEmoji: 'GOLD_MEDAL',
                        color: 'GOLD',
                        font: 'DISPLAY',
                        effect: 'GLITTER',
                    },
                    usernameStyle: {
                        color: 'GOLD',
                        font: 'DEFAULT',
                        effect: 'GLOW',
                    },
                },
            },
            totalScore: 95,
            rounds: [{ id: 11, competitionId: 11, name: 'Round one', score: 95 }],
            problems: [{ id: 101, competitionId: 11, name: 'Vision', score: 50 }],
        },
    ],
    children: [
        {
            competitionId: 11,
            competitionName: 'Round one',
            complete: false,
            entries: [
                {
                    rank: 1,
                    user: {
                        id: 'u1',
                        username: 'Ada',
                        identityPresentation: {
                            title: {
                                id: 2026,
                                code: 'IOAI_2026_GOLD',
                                name: 'IOAI 2026 Champion',
                                prefixEmoji: 'GOLD_MEDAL',
                                color: 'GOLD',
                                font: 'DISPLAY',
                                effect: 'GLITTER',
                            },
                            usernameStyle: {
                                color: 'GOLD',
                                font: 'DEFAULT',
                                effect: 'GLOW',
                            },
                        },
                    },
                    totalScore: 95,
                    rounds: [],
                    problems: [],
                },
            ],
        },
    ],
};

afterEach(cleanup);

describe('CompetitionSeriesView', () => {
    it('renders a multi-round overview, child links, and the accessible score matrix', () => {
        render(
            <CompetitionSeriesView
                series={baseSeries}
                leaderboard={leaderboard}
                locale="en"
                messages={messages}
            />,
        );

        expect(screen.getByRole('heading', { level: 1, name: 'National League' })).toBeTruthy();
        expect(screen.getByRole('link', { name: 'View competition' }).getAttribute('href')).toBe(
            '/competitions/11',
        );
        expect(
            screen
                .getAllByRole('link', { name: 'View leaderboard' })
                .every((link) => link.getAttribute('href') === '/competitions/11?tab=partial'),
        ).toBe(true);
        const matrix = screen.getByRole('table', { name: 'Combined leaderboard' });
        expect(within(matrix).getByRole('columnheader', { name: 'Vision' })).toBeTruthy();
        expect(screen.getAllByText('95').length).toBeGreaterThan(0);
        expect(screen.getByText('Calculated automatically from every round.')).toBeTruthy();
        expect(screen.getByText('Starts')).toBeTruthy();
        expect(screen.getByText('Ends')).toBeTruthy();
        expect(document.querySelector('time[datetime="2026-09-01T08:00:00Z"]')).toBeTruthy();
        expect(document.querySelector('time[datetime="2026-09-02T08:00:00Z"]')).toBeTruthy();
    });

    it('links finished child leaderboards to final results', () => {
        render(
            <CompetitionSeriesView
                series={baseSeries}
                leaderboard={{
                    ...leaderboard,
                    children: leaderboard.children.map((section) => ({
                        ...section,
                        complete: true,
                    })),
                }}
                locale="en"
                messages={messages}
            />,
        );

        expect(
            screen
                .getAllByRole('link', { name: 'View leaderboard' })
                .every((link) => link.getAttribute('href') === '/competitions/11?tab=final'),
        ).toBe(true);
    });

    it('shows identity titles in an all-casual multi-round series', () => {
        render(
            <CompetitionSeriesView
                series={baseSeries}
                leaderboard={leaderboard}
                locale="en"
                messages={messages}
            />,
        );

        expect(screen.getAllByText('IOAI 2026 Champion').length).toBeGreaterThan(0);
    });

    it('suppresses identity titles in classic child and mixed combined leaderboards', () => {
        render(
            <CompetitionSeriesView
                series={{
                    ...baseSeries,
                    children: [
                        { ...baseSeries.children[0]!, competitionType: 'CLASSIC' },
                        {
                            ...baseSeries.children[0]!,
                            id: 12,
                            name: 'Round two',
                            displayOrder: 2,
                            competitionType: 'CASUAL',
                        },
                    ],
                }}
                leaderboard={leaderboard}
                locale="en"
                messages={messages}
            />,
        );

        expect(screen.queryByText('IOAI 2026 Champion')).toBeNull();
        expect(document.querySelector('.user-identity-effect--glow')).toBeNull();
    });

    it('does not expose a combined leaderboard for a divisions series', () => {
        render(
            <CompetitionSeriesView
                series={{ ...baseSeries, mode: 'DIVISIONS' }}
                leaderboard={{ ...leaderboard, mode: 'DIVISIONS', combined: null }}
                locale="en"
                messages={messages}
            />,
        );

        expect(screen.queryByRole('table', { name: 'Combined leaderboard' })).toBeNull();
        expect(screen.queryByRole('link', { name: 'Combined' })).toBeNull();
        expect(screen.getByText('Division 1')).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'Event leaderboards' })).toBeTruthy();
    });
});
