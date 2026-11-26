import {
    normalizeIdentityPresentation,
    type IdentityPresentation,
} from '@/lib/identity-presentation';

type ProfileIdentityPayload = {
    profile?: {
        identityPresentation?: unknown;
        leaderboard?: { identityPresentation?: unknown } | null;
    } | null;
};

/**
 * A title is profile data, not leaderboard data. Prefer its dedicated profile
 * field so manually awarded medalists without an overall rank still display
 * it; retain the leaderboard fallback during the API rollout.
 */
export function getProfileIdentityPresentation(
    payload: ProfileIdentityPayload,
): IdentityPresentation | null {
    return normalizeIdentityPresentation(
        payload.profile?.identityPresentation ?? payload.profile?.leaderboard?.identityPresentation,
    );
}
