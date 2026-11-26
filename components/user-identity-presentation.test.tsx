import '@testing-library/jest-dom/vitest';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UserIdentityPresentation } from '@/components/user-identity-presentation';
import type {
    IdentityPresentation,
    IdentityPresentationSurface,
} from '@/lib/identity-presentation';

const presentation: IdentityPresentation = {
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
        color: 'PURPLE',
        font: 'SERIF',
        effect: 'SHIMMER',
    },
};

describe('UserIdentityPresentation', () => {
    const visibleSurfaces: IdentityPresentationSurface[] = [
        'PROFILE',
        'AUTHOR',
        'GLOBAL_LEADERBOARD',
        'PROBLEM_LEADERBOARD',
        'CASUAL_COMPETITION_LEADERBOARD',
    ];

    it.each(visibleSurfaces)('shows the public title on the %s surface', (surface) => {
        render(
            <UserIdentityPresentation
                username="pixel"
                identityPresentation={presentation}
                surface={surface}
            />,
        );

        expect(screen.getByText('IOAI 2026 Champion')).toBeInTheDocument();
    });

    it('suppresses both the title and username effects on restricted competition leaderboards', () => {
        render(
            <UserIdentityPresentation
                username="pixel"
                identityPresentation={presentation}
                surface="RESTRICTED_COMPETITION_LEADERBOARD"
            />,
        );

        expect(screen.queryByText('IOAI 2026 Champion')).not.toBeInTheDocument();
        expect(screen.getByText('pixel')).toHaveAttribute('data-identity-effect', 'NONE');
        expect(screen.getByText('pixel').className).not.toContain('user-identity-color--purple');
        expect(screen.getByText('pixel').className).not.toContain('user-identity-font--serif');
    });

    it('maps unknown API style values to fixed readable fallbacks without reflecting class input', () => {
        render(
            <UserIdentityPresentation
                username="safe-user"
                surface="PROFILE"
                identityPresentation={{
                    title: {
                        ...presentation.title,
                        color: 'text-transparent attacker-class',
                        font: '[font-family:evil]',
                        effect: 'animate-spin',
                    },
                    usernameStyle: {
                        color: 'attacker-class',
                        font: 'attacker-font',
                        effect: 'attacker-effect',
                    },
                }}
            />,
        );

        const title = screen.getByTestId('user-identity-title');
        expect(title).toHaveClass('user-identity-color--default');
        expect(title).toHaveClass('user-identity-font--default');
        expect(title).toHaveClass('user-identity-effect--none');
        expect(document.documentElement.innerHTML).not.toContain('attacker-class');
        expect(document.documentElement.innerHTML).not.toContain('[font-family:evil]');
    });

    it('keeps the localized title accessible while treating its emoji as decoration in RTL text', () => {
        render(
            <UserIdentityPresentation
                username="مشارك"
                identityPresentation={{
                    ...presentation,
                    title: { ...presentation.title, name: 'بطل IOAI 2026' },
                }}
                surface="PROFILE"
            />,
        );

        const title = screen.getByText('بطل IOAI 2026');
        expect(title).toHaveAttribute('dir', 'auto');
        expect(title.previousElementSibling).toHaveAttribute('aria-hidden', 'true');
        expect(title.previousElementSibling).toHaveAttribute('dir', 'ltr');
    });

    it('disables shimmer and glitter animation for reduced-motion users', () => {
        const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
        const reducedMotionBlock = css.slice(
            css.indexOf('@media (prefers-reduced-motion: reduce)'),
        );

        expect(reducedMotionBlock).toContain('.user-identity-effect--shimmer');
        expect(reducedMotionBlock).toContain('.user-identity-effect--glitter');
        expect(reducedMotionBlock).toContain('animation: none !important');
    });
});
