import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/dynamic', () => ({
    default: () => () => null,
}));

vi.mock('next/image', () => ({
    default: () => <span aria-hidden="true" />,
}));

vi.mock('next-intl', () => ({
    useLocale: () => 'ro',
    useTranslations: () => (key: string) =>
        ({
            'common.appName': 'MLCompete',
            'header.openMenu': 'Open menu',
            'navigation.achievements': 'Achievements',
            'navigation.competitions': 'Competitions',
            'countries.title': 'Countries',
            'navigation.institutions': 'Institutions',
            'navigation.leaderboard': 'Leaderboard',
            'navigation.problems': 'Problems',
            'navigation.roadmap': 'Learning roadmap',
        })[key] ?? key,
}));

vi.mock('@/components/competition-data-provider', () => ({
    useCompetitionData: () => ({
        authenticated: true,
        isProfileConfirmed: true,
        isAnyCompetitionOngoing: false,
    }),
}));

vi.mock('@/components/language-selector', () => ({
    LanguageSelector: () => <button type="button">Language</button>,
}));

vi.mock('@/components/notification-badge', () => ({
    NotificationBadge: () => <button type="button">Notifications</button>,
}));

vi.mock('@/components/theme-toggle', () => ({
    ThemeToggle: () => <button type="button">Theme</button>,
}));

vi.mock('@/i18n/routing', async () => {
    const React = await import('react');

    return {
        Link: React.forwardRef<
            HTMLAnchorElement,
            React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
        >(({ href, ...props }, ref) => <a ref={ref} href={href} {...props} />),
        usePathname: () => '/ro/problems',
    };
});

vi.mock('@/lib/platform-fonts', () => ({
    platformSans: { className: '', variable: '' },
}));

import { Header } from '@/components/header';

function expectPageToRemainInteractive() {
    expect(document.body.getAttribute('data-scroll-locked')).toBeNull();
    expect(document.body.style.pointerEvents).not.toBe('none');
}

describe('Header platform directory', () => {
    afterEach(() => {
        cleanup();
        document.body.removeAttribute('data-scroll-locked');
        document.body.style.pointerEvents = '';
    });

    it('does not lock the page and preserves menu dismissal behavior', async () => {
        const user = userEvent.setup();
        render(<Header />);

        const desktopNavigation = screen.getByRole('navigation', { name: 'MLCompete' });
        const trigger = within(desktopNavigation).getByRole('button', { name: 'Open menu' });

        await user.click(trigger);

        expect(await screen.findByRole('menu')).toBeTruthy();
        expectPageToRemainInteractive();

        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
        expect(document.activeElement).toBe(trigger);
        expectPageToRemainInteractive();

        await user.click(trigger);
        await user.click(await screen.findByRole('menuitem', { name: 'Institutions' }));

        await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
        expectPageToRemainInteractive();
    });
});
