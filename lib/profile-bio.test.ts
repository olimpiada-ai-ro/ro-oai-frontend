import { describe, expect, it } from 'vitest';

import { limitProfileBio, PROFILE_BIO_MAX_LENGTH } from '@/lib/profile-bio';

describe('limitProfileBio', () => {
    it('preserves biographies within the supported limit', () => {
        const biography = 'a'.repeat(PROFILE_BIO_MAX_LENGTH);

        expect(limitProfileBio(biography)).toBe(biography);
        expect(limitProfileBio(null)).toBeNull();
        expect(limitProfileBio({ biography })).toBeNull();
    });

    it('limits legacy oversized biographies', () => {
        expect(limitProfileBio('a'.repeat(PROFILE_BIO_MAX_LENGTH + 100))).toHaveLength(
            PROFILE_BIO_MAX_LENGTH,
        );
    });

    it('does not split an emoji at the truncation boundary', () => {
        const biography = `${'a'.repeat(PROFILE_BIO_MAX_LENGTH - 1)}🦭after`;
        const result = limitProfileBio(biography);

        expect(result).toBe('a'.repeat(PROFILE_BIO_MAX_LENGTH - 1));
        expect(result).not.toContain('\uFFFD');
    });
});
