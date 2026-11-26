import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { CompetitionScoringBadge } from '@/components/competition-scoring-badge';
import type { CompetitionType } from '@/lib/types';

const messages = {
    competitions: {
        hybrid: { format: 'Theory test + project' },
        scoring: {
            visible: 'Final scores visible',
            visibleDescription:
                'Final scores and final leaderboards are visible throughout this competition.',
        },
    },
};

function renderBadge(competitionType: CompetitionType | undefined) {
    return render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <CompetitionScoringBadge competitionType={competitionType} />
        </NextIntlClientProvider>,
    );
}

describe('CompetitionScoringBadge', () => {
    it('identifies casual competitions and explains the live score policy accessibly', () => {
        renderBadge('CASUAL');

        expect(
            screen.getByLabelText(
                'Final scores and final leaderboards are visible throughout this competition.',
            ).textContent,
        ).toContain('Final scores visible');
    });

    it('identifies the hybrid format without promising live scores', () => {
        renderBadge('HYBRID');
        expect(screen.getByLabelText('Theory test + project')).toBeTruthy();
        expect(screen.queryByText('Final scores visible')).toBeNull();
    });

    it('does not imply score visibility for classic or rolling legacy responses', () => {
        const { rerender } = renderBadge('CLASSIC');

        expect(screen.queryByText('Final scores visible')).toBeNull();

        rerender(
            <NextIntlClientProvider locale="en" messages={messages}>
                <CompetitionScoringBadge competitionType={undefined} />
            </NextIntlClientProvider>,
        );

        expect(screen.queryByText('Final scores visible')).toBeNull();
    });
});
