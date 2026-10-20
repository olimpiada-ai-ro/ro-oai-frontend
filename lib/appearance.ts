export const INTERFACE_THEMES = ['onia-v2', 'onia-v1', 'plain'] as const;
export const COLOR_MODES = ['system', 'light', 'dark'] as const;

export type InterfaceTheme = (typeof INTERFACE_THEMES)[number];
export type ColorMode = (typeof COLOR_MODES)[number];
export type ResolvedColorMode = Exclude<ColorMode, 'system'>;

export type AppearancePreferences = {
    uiTheme: InterfaceTheme;
    colorMode: ColorMode;
};

export type AppearancePreferencesUpdate = Partial<AppearancePreferences>;

export const DEFAULT_INTERFACE_THEME: InterfaceTheme = 'onia-v2';
export const DEFAULT_COLOR_MODE: ColorMode = 'system';
export const DEFAULT_APPEARANCE: AppearancePreferences = {
    uiTheme: DEFAULT_INTERFACE_THEME,
    colorMode: DEFAULT_COLOR_MODE,
};

export const INTERFACE_THEME_STORAGE_KEY = 'mlcompete-interface-theme';
export const COLOR_MODE_STORAGE_KEY = 'mlcompete-color-mode';
export const LEGACY_COLOR_MODE_STORAGE_KEY = 'mlcompete-theme';

export function isInterfaceTheme(value: unknown): value is InterfaceTheme {
    return typeof value === 'string' && INTERFACE_THEMES.includes(value as InterfaceTheme);
}

export function isColorMode(value: unknown): value is ColorMode {
    return typeof value === 'string' && COLOR_MODES.includes(value as ColorMode);
}

export function normalizeInterfaceTheme(value: unknown): InterfaceTheme {
    return isInterfaceTheme(value) ? value : DEFAULT_INTERFACE_THEME;
}

export function normalizeColorMode(value: unknown): ColorMode {
    return isColorMode(value) ? value : DEFAULT_COLOR_MODE;
}

export function normalizeAppearance(value: unknown): AppearancePreferences {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { ...DEFAULT_APPEARANCE };
    }

    const candidate = value as Record<string, unknown>;
    return {
        uiTheme: normalizeInterfaceTheme(candidate.uiTheme),
        colorMode: normalizeColorMode(candidate.colorMode),
    };
}

export function resolveColorMode(colorMode: ColorMode, prefersDark: boolean): ResolvedColorMode {
    if (colorMode === 'system') return prefersDark ? 'dark' : 'light';
    return colorMode;
}

export function readStoredAnonymousAppearance(
    storage: Pick<Storage, 'getItem'>,
): AppearancePreferences {
    const storedColorMode = storage.getItem(COLOR_MODE_STORAGE_KEY);

    return {
        uiTheme: normalizeInterfaceTheme(storage.getItem(INTERFACE_THEME_STORAGE_KEY)),
        colorMode: isColorMode(storedColorMode)
            ? storedColorMode
            : normalizeColorMode(storage.getItem(LEGACY_COLOR_MODE_STORAGE_KEY)),
    };
}

export function createAppearanceBootstrapScript(
    initialPreferences: AppearancePreferences,
    authenticated: boolean,
): string {
    const safeInitial = normalizeAppearance(initialPreferences);

    return `(function(){try{var d=document.documentElement,t=${JSON.stringify(
        safeInitial.uiTheme,
    )},m=${JSON.stringify(safeInitial.colorMode)};if(!${JSON.stringify(
        authenticated,
    )}){var st=localStorage.getItem(${JSON.stringify(
        INTERFACE_THEME_STORAGE_KEY,
    )}),sm=localStorage.getItem(${JSON.stringify(
        COLOR_MODE_STORAGE_KEY,
    )});if(sm!=='system'&&sm!=='light'&&sm!=='dark')sm=localStorage.getItem(${JSON.stringify(
        LEGACY_COLOR_MODE_STORAGE_KEY,
    )});if(${JSON.stringify(INTERFACE_THEMES)}.indexOf(st)>=0)t=st;if(sm==='system'||sm==='light'||sm==='dark')m=sm;}var x=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);d.dataset.interfaceTheme=t;d.dataset.colorMode=m;d.classList.toggle('dark',x);d.style.colorScheme=x?'dark':'light';}catch(e){}})();`;
}
