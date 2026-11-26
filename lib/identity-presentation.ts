export const IDENTITY_COLORS = [
    'DEFAULT',
    'GOLD',
    'SILVER',
    'BRONZE',
    'PURPLE',
    'BLUE',
    'GREEN',
    'RED',
    'PINK',
    'CYAN',
] as const;

export const IDENTITY_FONTS = ['DEFAULT', 'DISPLAY', 'SERIF', 'MONO'] as const;

export const IDENTITY_EFFECTS = ['NONE', 'SHIMMER', 'GLITTER', 'GLOW'] as const;

export const IDENTITY_PREFIX_EMOJIS = [
    'NONE',
    'CROWN',
    'GOLD_MEDAL',
    'SILVER_MEDAL',
    'BRONZE_MEDAL',
    'STAR',
    'SPARKLES',
] as const;

export type IdentityColor = (typeof IDENTITY_COLORS)[number];
export type IdentityFont = (typeof IDENTITY_FONTS)[number];
export type IdentityEffect = (typeof IDENTITY_EFFECTS)[number];
export type IdentityPrefixEmoji = (typeof IDENTITY_PREFIX_EMOJIS)[number];

export type PublicUserTitle = {
    id: number;
    code: string;
    name: string;
    prefixEmoji: IdentityPrefixEmoji;
    color: IdentityColor;
    font: IdentityFont;
    effect: IdentityEffect;
};

export type PublicUsernameStyle = {
    color: IdentityColor;
    font: IdentityFont;
    effect: IdentityEffect;
};

/**
 * Public, presentation-only identity data. Achievement rules and grant
 * provenance intentionally never cross this boundary.
 */
export type IdentityPresentation = {
    title: PublicUserTitle;
    usernameStyle: PublicUsernameStyle;
};

export type IdentityPresentationSurface =
    | 'PROFILE'
    | 'AUTHOR'
    | 'GLOBAL_LEADERBOARD'
    | 'PROBLEM_LEADERBOARD'
    | 'CASUAL_COMPETITION_LEADERBOARD'
    | 'RESTRICTED_COMPETITION_LEADERBOARD';

const PRESENTATION_SURFACES = new Set<IdentityPresentationSurface>([
    'PROFILE',
    'AUTHOR',
    'GLOBAL_LEADERBOARD',
    'PROBLEM_LEADERBOARD',
    'CASUAL_COMPETITION_LEADERBOARD',
]);

export function canRenderIdentityPresentation(surface: IdentityPresentationSurface): boolean {
    return PRESENTATION_SURFACES.has(surface);
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

function optionalText(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Runtime-normalize the API payload before it can influence CSS classes.
 * Unknown style values always fall back to the readable default treatment.
 */
export function normalizeIdentityPresentation(value: unknown): IdentityPresentation | null {
    const presentation = asRecord(value);
    const title = asRecord(presentation?.title);
    const usernameStyle = asRecord(presentation?.usernameStyle);
    const name = optionalText(title?.name);

    if (!presentation || !title || !usernameStyle || !name) return null;

    return {
        title: {
            id:
                typeof title.id === 'number' && Number.isFinite(title.id)
                    ? Math.trunc(title.id)
                    : 0,
            code: optionalText(title.code) ?? '',
            name,
            prefixEmoji: enumValue(title.prefixEmoji, IDENTITY_PREFIX_EMOJIS, 'NONE'),
            color: enumValue(title.color, IDENTITY_COLORS, 'DEFAULT'),
            font: enumValue(title.font, IDENTITY_FONTS, 'DEFAULT'),
            effect: enumValue(title.effect, IDENTITY_EFFECTS, 'NONE'),
        },
        usernameStyle: {
            color: enumValue(usernameStyle.color, IDENTITY_COLORS, 'DEFAULT'),
            font: enumValue(usernameStyle.font, IDENTITY_FONTS, 'DEFAULT'),
            effect: enumValue(usernameStyle.effect, IDENTITY_EFFECTS, 'NONE'),
        },
    };
}
