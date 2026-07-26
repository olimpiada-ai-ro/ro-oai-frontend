import { describe, expect, it } from 'vitest';

import {
    getHeaderNavigationGroups,
    isHeaderRouteActive,
    normalizeHeaderPath,
} from '@/components/header-navigation';

describe('header navigation routing', () => {
    it.each([
        ['/ro/problems', '/problems'],
        ['/en/problems/42', '/problems/42'],
        ['/ar/leaderboard?tab=institutions', '/leaderboard'],
        ['/he/achievements/#progress', '/achievements'],
        ['/ro', '/'],
    ])('normalizes %s to %s', (pathname, expected) => {
        expect(normalizeHeaderPath(pathname)).toBe(expected);
    });

    it('matches exact destinations and their nested detail routes', () => {
        expect(isHeaderRouteActive('/ro/problems', '/problems')).toBe(true);
        expect(isHeaderRouteActive('/ro/problems/42/submissions', '/problems')).toBe(true);
    });

    it('does not match destinations that merely share a text prefix', () => {
        expect(isHeaderRouteActive('/ro/problems-archive', '/problems')).toBe(false);
    });

    it('only marks the logo current on the localized homepage', () => {
        expect(isHeaderRouteActive('/ro', '/')).toBe(true);
        expect(isHeaderRouteActive('/ro/problems', '/')).toBe(false);
    });

    it('promotes leaderboard into primary navigation without an overflow duplicate', () => {
        const groups = getHeaderNavigationGroups(false);

        expect(groups.primary).toEqual(['/problems', '/competitions', '/articles', '/leaderboard']);
        expect(groups.directory).toEqual([
            '/roadmap',
            '/institutions',
            '/countries',
            '/achievements',
        ]);
        expect(groups.directory).not.toContain('/leaderboard');
        expect(groups.mobile.filter((href) => href === '/leaderboard')).toHaveLength(1);
    });

    it('keeps leaderboard primary during an ongoing competition', () => {
        const groups = getHeaderNavigationGroups(true);

        expect(groups.primary).toEqual(['/competitions', '/leaderboard', '/articles']);
        expect(groups.directory).not.toContain('/leaderboard');
    });
});
