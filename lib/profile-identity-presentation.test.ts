import { describe, expect, it } from 'vitest';

import { getProfileIdentityPresentation } from '@/lib/profile-identity-presentation';

describe('getProfileIdentityPresentation', () => {
    it('keeps a manually awarded title when the user has no overall leaderboard row', () => {
        const result = getProfileIdentityPresentation({
            profile: {
                leaderboard: null,
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
        });

        expect(result?.title.name).toBe('IOAI 2026 Champion');
    });

    it('falls back to the legacy leaderboard placement during rollout', () => {
        const result = getProfileIdentityPresentation({
            profile: {
                leaderboard: {
                    identityPresentation: {
                        title: {
                            id: 1,
                            code: 'LEGACY',
                            name: 'Legacy title',
                            prefixEmoji: 'NONE',
                            color: 'DEFAULT',
                            font: 'DEFAULT',
                            effect: 'NONE',
                        },
                        usernameStyle: {
                            color: 'DEFAULT',
                            font: 'DEFAULT',
                            effect: 'NONE',
                        },
                    },
                },
            },
        });

        expect(result?.title.name).toBe('Legacy title');
    });
});
