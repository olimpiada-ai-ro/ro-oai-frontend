'use client';

import { LayoutTemplate, MonitorIcon, MoonIcon, Sparkles, SunIcon, Terminal } from 'lucide-react';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEffect, useState } from 'react';
import { analytics, AnalyticsEvents } from '@/lib/analytics';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
    headerControlClassName,
    headerMenuItemClassName,
    headerMenuSurfaceClassName,
} from '@/components/header-styles';
import { useAppearance } from '@/components/providers/appearance-provider';
import { isColorMode, isInterfaceTheme } from '@/lib/appearance';
import { toast } from '@/components/ui/sonner';

type ThemeToggleProps = {
    className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
    const t = useTranslations('settings');
    const locale = useLocale();
    const direction = locale === 'ar' || locale === 'he' ? 'rtl' : 'ltr';
    const { uiTheme, colorMode, resolvedColorMode, setInterfaceTheme, setColorMode, syncStatus } =
        useAppearance();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const trackAppearanceChange = (dimension: 'uiTheme' | 'colorMode', nextValue: string) => {
        try {
            analytics.trackEvent({
                name: AnalyticsEvents.THEME_CHANGE,
                properties: {
                    dimension,
                    fromTheme: dimension === 'uiTheme' ? uiTheme : colorMode,
                    toTheme: nextValue,
                    timestamp: new Date().toISOString(),
                },
            });
        } catch (error) {
            console.error('[Analytics] Failed to track theme change:', error);
        }
    };

    const persistInterfaceTheme = async (value: string) => {
        if (!isInterfaceTheme(value)) return;
        trackAppearanceChange('uiTheme', value);
        if (!(await setInterfaceTheme(value))) toast.error(t('appearanceSaveError'));
    };

    const persistColorMode = async (value: string) => {
        if (!isColorMode(value)) return;
        trackAppearanceChange('colorMode', value);
        if (!(await setColorMode(value))) toast.error(t('appearanceSaveError'));
    };

    if (!mounted) {
        return (
            <button
                type="button"
                className={cn(headerControlClassName, className)}
                aria-label={t('appearanceMenuLabel')}
                disabled
            >
                <SunIcon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
                <span className="sr-only">{t('appearanceMenuLabel')}</span>
            </button>
        );
    }

    const colorModeOptions = [
        { value: 'light', label: t('themeLight'), icon: SunIcon },
        { value: 'dark', label: t('themeDark'), icon: MoonIcon },
        { value: 'system', label: t('themeSystem'), icon: MonitorIcon },
    ] as const;
    const interfaceThemeOptions = [
        { value: 'onia-v2', label: t('oniaV2Name'), icon: Sparkles },
        { value: 'onia-v1', label: t('oniaV1Name'), icon: LayoutTemplate },
        { value: 'plain', label: t('plainName'), icon: Terminal },
    ] as const;
    const CurrentThemeIcon = resolvedColorMode === 'dark' ? MoonIcon : SunIcon;

    return (
        <DropdownMenu modal={false} dir={direction}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={cn(headerControlClassName, className)}
                    aria-label={t('appearanceMenuLabel')}
                >
                    <CurrentThemeIcon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
                    <span className="sr-only">{t('appearanceMenuLabel')}</span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                sideOffset={10}
                className={cn('w-64 p-2 font-sans', headerMenuSurfaceClassName)}
            >
                <DropdownMenuLabel className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-[0.1em] text-[var(--header-menu-muted)]">
                    {t('interfaceStyleLabel')}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                    value={uiTheme}
                    onValueChange={(value) => void persistInterfaceTheme(value)}
                >
                    {interfaceThemeOptions.map((option) => {
                        const Icon = option.icon;
                        return (
                            <DropdownMenuRadioItem
                                key={option.value}
                                value={option.value}
                                disabled={syncStatus === 'saving'}
                                className={cn(headerMenuItemClassName, 'gap-3 ps-8')}
                            >
                                <Icon className="h-4 w-4" aria-hidden="true" />
                                <span>{option.label}</span>
                            </DropdownMenuRadioItem>
                        );
                    })}
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator className="mx-1 my-2 bg-[var(--header-menu-separator)]" />
                <DropdownMenuLabel className="px-3 pb-1 pt-1 text-xs font-bold uppercase tracking-[0.1em] text-[var(--header-menu-muted)]">
                    {t('colorModeLabel')}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                    value={colorMode}
                    onValueChange={(value) => void persistColorMode(value)}
                >
                    {colorModeOptions.map((option) => {
                        const Icon = option.icon;
                        return (
                            <DropdownMenuRadioItem
                                key={option.value}
                                value={option.value}
                                disabled={syncStatus === 'saving'}
                                className={cn(headerMenuItemClassName, 'gap-3 ps-8')}
                            >
                                <Icon className="h-4 w-4" aria-hidden="true" />
                                <span>{option.label}</span>
                            </DropdownMenuRadioItem>
                        );
                    })}
                </DropdownMenuRadioGroup>

                {syncStatus === 'error' ? (
                    <p className="mx-1 mt-2 border-t border-[var(--header-menu-separator)] px-2 pt-2 text-xs leading-5 text-red-700 dark:text-red-300">
                        {t('appearanceSaveError')}
                    </p>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
