'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import {
    BookOpenCheck,
    Building2,
    ChevronDown,
    ChevronRight,
    Crown,
    Globe2,
    LayoutGrid,
    ListChecks,
    Medal,
    Menu,
    Newspaper,
    Trophy,
    X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { useCompetitionData } from '@/components/competition-data-provider';
import {
    headerActiveControlClassName,
    headerControlClassName,
    headerMenuItemClassName,
    headerMenuSurfaceClassName,
} from '@/components/header-styles';
import {
    getHeaderNavigationGroups,
    isHeaderRouteActive,
    type HeaderNavigationHref,
} from '@/components/header-navigation';
import { LanguageSelector } from '@/components/language-selector';
import { NotificationBadge } from '@/components/notification-badge';
import { ThemeToggle } from '@/components/theme-toggle';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Link, usePathname } from '@/i18n/routing';
import { platformSans } from '@/lib/platform-fonts';
import { cn } from '@/lib/utils';

const UserDropdown = dynamic(
    () => import('@/components/user-dropdown').then((mod) => mod.UserDropdown),
    { ssr: false },
);

type NavigationItem = {
    href: string;
    label: string;
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
};

const RTL_LOCALES = new Set(['ar', 'he']);

function HeaderLogo({ compact = false }: { compact?: boolean }) {
    return (
        <span className={cn('relative block', compact ? 'w-[8.25rem]' : 'w-[9.75rem]')}>
            <Image
                src="/logo.png"
                alt=""
                width={174}
                height={40}
                className="h-auto w-full dark:hidden"
                priority
                loading="eager"
            />
            <Image
                src="/logo-dark.png"
                alt=""
                width={174}
                height={40}
                className="hidden h-auto w-full dark:block"
                priority
                loading="eager"
            />
        </span>
    );
}

function DesktopNavigationLink({
    item,
    active,
    destination,
}: {
    item: NavigationItem;
    active: boolean;
    destination: string;
}) {
    const Icon = item.icon;

    return (
        <Link
            href={destination}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'inline-flex h-10 shrink-0 items-center gap-2 rounded-sm border px-2.5 text-[0.8125rem] font-semibold leading-none tracking-[-0.01em] transition-colors duration-150',
                'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--header-focus)]',
                active
                    ? 'border-[var(--header-accent)] bg-[var(--header-selected)] text-[var(--header-selected-ink)] shadow-[var(--header-active-shadow)]'
                    : 'border-transparent text-[var(--header-ink-muted-strong)] hover:border-[var(--header-line)] hover:bg-[var(--header-surface-strong)] hover:text-[var(--header-accent-strong)]',
            )}
        >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{item.label}</span>
        </Link>
    );
}

function PlatformDirectory({
    items,
    pathname,
    destinationFor,
    label,
    appName,
}: {
    items: NavigationItem[];
    pathname: string;
    destinationFor: (href: string) => string;
    label: string;
    appName: string;
}) {
    const [open, setOpen] = useState(false);
    const activeItem = items.find((item) => isHeaderRouteActive(pathname, item.href));

    return (
        <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-sm border px-2.5 text-[0.8125rem] font-semibold leading-none transition-colors duration-150',
                        headerControlClassName,
                        'w-auto min-w-10',
                        activeItem && headerActiveControlClassName,
                    )}
                    aria-label={label}
                    aria-expanded={open}
                >
                    <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden xl:inline">{activeItem?.label ?? label}</span>
                    <ChevronDown
                        className={cn(
                            'hidden h-3.5 w-3.5 transition-transform duration-150 xl:block',
                            open && 'rotate-180',
                        )}
                        aria-hidden="true"
                    />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                sideOffset={10}
                className={cn('w-72 p-2', headerMenuSurfaceClassName, platformSans.className)}
            >
                <DropdownMenuLabel className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--header-menu-muted)]">
                    {appName}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="mx-0 mb-1 bg-[var(--header-menu-separator)]" />
                {items.map((item) => {
                    const Icon = item.icon;
                    const active = isHeaderRouteActive(pathname, item.href);

                    return (
                        <DropdownMenuItem key={item.href} asChild>
                            <Link
                                href={destinationFor(item.href)}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    headerMenuItemClassName,
                                    'group flex items-center gap-3',
                                    active &&
                                        'border-[var(--header-accent)] bg-[var(--header-selected)] text-[var(--header-selected-ink)] focus:bg-[var(--header-selected)] focus:text-[var(--header-selected-ink)]',
                                )}
                            >
                                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                <span className="min-w-0 flex-1 font-semibold">{item.label}</span>
                                <ChevronRight
                                    className="h-4 w-4 shrink-0 opacity-45 rtl:rotate-180"
                                    aria-hidden="true"
                                />
                            </Link>
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function MobileNavigationLink({
    item,
    active,
    destination,
    onNavigate,
}: {
    item: NavigationItem;
    active: boolean;
    destination: string;
    onNavigate: () => void;
}) {
    const Icon = item.icon;

    return (
        <Link
            href={destination}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(
                'group flex min-h-14 items-center gap-3 rounded-sm border px-3 py-2.5 text-sm transition-colors duration-150',
                'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--header-focus)]',
                active
                    ? 'border-[var(--header-accent)] bg-[var(--header-selected)] text-[var(--header-selected-ink)] shadow-[var(--header-active-shadow)]'
                    : 'border-[var(--header-line)] bg-[var(--header-surface)] text-[var(--header-ink-muted-strong)] hover:border-[var(--header-accent)] hover:bg-[var(--header-surface-strong)]',
            )}
        >
            <span
                className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border',
                    active
                        ? 'border-[var(--header-accent)] bg-[var(--header-surface)]'
                        : 'border-[var(--header-line)] bg-[var(--header-surface-strong)]',
                )}
            >
                <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 font-semibold">{item.label}</span>
            <ChevronRight
                className="h-4 w-4 shrink-0 opacity-45 rtl:rotate-180"
                aria-hidden="true"
            />
        </Link>
    );
}

