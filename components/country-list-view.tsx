'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Building2, ChevronRight, Globe2, RefreshCw, Search, Users } from 'lucide-react';

import { CountryFlag } from '@/components/country-flag';
import { PlatformEmptyState } from '@/components/platform-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/routing';
import { getCountryOverviews } from '@/lib/api';
import { getCountryDisplayName } from '@/lib/country-display';
import type { CountryOverview } from '@/lib/types';

function normalizeSearchValue(value: string, locale: string) {
    return value
        .normalize('NFD')
        .replace(/\p{Mark}/gu, '')
        .toLocaleLowerCase(locale)
        .trim();
}

export function CountryListView() {
    const t = useTranslations();
    const locale = useLocale();
    const [countries, setCountries] = useState<CountryOverview[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);

    const loadCountries = useCallback(async () => {
        setLoading(true);
        setLoadFailed(false);

        try {
            setCountries(await getCountryOverviews());
        } catch (error) {
            console.error('Failed to load country directory:', error);
            setCountries([]);
            setLoadFailed(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadCountries();
    }, [loadCountries]);

    const filteredCountries = useMemo(() => {
        const collator = new Intl.Collator(locale, { sensitivity: 'base' });
        const normalizedQuery = normalizeSearchValue(searchQuery, locale);

        return countries
            .filter(({ country }) => {
                if (!normalizedQuery) return true;
                const displayName = getCountryDisplayName(country, locale);
                return (
                    normalizeSearchValue(displayName, locale).includes(normalizedQuery) ||
                    normalizeSearchValue(country.code, locale).includes(normalizedQuery)
                );
            })
            .sort((first, second) =>
                collator.compare(
                    getCountryDisplayName(first.country, locale),
                    getCountryDisplayName(second.country, locale),
                ),
            );
    }, [countries, locale, searchQuery]);

    const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

    return (
        <section className="mt-8" aria-labelledby="country-results-count">
            <div className="platform-toolbar px-4 py-5 sm:px-6">
                <div className="max-w-2xl space-y-2">
                    <label
                        htmlFor="country-directory-search"
                        className="block text-sm font-semibold text-[var(--platform-ink-muted-strong)]"
                    >
                        {t('settings.searchCountries')}
                    </label>
                    <div className="relative">
                        <Search
                            className="pointer-events-none absolute top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--platform-ink-muted)] [inset-inline-start:0.875rem]"
                            aria-hidden="true"
                        />
                        <Input
                            id="country-directory-search"
                            type="search"
                            placeholder={t('settings.searchCountries')}
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] ps-10 text-[var(--platform-ink)] focus-visible:scale-100 focus-visible:ring-[var(--platform-violet)]"
                        />
                    </div>
                </div>
            </div>

            <div className="flex min-h-16 items-center py-5">
                <p
                    id="country-results-count"
                    className="font-semibold text-[var(--platform-ink-muted-strong)]"
                    aria-live="polite"
                >
                    {loadFailed
                        ? t('settings.errorLoadingCountries')
                        : loading
                          ? t('common.loading')
                          : t('rankings.resultsCount', { count: filteredCountries.length })}
                </p>
            </div>

            {loading ? (
                <CountryRegistrySkeleton />
            ) : loadFailed ? (
                <PlatformEmptyState
                    icon={Globe2}
                    title={t('common.error')}
                    description={t('settings.errorLoadingCountries')}
                    action={
                        <Button
                            type="button"
                            className="min-h-11 rounded-none px-5"
                            onClick={() => void loadCountries()}
                        >
                            <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
                            {t('common.retry')}
                        </Button>
                    }
                />
            ) : filteredCountries.length === 0 ? (
                <PlatformEmptyState
                    icon={Globe2}
                    title={t('settings.noCountryFound')}
                    description={t('counties.noResultsDescription')}
                />
            ) : (
                <ol className="platform-panel divide-y divide-[var(--platform-line)] overflow-hidden">
                    {filteredCountries.map(({ country, statistics }) => {
                        const countryName = getCountryDisplayName(country, locale);

                        return (
                            <li key={country.code}>
                                <Link
                                    href={`/countries/${country.code}`}
                                    className="group grid min-h-20 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-[var(--platform-ink)] outline-none transition-colors hover:bg-[var(--platform-paper-strong)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--platform-violet)] sm:grid-cols-[2rem_minmax(0,1fr)_10rem_10rem_auto] sm:gap-4 sm:px-6"
                                >
                                    <CountryFlag
                                        countryCode={country.code}
                                        countryName={countryName}
                                        size="md"
                                        decorative
                                        className="shrink-0"
                                    />
                                    <span className="min-w-0">
                                        <span
                                            className="block truncate font-semibold group-hover:text-[var(--platform-violet)] group-hover:underline"
                                            dir="auto"
                                        >
                                            {countryName}
                                        </span>
                                        <span className="mt-1 block font-mono text-xs font-semibold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                                            {country.code}
                                        </span>
                                        <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--platform-ink-muted)] sm:hidden">
                                            <CountryCount
                                                icon={Building2}
                                                label={t('counties.totalInstitutions')}
                                                value={numberFormatter.format(
                                                    statistics.totalInstitutions,
                                                )}
                                            />
                                            <CountryCount
                                                icon={Users}
                                                label={t('counties.totalUsers')}
                                                value={numberFormatter.format(
                                                    statistics.totalUsers,
                                                )}
                                            />
                                        </span>
                                    </span>
                                    <CountryCount
                                        className="hidden sm:flex"
                                        icon={Building2}
                                        label={t('counties.totalInstitutions')}
                                        value={numberFormatter.format(statistics.totalInstitutions)}
                                    />
                                    <CountryCount
                                        className="hidden sm:flex"
                                        icon={Users}
                                        label={t('counties.totalUsers')}
                                        value={numberFormatter.format(statistics.totalUsers)}
                                    />
                                    <ChevronRight
                                        className="h-4 w-4 shrink-0 text-[var(--platform-ink-muted)] rtl-flip"
                                        aria-hidden="true"
                                    />
                                </Link>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}

function CountryRegistrySkeleton() {
    return (
        <div
            className="platform-panel divide-y divide-[var(--platform-line)] overflow-hidden"
            aria-hidden="true"
        >
            {Array.from({ length: 8 }).map((_, index) => (
                <div
                    key={index}
                    className="grid min-h-20 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_10rem_10rem_auto] sm:gap-4 sm:px-6"
                >
                    <Skeleton className="h-6 w-7 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-40 max-w-full rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                        <Skeleton className="h-3 w-8 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                    </div>
                    <Skeleton className="hidden h-8 w-24 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none sm:block" />
                    <Skeleton className="hidden h-8 w-24 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none sm:block" />
                    <Skeleton className="h-4 w-4 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                </div>
            ))}
        </div>
    );
}

function CountryCount({
    className,
    icon: Icon,
    label,
    value,
}: {
    className?: string;
    icon: typeof Users;
    label: string;
    value: string;
}) {
    return (
        <span className={`items-center gap-1.5 ${className ?? 'inline-flex'}`}>
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only">{label}: </span>
            <strong className="font-mono font-semibold tabular-nums text-[var(--platform-ink-muted-strong)]">
                {value}
            </strong>
        </span>
    );
}
