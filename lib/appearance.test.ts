import { describe, expect, it } from 'vitest';

import {
    createAppearanceBootstrapScript,
    DEFAULT_APPEARANCE,
    normalizeAppearance,
    normalizeColorMode,
    normalizeInterfaceTheme,
    readStoredAnonymousAppearance,
    resolveColorMode,
} from '@/lib/appearance';

describe('appearance preferences', () => {
    it('keeps canonical interface themes and color modes', () => {
        expect(normalizeInterfaceTheme('onia-v1')).toBe('onia-v1');
        expect(normalizeInterfaceTheme('onia-v2')).toBe('onia-v2');
        expect(normalizeInterfaceTheme('plain')).toBe('plain');
        expect(normalizeColorMode('system')).toBe('system');
        expect(normalizeColorMode('light')).toBe('light');
        expect(normalizeColorMode('dark')).toBe('dark');
    });

    it('falls back safely for missing and future values', () => {
        expect(normalizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
        expect(normalizeAppearance({ uiTheme: 'future', colorMode: 'sepia' })).toEqual(
            DEFAULT_APPEARANCE,
        );
    });

    it('normalizes each preference independently', () => {
        expect(normalizeAppearance({ uiTheme: 'onia-v1', colorMode: 'invalid' })).toEqual({
            uiTheme: 'onia-v1',
            colorMode: 'system',
        });
    });

    it('resolves system mode from the operating-system preference', () => {
        expect(resolveColorMode('system', true)).toBe('dark');
        expect(resolveColorMode('system', false)).toBe('light');
        expect(resolveColorMode('light', true)).toBe('light');
        expect(resolveColorMode('dark', false)).toBe('dark');
    });

    it('allowlists anonymous values read from storage', () => {
        const values = new Map<string, string>([
            ['mlcompete-interface-theme', 'onia-v1'],
            ['mlcompete-color-mode', 'dark'],
        ]);

        expect(
            readStoredAnonymousAppearance({ getItem: (key) => values.get(key) ?? null }),
        ).toEqual({
            uiTheme: 'onia-v1',
            colorMode: 'dark',
        });
    });

    it('falls back to the previous next-themes key for signed-out users', () => {
        const values = new Map<string, string>([['mlcompete-theme', 'dark']]);

        expect(
            readStoredAnonymousAppearance({ getItem: (key) => values.get(key) ?? null }),
        ).toEqual({
            uiTheme: 'onia-v2',
            colorMode: 'dark',
        });
    });

    it('prefers the new color-mode key over the legacy value', () => {
        const values = new Map<string, string>([
            ['mlcompete-color-mode', 'system'],
            ['mlcompete-theme', 'dark'],
        ]);

        expect(
            readStoredAnonymousAppearance({ getItem: (key) => values.get(key) ?? null }),
        ).toEqual({
            uiTheme: 'onia-v2',
            colorMode: 'system',
        });
    });

    it('bootstraps an anonymous saved appearance before hydration', () => {
        window.localStorage.setItem('mlcompete-interface-theme', 'onia-v1');
        window.localStorage.setItem('mlcompete-color-mode', 'dark');
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: () => ({ matches: false }),
        });

        window.eval(createAppearanceBootstrapScript(DEFAULT_APPEARANCE, false));

        expect(document.documentElement.dataset.interfaceTheme).toBe('onia-v1');
        expect(document.documentElement.dataset.colorMode).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('bootstraps every known interface theme and ignores unknown ones', () => {
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: () => ({ matches: false }),
        });

        window.localStorage.setItem('mlcompete-interface-theme', 'plain');
        window.eval(createAppearanceBootstrapScript(DEFAULT_APPEARANCE, false));
        expect(document.documentElement.dataset.interfaceTheme).toBe('plain');

        window.localStorage.setItem('mlcompete-interface-theme', 'unknown-theme');
        window.eval(createAppearanceBootstrapScript(DEFAULT_APPEARANCE, false));
        expect(document.documentElement.dataset.interfaceTheme).toBe(DEFAULT_APPEARANCE.uiTheme);
    });

    it('keeps authenticated database preferences authoritative during bootstrap', () => {
        window.localStorage.setItem('mlcompete-interface-theme', 'onia-v1');
        window.localStorage.setItem('mlcompete-color-mode', 'dark');
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: () => ({ matches: false }),
        });

        window.eval(
            createAppearanceBootstrapScript({ uiTheme: 'onia-v2', colorMode: 'light' }, true),
        );

        expect(document.documentElement.dataset.interfaceTheme).toBe('onia-v2');
        expect(document.documentElement.dataset.colorMode).toBe('light');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
});
