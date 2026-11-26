import { limitProfileBio } from '@/lib/profile-bio';
import type { Country, Institution, UserProfile } from '@/lib/types';

type ProfileSettingsPayload = {
    userId?: string;
    username?: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    joinDate?: string;
    avatar?: string;
    bio?: string | null;
    location?: string | null;
    website?: string | null;
    github?: string | null;
    institution?: Institution;
    institutionJoinedAt?: string;
    country?: Country;
    onboardingDismissed?: boolean;
    language?: string;
};

type LeaderboardProfilePayload = {
    username?: string;
    attainedAt?: string;
    avatar?: string;
    totalScore?: number;
    solvedCount?: number;
    averageScore?: number;
    rank?: number;
    country?: Country;
};

export type ProfilePayload = {
    profile?: { leaderboard?: LeaderboardProfilePayload };
    settings?: ProfileSettingsPayload;
};

function validDate(value?: string): Date {
    const parsed = value ? new Date(value) : new Date(0);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

export function normalizeOnboardingProfile(
    payload: ProfilePayload,
    fallbackUserId: string,
): UserProfile {
    const leaderboard = payload.profile?.leaderboard ?? {};
    const settings = payload.settings ?? {};

    return {
        userId: settings.userId ?? fallbackUserId,
        username: settings.username ?? leaderboard.username ?? '',
        firstName: settings.firstName ?? null,
        lastName: settings.lastName ?? null,
        email: settings.email ?? null,
        joinedAt: validDate(settings.joinDate ?? leaderboard.attainedAt),
        avatar: settings.avatar ?? leaderboard.avatar ?? '',
        bio: limitProfileBio(settings.bio),
        location: settings.location ?? null,
        website: settings.website ?? null,
        github: settings.github ?? null,
        totalScore: leaderboard.totalScore ?? 0,
        problemsSolved: leaderboard.solvedCount ?? 0,
        averageScore: leaderboard.averageScore ?? 0,
        rank: leaderboard.rank ?? 0,
        leaderboardPlaced: Boolean(leaderboard.rank),
        institution: settings.institution,
        institutionJoinedAt: settings.institutionJoinedAt
            ? validDate(settings.institutionJoinedAt)
            : undefined,
        country: settings.country ?? leaderboard.country,
        onboardingDismissed: settings.onboardingDismissed ?? false,
    };
}
