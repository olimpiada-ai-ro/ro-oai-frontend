import { describe, expect, it } from 'vitest';

import { normalizeCompetitionSeriesDetail, normalizeCompetitionSeriesLeaderboard } from './api';

describe('competition series API adapter', () => {
    it('normalizes and orders the frozen detail contract', () => {
        const result = normalizeCompetitionSeriesDetail({
            id: 8,
            name: 'National League',
            shortDescription: 'Three stages',
            description: '<p>Series description</p>',
            mode: 'MULTI_ROUND',
            isPrivate: true,
            startTime: '2026-09-01T08:00:00Z',
            endTime: '2026-12-01T08:00:00Z',
            competitions: [
                {
                    id: 12,
                    name: 'Round two',
                    position: 2,
                    startTime: '2026-10-01T08:00:00Z',
                    endTime: '2026-10-02T08:00:00Z',
                    problemCount: 4,
                },
                {
                    id: 11,
                    name: 'Round one',
                    position: 1,
                    startTime: '2026-09-01T08:00:00Z',
                    endTime: '2026-09-02T08:00:00Z',
                    problemCount: 3,
                },
            ],
        });

        expect(result).toMatchObject({
            id: 8,
            mode: 'MULTI_ROUND',
            isPrivate: true,
        });
        expect(result.children.map((child) => child.id)).toEqual([11, 12]);
        expect(result.children.map((child) => child.displayOrder)).toEqual([1, 2]);
    });

    it('normalizes sections and the combined score matrix', () => {
        const result = normalizeCompetitionSeriesLeaderboard({
            mode: 'MULTI_ROUND',
            sections: [
                {
                    competitionId: 11,
                    competitionName: 'Round one',
                    complete: false,
                    rows: [
                        {
                            rank: 1,
                            user: { id: 'u1', username: 'Ada' },
                            totalScore: 95,
                        },
                    ],
                },
            ],
            combined: {
                rows: [
                    {
                        rank: 1,
                        user: { id: 'u1', username: 'Ada', avatar: '/ada.png' },
                        totalScore: 185,
                        childTotals: [
                            { competitionId: 11, name: 'Round one', score: 95 },
                            { competitionId: 12, name: 'Round two', score: 90 },
                        ],
                        problemScores: [
                            {
                                competitionId: 11,
                                problemId: 101,
                                name: 'Vision',
                                score: 50,
                            },
                        ],
                    },
                ],
            },
        });

        expect(result.children[0]).toMatchObject({
            competitionId: 11,
            competitionName: 'Round one',
            complete: false,
        });
        expect(result.children[0].entries[0].user.username).toBe('Ada');
        expect(result.combined?.[0]).toMatchObject({ rank: 1, totalScore: 185 });
        expect(result.combined?.[0].rounds.map((score) => score.score)).toEqual([95, 90]);
        expect(result.combined?.[0].problems[0]).toMatchObject({
            id: 101,
            competitionId: 11,
            score: 50,
        });
    });

    it('preserves whether a child leaderboard is complete', () => {
        const result = normalizeCompetitionSeriesLeaderboard({
            mode: 'MULTI_ROUND',
            sections: [
                { competitionId: 11, competitionName: 'Ongoing', complete: false, rows: [] },
                { competitionId: 12, competitionName: 'Finished', complete: true, rows: [] },
            ],
        });

        expect(result.children.map((section) => section.complete)).toEqual([false, true]);
    });

    it('never exposes a combined leaderboard for divisions', () => {
        const result = normalizeCompetitionSeriesLeaderboard({
            mode: 'DIVISIONS',
            sections: [],
            combined: [{ rank: 1, username: 'Should not render', totalScore: 100 }],
        });

        expect(result.mode).toBe('DIVISIONS');
        expect(result.combined).toBeNull();
    });
});
