import { describe, expect, it } from 'vitest';

import type { CompetitionSeriesLeaderboardRow } from './types';
import { getCompetitionSeriesCellScore, getCompetitionSeriesScoreColumns } from './view-model';

const rows: CompetitionSeriesLeaderboardRow[] = [
    {
        rank: 1,
        user: { id: 'u1', username: 'Ada' },
        totalScore: 180,
        rounds: [
            { id: 10, competitionId: 10, name: 'Round 1', score: 90 },
            { id: 11, competitionId: 11, name: 'Round 2', score: 90 },
        ],
        problems: [
            { id: 7, competitionId: 10, name: 'Shared title', score: 40 },
            { id: 7, competitionId: 11, name: 'Shared title', score: 50 },
        ],
    },
    {
        rank: 2,
        user: { id: 'u2', username: 'Lin' },
        totalScore: 85,
        rounds: [{ id: 10, competitionId: 10, name: 'Round 1', score: 85 }],
        problems: [{ id: 7, competitionId: 10, name: 'Shared title', score: 35 }],
    },
];

describe('competition series score matrix', () => {
    it('keeps same-numbered problems from different rounds distinct', () => {
        const columns = getCompetitionSeriesScoreColumns(rows);
        expect(columns.rounds).toHaveLength(2);
        expect(columns.problems).toHaveLength(2);
        expect(columns.problems.map((column) => column.competitionId)).toEqual([10, 11]);
    });

    it('returns null for a missing matrix cell', () => {
        const columns = getCompetitionSeriesScoreColumns(rows);
        expect(getCompetitionSeriesCellScore(rows[1], 'problems', columns.problems[1])).toBeNull();
        expect(getCompetitionSeriesCellScore(rows[0], 'problems', columns.problems[1])).toBe(50);
    });
});
