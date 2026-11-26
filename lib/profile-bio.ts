export const PROFILE_BIO_MAX_LENGTH = 500;

/**
 * Keep profile biographies safe to render even when they were stored before a
 * server-side limit existed. The boundary check avoids returning a dangling
 * high surrogate when the limit falls in the middle of an emoji.
 */
export function limitProfileBio(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    if (value.length <= PROFILE_BIO_MAX_LENGTH) return value;

    let end = PROFILE_BIO_MAX_LENGTH;
    const lastCodeUnit = value.charCodeAt(end - 1);
    if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) {
        end -= 1;
    }

    return value.slice(0, end);
}
