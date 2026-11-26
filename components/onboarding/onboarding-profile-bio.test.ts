import { describe, expect, it } from 'vitest';

import { normalizeOnboardingProfile } from '@/lib/onboarding-profile-response';

describe('normalizeOnboardingProfile biography', () => {
    it('bounds legacy oversized biographies before initializing the editor', () => {
        const profile = normalizeOnboardingProfile(
            {
                settings: {
                    userId: 'legacy-user',
                    bio: 'a'.repeat(50_000),
                },
            },
            'legacy-user',
        );

        expect(profile.bio).toHaveLength(500);
    });
});
