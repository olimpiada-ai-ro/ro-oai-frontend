import { SUPPORTED_LOCALES, type Locale } from '@/lib/types';

const LOCALE_PREFIXES = new Set<Locale>(SUPPORTED_LOCALES);

export type HeaderNavigationHref =
    | '/problems'
    | '/competitions'
    | '/leaderboard'
    | '/articles'
    | '/roadmap'
    | '/institutions'
    | '/countries'
    | '/achievements';

export type HeaderNavigationGroups = {
    primary: HeaderNavigationHref[];
    directory: HeaderNavigationHref[];
    mobile: HeaderNavigationHref[];
};

/** Keep engagement destinations visible while reserving the directory for supporting pages. */
export function getHeaderNavigationGroups(
    isAnyCompetitionOngoing: boolean,
): HeaderNavigationGroups {
    const primary: HeaderNavigationHref[] = isAnyCompetitionOngoing
        ? ['/competitions', '/leaderboard', '/articles']
        : ['/problems', '/competitions', '/articles', '/leaderboard'];
    const directory: HeaderNavigationHref[] = [
        '/roadmap',
        '/institutions',
        '/countries',
        '/achievements',
    ];

    return {
        primary,
        directory,
        mobile: [...primary, ...directory],
    };
}

export function normalizeHeaderPath(pathname: string): string {
    const pathnameOnly = pathname.split(/[?#]/, 1)[0] || '/';
    const segments = pathnameOnly.split('/').filter(Boolean);

    if (segments[0] && LOCALE_PREFIXES.has(segments[0] as Locale)) {
        segments.shift();
    }

    return segments.length > 0 ? `/${segments.join('/')}` : '/';
}

/** Treat locale-prefixed detail and tab routes as part of their parent destination. */
export function isHeaderRouteActive(pathname: string, href: string): boolean {
    const normalizedPathname = normalizeHeaderPath(pathname);
    const normalizedHref = normalizeHeaderPath(href);

    if (normalizedHref === '/') {
        return normalizedPathname === '/';
    }

    return (
        normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)
    );
}
