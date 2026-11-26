import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', () => ({
    Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
        <a href={String(href)} {...props}>
            {children}
        </a>
    ),
}));

import { ProblemAuthors } from '@/components/problem-authors';

describe('ProblemAuthors', () => {
    it('links platform authors while keeping named external authors as text', () => {
        render(
            <ProblemAuthors
                label="Autori"
                problem={{
                    author: 'Legacy Author',
                    authors: [
                        {
                            userId: 'user-1',
                            username: 'pixel-testerson',
                            firstName: 'Pixel',
                            lastName: 'Testerson',
                            displayName: 'Pixel Testerson',
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
                        {
                            userId: null,
                            firstName: 'Ana',
                            lastName: 'Popescu',
                            displayName: 'Ana Popescu',
                        },
                    ],
                }}
            />,
        );

        expect(screen.getByText('Autori:')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Pixel Testerson' })).toHaveAttribute(
            'href',
            '/profile/pixel-testerson',
        );
        expect(screen.getByText('Ana Popescu')).toBeInTheDocument();
        expect(screen.getByText('IOAI 2026 Champion')).toBeInTheDocument();
        expect(screen.queryByText('Legacy Author')).not.toBeInTheDocument();
    });
});