export function Header() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const locale = useLocale();
    const t = useTranslations();
    const { authenticated, isProfileConfirmed, isAnyCompetitionOngoing } = useCompetitionData();

    const isUsernameMissing = authenticated && !isProfileConfirmed;
    const isRtl = RTL_LOCALES.has(locale);
    const isAccountRoute = [
        '/profile',
        '/settings',
        '/my-questions',
        '/writing',
        '/problem-proposals',
        '/my-competitions',
    ].some((href) => isHeaderRouteActive(pathname, href));

    const { primaryItems, directoryItems, allItems } = useMemo(() => {
        const itemsByHref: Record<HeaderNavigationHref, NavigationItem> = {
            '/problems': {
                href: '/problems',
                label: t('navigation.problems'),
                icon: ListChecks,
            },
            '/competitions': {
                href: '/competitions',
                label: t('navigation.competitions'),
                icon: Trophy,
            },
            '/leaderboard': {
                href: '/leaderboard',
                label: t('navigation.leaderboard'),
                icon: Crown,
            },
            '/articles': {
                href: '/articles',
                label: t('navigation.articles'),
                icon: Newspaper,
            },
            '/roadmap': {
                href: '/roadmap',
                label: t('navigation.roadmap'),
                icon: BookOpenCheck,
            },
            '/institutions': {
                href: '/institutions',
                label: t('navigation.institutions'),
                icon: Building2,
            },
            '/countries': {
                href: '/countries',
                label: t('countries.title'),
                icon: Globe2,
            },
            '/achievements': {
                href: '/achievements',
                label: t('navigation.achievements'),
                icon: Medal,
            },
        };
        const groups = getHeaderNavigationGroups(isAnyCompetitionOngoing);

        return {
            primaryItems: groups.primary.map((href) => itemsByHref[href]),
            directoryItems: groups.directory.map((href) => itemsByHref[href]),
            allItems: groups.mobile.map((href) => itemsByHref[href]),
        };
    }, [isAnyCompetitionOngoing, t]);

    const destinationFor = (href: string) => (isUsernameMissing ? '/profile/confirm' : href);

    return (
        <header
            className={cn(
                'site-header sticky top-0 z-40 isolate border-b-2 border-[var(--header-accent)] bg-[var(--header-surface)] text-[var(--header-ink)]',
                platformSans.variable,
                platformSans.className,
            )}
        >
            <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-2 px-3 sm:px-5 lg:h-[4.5rem] lg:gap-3 lg:px-6">
                <Link
                    href={destinationFor('/')}
                    aria-label={t('common.appName')}
                    aria-current={isHeaderRouteActive(pathname, '/') ? 'page' : undefined}
                    className="flex min-h-11 shrink-0 items-center rounded-sm focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-[var(--header-focus)]"
                >
                    <HeaderLogo compact />
                </Link>

                <nav
                    aria-label={t('common.appName')}
                    className="ms-auto hidden min-w-0 items-center gap-1 lg:flex"
                >
                    {primaryItems.map((item) => (
                        <DesktopNavigationLink
                            key={item.href}
                            item={item}
                            active={isHeaderRouteActive(pathname, item.href)}
                            destination={destinationFor(item.href)}
                        />
                    ))}
                    <PlatformDirectory
                        items={directoryItems}
                        pathname={pathname}
                        destinationFor={destinationFor}
                        label={t('header.openMenu')}
                        appName={t('common.appName')}
                    />
                </nav>

                <div className="ms-auto flex shrink-0 items-center gap-1 lg:ms-0 lg:border-s lg:border-[var(--header-line)] lg:ps-3">
                    <div className="hidden items-center gap-1 lg:flex">
                        <LanguageSelector className={headerControlClassName} />
                        <ThemeToggle className={headerControlClassName} />
                    </div>
                    <NotificationBadge
                        className={cn(
                            headerControlClassName,
                            'h-11 w-11 min-h-11 min-w-11 lg:h-10 lg:w-10 lg:min-h-10 lg:min-w-10',
                        )}
                    />
                    <UserDropdown
                        className={cn(
                            headerControlClassName,
                            'h-11 w-11 min-h-11 min-w-11 lg:h-10 lg:w-10 lg:min-h-10 lg:min-w-10',
                            isAccountRoute && headerActiveControlClassName,
                        )}
                    />

                    <Sheet open={isOpen} onOpenChange={setIsOpen}>
                        <SheetTrigger asChild>
                            <button
                                type="button"
                                className={cn(
                                    headerControlClassName,
                                    'ms-0.5 flex h-11 w-11 min-h-11 min-w-11 items-center justify-center lg:hidden',
                                    isOpen && headerActiveControlClassName,
                                )}
                                aria-label={t('header.openMenu')}
                            >
                                <Menu className="h-5 w-5" aria-hidden="true" />
                            </button>
                        </SheetTrigger>
                        <SheetContent
                            side={isRtl ? 'left' : 'right'}
                            closeLabel={t('common.close')}
                            className={cn(
                                'site-mobile-menu !flex !w-[min(100vw,26rem)] max-w-none flex-col gap-0 overflow-hidden border-[var(--header-accent)] bg-[var(--header-surface)] p-0 text-[var(--header-ink)] shadow-none [&>button:last-child]:hidden',
                                platformSans.className,
                            )}
                        >
                            <SheetHeader className="border-b-2 border-[var(--header-accent)] px-4 py-4 text-start">
                                <div className="flex min-h-11 items-center justify-between gap-4">
                                    <SheetTitle className="min-w-0">
                                        <Link
                                            href={destinationFor('/')}
                                            aria-label={t('common.appName')}
                                            onClick={() => setIsOpen(false)}
                                            className="flex min-h-11 items-center rounded-sm focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-[var(--header-focus)]"
                                        >
                                            <HeaderLogo />
                                        </Link>
                                    </SheetTitle>
                                    <SheetDescription className="sr-only">
                                        {t('header.openMenu')}
                                    </SheetDescription>
                                    <SheetClose asChild>
                                        <button
                                            type="button"
                                            className={cn(
                                                headerControlClassName,
                                                'flex h-11 w-11 min-h-11 min-w-11 items-center justify-center',
                                            )}
                                            aria-label={t('header.closeMenu')}
                                        >
                                            <X className="h-5 w-5" aria-hidden="true" />
                                        </button>
                                    </SheetClose>
                                </div>
                            </SheetHeader>

                            <nav
                                aria-label={t('common.appName')}
                                className="flex-1 overflow-y-auto overscroll-contain px-4 py-5"
                            >
                                <div className="flex flex-col gap-2">
                                    {allItems.map((item) => (
                                        <MobileNavigationLink
                                            key={item.href}
                                            item={item}
                                            active={isHeaderRouteActive(pathname, item.href)}
                                            destination={destinationFor(item.href)}
                                            onNavigate={() => setIsOpen(false)}
                                        />
                                    ))}
                                </div>
                            </nav>

                            <div className="border-t border-[var(--header-line)] bg-[var(--header-surface-strong)] px-4 py-4">
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="flex min-h-12 items-center justify-between gap-3 rounded-sm border border-[var(--header-line)] bg-[var(--header-surface)] ps-3">
                                        <span className="text-xs font-semibold text-[var(--header-menu-muted)]">
                                            {t('header.changeLanguage')}
                                        </span>
                                        <LanguageSelector
                                            className={cn(
                                                headerControlClassName,
                                                'h-11 w-11 min-h-11 min-w-11',
                                            )}
                                            onLocaleChange={() => setIsOpen(false)}
                                        />
                                    </div>
                                    <div className="flex min-h-12 items-center justify-between gap-3 rounded-sm border border-[var(--header-line)] bg-[var(--header-surface)] ps-3">
                                        <span className="text-xs font-semibold text-[var(--header-menu-muted)]">
                                            {t('settings.appearanceMenuLabel')}
                                        </span>
                                        <ThemeToggle
                                            className={cn(
                                                headerControlClassName,
                                                'h-11 w-11 min-h-11 min-w-11',
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}
