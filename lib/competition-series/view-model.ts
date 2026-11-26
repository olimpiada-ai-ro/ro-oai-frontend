import type {
    CompetitionSeriesLeaderboardRow,
    CompetitionSeriesScore,
} from '@/lib/competition-series/types';

export type CompetitionSeriesScoreColumn = Pick<
    CompetitionSeriesScore,
    'id' | 'name' | 'competitionId'
>;

function uniqueColumns(
    rows: CompetitionSeriesLeaderboardRow[],
    field: 'rounds' | 'problems',
): CompetitionSeriesScoreColumn[] {
    const columns = new Map<string, CompetitionSeriesScoreColumn>();
    for (const row of rows) {
        for (const score of row[field]) {
            const key = `${score.competitionId ?? ''}:${score.id}`;
            if (!columns.has(key)) {
                columns.set(key, {
                    id: score.id,
                    name: score.name,
                    competitionId: score.competitionId,
                });
            }
        }
    }
    return [...columns.values()];
}

export function getCompetitionSeriesScoreColumns(rows: CompetitionSeriesLeaderboardRow[]) {
    return {
        rounds: uniqueColumns(rows, 'rounds'),
        problems: uniqueColumns(rows, 'problems'),
    };
}

export function getCompetitionSeriesCellScore(
    row: CompetitionSeriesLeaderboardRow,
    field: 'rounds' | 'problems',
    column: CompetitionSeriesScoreColumn,
): number | null {
    return (
        row[field].find(
            (score) =>
                score.id === column.id &&
                (score.competitionId ?? null) === (column.competitionId ?? null),
        )?.score ?? null
    );
}
