import type { ReactNode } from 'react';

import {
    canRenderIdentityPresentation,
    normalizeIdentityPresentation,
    type IdentityColor,
    type IdentityEffect,
    type IdentityFont,
    type IdentityPrefixEmoji,
    type IdentityPresentationSurface,
} from '@/lib/identity-presentation';
import { cn } from '@/lib/utils';

const COLOR_CLASSES: Record<IdentityColor, string> = {
    DEFAULT: 'user-identity-color--default',
    GOLD: 'user-identity-color--gold',
    SILVER: 'user-identity-color--silver',
    BRONZE: 'user-identity-color--bronze',
    PURPLE: 'user-identity-color--purple',
    BLUE: 'user-identity-color--blue',
    GREEN: 'user-identity-color--green',
    RED: 'user-identity-color--red',
    PINK: 'user-identity-color--pink',
    CYAN: 'user-identity-color--cyan',
};

const FONT_CLASSES: Record<IdentityFont, string> = {
    DEFAULT: 'user-identity-font--default',
    DISPLAY: 'user-identity-font--display',
    SERIF: 'user-identity-font--serif',
    MONO: 'user-identity-font--mono',
};

const EFFECT_CLASSES: Record<IdentityEffect, string> = {
    NONE: 'user-identity-effect--none',
    SHIMMER: 'user-identity-effect--shimmer',
    GLITTER: 'user-identity-effect--glitter',
    GLOW: 'user-identity-effect--glow',
};

const PREFIX_EMOJI_GLYPHS: Record<IdentityPrefixEmoji, string | null> = {
    NONE: null,
    CROWN: '👑',
    GOLD_MEDAL: '🥇',
    SILVER_MEDAL: '🥈',
    BRONZE_MEDAL: '🥉',
    STAR: '⭐',
    SPARKLES: '✨',
};

export type UserIdentityPresentationProps = {
    username: ReactNode;
    identityPresentation?: unknown;
    surface: IdentityPresentationSurface;
    layout?: 'inline' | 'stacked';
    align?: 'start' | 'center';
    compact?: boolean;
    className?: string;
    usernameClassName?: string;
    titleClassName?: string;
};

/**
 * Shared, presentation-only identity treatment. The surface allowlist is a
 * second fairness guard in addition to the backend omitting titles from
 * classic competition responses.
 */
export function UserIdentityPresentation({
    username,
    identityPresentation,
    surface,
    layout = 'inline',
    align = 'start',
    compact = false,
    className,
    usernameClassName,
    titleClassName,
}: UserIdentityPresentationProps) {
    const presentation = canRenderIdentityPresentation(surface)
        ? normalizeIdentityPresentation(identityPresentation)
        : null;
    const prefixEmoji = presentation ? PREFIX_EMOJI_GLYPHS[presentation.title.prefixEmoji] : null;

    return (
        <span
            className={cn(
                'user-identity-presentation inline-flex min-w-0 max-w-full',
                layout === 'stacked'
                    ? 'flex-col gap-1'
                    : 'flex-row flex-wrap items-center gap-x-2 gap-y-1',
                align === 'center' ? 'items-center text-center' : 'items-start text-start',
                className,
            )}
            dir="auto"
            data-identity-surface={surface}
        >
            <span
                className={cn(
                    'user-identity-presentation__username min-w-0 max-w-full',
                    presentation && COLOR_CLASSES[presentation.usernameStyle.color],
                    presentation && FONT_CLASSES[presentation.usernameStyle.font],
                    presentation && EFFECT_CLASSES[presentation.usernameStyle.effect],
                    usernameClassName,
                )}
                data-identity-effect={presentation?.usernameStyle.effect ?? 'NONE'}
            >
                {username}
            </span>

            {presentation ? (
                <span
                    className={cn(
                        'user-identity-presentation__title inline-flex max-w-full items-center gap-1.5 border px-2 py-0.5 font-semibold leading-5',
                        compact ? 'text-[0.68rem]' : 'text-xs',
                        COLOR_CLASSES[presentation.title.color],
                        FONT_CLASSES[presentation.title.font],
                        EFFECT_CLASSES[presentation.title.effect],
                        titleClassName,
                    )}
                    data-testid="user-identity-title"
                    data-identity-effect={presentation.title.effect}
                >
                    {prefixEmoji ? (
                        <bdi aria-hidden="true" className="shrink-0 not-italic" dir="ltr">
                            {prefixEmoji}
                        </bdi>
                    ) : null}
                    <span className="min-w-0 break-words" dir="auto">
                        {presentation.title.name}
                    </span>
                </span>
            ) : null}
        </span>
    );
}
