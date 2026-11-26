import { GenericLeaderboardEntry, SimpleLeaderboardEntry } from '@/lib/types';

export function mapSimpleLeaderboardEntry(e: SimpleLeaderboardEntry): GenericLeaderboardEntry {
    return {
        userId: e.userId,
        username: e.username,
        totalScore: Number(e.score ?? 0),
        avatar: e.avatar,
        rank: e.rank,
        problemScores: e.problemScores,
        metric: e.metric,
        attainedAt: e.attainedAt,
        awardRank: e.awardRank,
        identityPresentation: e.identityPresentation,
    };
}
