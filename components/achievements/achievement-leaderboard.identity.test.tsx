import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fetchAchievementLeaderboard: vi.fn(),
}));

vi.mock('next-intl', () => ({
    useFormatter: () => ({ number: (value: number) => String(value) }),
    useTranslations: () => (key: string) => key,
}));

vi.mock('next/font/google', () => ({
    Onest: () => ({ className: 'onest', variable: '--font-onest' }),
    Unbounded: () => ({ className: 'unbounded', variable: '--font-unbounded' }),
}));

vi.mock('@/lib/api', () => ({
    fetchAchievementLeaderboard: mocks.fetchAchievementLeaderboard,
}));

import { AchievementLeaderboard } from '@/components/achievements/achievement-leaderboard';

describe('AchievementLeaderboard identity presentation', () => {
    beforeEach(() => {
        mocks.fetchAchievementLeaderboard.mockResolvedValue({
            content: [
                {
                    rank: 1,
                    userId: 'ioai-champion',
                    username: 'champion',
                    totalAchievements: 12,
                    totalXp: 2600,
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
            ],
            totalElements: 1,
            totalPages: 1,
            size: 20,
            number: 0,
        });
    });

    it('shows the public title on the platform-wide achievement leaderboard', async () => {
        render(<AchievementLeaderboard />);

        expect(await screen.findByText('IOAI 2026 Champion')).toBeInTheDocument();
        expect(screen.getByText('champion')).toHaveAttribute('data-identity-effect', 'GLOW');
    });
});
