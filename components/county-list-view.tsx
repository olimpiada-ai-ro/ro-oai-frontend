'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Building2, ChevronRight, MapPin, Search, Users } from 'lucide-react';

import { PlatformEmptyState } from '@/components/platform-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Link } from '@/i18n/routing';
import { getCounties, getCountryCounties } from '@/lib/api';
import type { CountyResponse } from '@/lib/types';

function normalizeSearchValue(value: string, locale: string) {
    return value
        .normalize('NFD')
        .replace(/\p{Mark}/gu, '')
        .toLocaleLowerCase(locale)
        .trim();
}

interface CountyListViewProps {
    countryCode?: string;
}

export function CountyListView({ countryCode }: CountyListViewProps = {}) {
    const t = useTranslations();
    const locale = useLocale();
    const { toast } = useToast();
    const [counties, setCounties] = useState<CountyResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        let active = true;

        async function loadCounties() {
            setLoading(true);
            setLoadFailed(false);

            try {
                const data = countryCode
                    ? await getCountryCounties(countryCode, true)
                    : await getCounties(true);
                if (active) {
                    setCounties(data.filter((county) => county.code !== 'XX'));
                }
            } catch (error) {
                if (!active) return;

                console.error('Failed to load counties:', error);
                setLoadFailed(true);
                setCounties([]);
                toast({
                    title: t('counties.error'),
                    description: t('counties.loadError'),
                    variant: 'destructive',
                });
            } finally {
                if (active) setLoading(false);
            }
        }

        void loadCounties();

        return () => {
            active = false;
        };
    }, [countryCode, reloadKey, t, toast]);

    const filteredCounties = useMemo(() => {
        const collator = new Intl.Collator(locale, { sensitivity: 'base' });
        const normalizedQuery = normalizeSearchValue(searchQuery, locale);

        return counties
            .filter((county) => {
                if (!normalizedQuery) return true;
                return (
                    normalizeSearchValue(county.name, locale).includes(normalizedQuery) ||
                    normalizeSearchValue(county.code, locale).includes(normalizedQuery)
                );
            })
            .sort((first, second) => collator.compare(first.name, second.name));
    }, [counties, locale, searchQuery]);

    const countyGroups = useMemo(() => {
        const groups = new Map<string, CountyResponse[]>();

        for (const county of filteredCounties) {
            const letter = county.name.trim().charAt(0).toLocaleUpperCase(locale) || '#';
            const group = groups.get(letter) ?? [];
            group.push(county);
            groups.set(letter, group);
        }

        return Array.from(groups.entries());
    }, [filteredCounties, locale]);

    const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

    return (
        <section className="mt-8" aria-labelledby="county-results-count">
            <div className="platform-toolbar px-4 py-5 sm:px-6">
                <div className="max-w-2xl space-y-2">
                    <label
                        htmlFor="county-search"
                        className="block text-sm font-semibold text-[var(--platform-ink-muted-strong)]"
                    >
                        {t('counties.searchPlaceholder')}
                    </label>
                    <div className="relative">
                        <Search
                            className="pointer-events-none absolute top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--platform-ink-muted)] [inset-inline-start:0.875rem]"
                            aria-hidden="true"
                        />
                        <Input
                            id="county-search"
                            type="search"
                            placeholder={t('counties.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] ps-10 text-[var(--platform-ink)] focus-visible:scale-100 focus-visible:ring-[var(--platform-violet)]"
                        />
                    </div>
                </div>
            </div>

            <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-5">
                <p
                    id="county-results-count"
                    className="font-semibold text-[var(--platform-ink-muted-strong)]"
                    aria-live="polite"
                >
                    {loadFailed
                        ? t('counties.loadError')
                        : loading && counties.length === 0
                          ? t('common.loading')
                          : t('counties.resultsCount', { count: filteredCounties.length })}
                </p>
                {loading && counties.length > 0 ? (
                    <span className="text-sm text-[var(--platform-ink-muted)]" role="status">
                        {t('common.loading')}
                    </span>
                ) : null}
            </div>

            {loading && counties.length === 0 ? (
                <CountyRegistrySkeleton />
            ) : loadFailed ? (
                <PlatformEmptyState
                    icon={MapPin}
                    title={t('counties.error')}
                    description={t('counties.loadError')}
                    action={
                        <Button
                            type="button"
                            className="h-11 rounded-none"
                            onClick={() => setReloadKey((key) => key + 1)}
                        >
                            {t('common.retry')}
                        </Button>
                    }
                />
            ) : filteredCounties.length === 0 ? (
                <PlatformEmptyState
                    icon={MapPin}
                    title={t('counties.noResults')}
                    description={t('counties.noResultsDescription')}
                />
            ) : (
                <div className="columns-1 gap-x-10 md:columns-2 xl:columns-3">
                    {countyGroups.map(([letter, group], groupIndex) => {
                        const headingId = `county-group-${groupIndex}`;

                        return (
                            <section
                                key={letter}
                                aria-labelledby={headingId}
                                className="mb-9 inline-block w-full break-inside-avoid"
                            >
                                <h2
                                    id={headingId}
                                    className="mb-3 grid h-10 w-10 place-items-center bg-[var(--platform-citron)] text-lg font-bold text-[var(--platform-on-accent)] shadow-[4px_4px_0_var(--platform-violet)]"
                                >
                                    {letter}
                                </h2>
                                <ul className="border-t border-[var(--platform-line-strong)]">
                                    {group.map((county) => (
                                        <li
                                            key={county.id}
                                            className="border-b border-[var(--platform-line)]"
                                        >
                                            <Link
                                                href={
                                                    countryCode
                                                        ? `/countries/${countryCode}/counties/${county.id}`
                                                        : `/counties/${county.id}`
                                                }
                                                className="group flex min-h-16 items-center gap-3 px-2 py-3 text-[var(--platform-ink)] transition-colors hover:bg-[var(--platform-paper-strong)]"
                                            >
                                                <span className="min-w-0 flex-1">
                                                    <span
                                                        className="block truncate font-semibold group-hover:text-[var(--platform-violet)]"
                                                        dir="auto"
                                                    >
                                                        {county.name}
                                                    </span>
                                                    {county.statistics ? (
                                                        <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--platform-ink-muted)]">
                                                            <span className="inline-flex items-center gap-1">
                                                                <Users
                                                                    className="h-3.5 w-3.5"
                                                                    aria-hidden="true"
                                                                />
                                                                <span className="sr-only">
                                                                    {t('counties.totalUsers')}:{' '}
                                                                </span>
                                                                {numberFormatter.format(
                                                                    county.statistics.totalUsers,
                                                                )}
                                                            </span>
                                                            <span className="inline-flex items-center gap-1">
                                                                <Building2
                                                                    className="h-3.5 w-3.5"
                                                                    aria-hidden="true"
                                                                />
                                                                <span className="sr-only">
                                                                    {t(
                                                                        'counties.totalInstitutions',
                                                                    )}
                                                                    :{' '}
                                                                </span>
                                                                {numberFormatter.format(
                                                                    county.statistics
                                                                        .totalInstitutions,
                                                                )}
                                                            </span>
                                                        </span>
                                                    ) : null}
                                                </span>
                                                <span className="shrink-0 font-mono text-xs font-semibold text-[var(--platform-ink-muted)]">
                                                    {county.code}
                                                </span>
                                                <ChevronRight
                                                    className="h-4 w-4 shrink-0 text-[var(--platform-ink-muted)] rtl-flip"
                                                    aria-hidden="true"
                                                />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

function CountyRegistrySkeleton() {
    return (
        <div className="columns-1 gap-x-10 md:columns-2 xl:columns-3" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, groupIndex) => (
                <div key={groupIndex} className="mb-9 inline-block w-full break-inside-avoid">
                    <Skeleton className="mb-3 h-10 w-10 rounded-none bg-[var(--platform-citron)] motion-reduce:animate-none" />
                    <div className="border-t border-[var(--platform-line-strong)]">
                        {Array.from({ length: 3 }).map((_, rowIndex) => (
                            <div
                                key={rowIndex}
                                className="flex min-h-16 items-center justify-between gap-4 border-b border-[var(--platform-line)] py-3"
                            >
                                <Skeleton className="h-4 w-36 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                                <Skeleton className="h-4 w-8 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
