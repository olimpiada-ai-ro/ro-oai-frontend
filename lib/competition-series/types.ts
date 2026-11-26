import type { IdentityPresentation } from '@/lib/identity-presentation';
import type { CompetitionType } from '@/lib/types';

export type CompetitionSeriesMode = 'MULTI_ROUND' | 'DIVISIONS';

export type CompetitionSeriesParent = {
    id: number;
    name: string;
    mode: CompetitionSeriesMode;
};

export type CompetitionSeriesChild = {
    id: number;
    name: string;
    shortDescription?: string | null;
    startTime: string;
    endTime: string;
    displayOrder: number;
    problemCount: number;
    status?: string | null;
    competitionType?: CompetitionType | null;
};

export type CompetitionSeriesDetail = {
    id: number;
    name: string;
    shortDescription?: string | null;
    description?: string | null;
    mode: CompetitionSeriesMode;
    isPrivate: boolean;
    startTime: string;
    endTime: string;
    children: CompetitionSeriesChild[];
};

export type CompetitionSeriesUser = {
    id: string;
    username: string;
    avatar?: string | null;
    identityPresentation?: IdentityPresentation | null;
};

export type CompetitionSeriesScore = {
    id: number;
    name: string;
    score: number | null;
    competitionId?: number | null;
};

export type CompetitionSeriesLeaderboardRow = {
    rank: number;
    user: CompetitionSeriesUser;
    totalScore: number;
    rounds: CompetitionSeriesScore[];
    problems: CompetitionSeriesScore[];
};

export type CompetitionSeriesChildLeaderboard = {
    competitionId: number;
    competitionName: string;
    complete: boolean;
    entries: CompetitionSeriesLeaderboardRow[];
};

export type CompetitionSeriesLeaderboard = {
    mode: CompetitionSeriesMode;
    children: CompetitionSeriesChildLeaderboard[];
    combined: CompetitionSeriesLeaderboardRow[] | null;
};
