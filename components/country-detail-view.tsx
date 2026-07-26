'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Building2,
    ChevronRight,
    Globe2,
    Home,
    RefreshCw,
    Users,
} from 'lucide-react';

import { CountryFlag } from '@/components/country-flag';
import { CountyListView } from '@/components/county-list-view';
import { InstitutionListView } from '@/components/institution-list-view';
import {
    PlatformEmptyState,
    PlatformPageHeader,
    PlatformSectionHeading,
} from '@/components/platform-page-shell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/routing';
import { getCountryOverview } from '@/lib/api';
import { getCountryDisplayName } from '@/lib/country-display';
import type { CountryOverview } from '@/lib/types';

interface CountryDetailViewProps {
    countryCode: string;
}

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

function isNotFoundError(error: unknown) {
    return error instanceof Error && /not found/i.test(error.message);
}

export function CountryDetailView({ countryCode }: CountryDetailViewProps) {
    const t = useTranslations();
    const locale = useLocale();
    const [overview, setOverview] = useState<CountryOverview | null>(null);
    const [loadState, setLoadState] = useState<LoadState>('loading');
    const [loadError, setLoadError] = useState<string | null>(null);
    const normalizedCountryCode = countryCode.trim().toUpperCase();
    const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

    const loadCountry = useCallback(async () => {
        setLoadState('loading');
        setLoadError(null);

        try {
            const data = await getCountryOverview(normalizedCountryCode);
            setOverview(data);
            setLoadState('ready');
        } catch (error) {
            console.error('Failed to load country:', error);
            setOverview(null);
            if (isNotFoundError(error)) {
                setLoadState('not-found');
                return;
            }

            setLoadError(
                error instanceof Error ? error.message : t('settings.errorLoadingCountries'),
            );
            setLoadState('error');
        }
    }, [normalizedCountryCode, t]);

    useEffect(() => {
        void loadCountry();
    }, [loadCountry]);

    if (loadState === 'loading') {
        return <CountryDetailLoading loadingLabel={t('common.loading')} />;
    }

    if (loadState === 'not-found') {
        return (
            <>
                <PlatformPageHeader
                    eyebrow={t('countries.title')}
                    icon={Globe2}
                    title={t('settings.noCountryFound')}
                    description={t('institutions.description')}
                />
                <PlatformEmptyState
                    className="mt-8"
                    icon={Globe2}
                    title={t('settings.noCountryFound')}
                    action={
                        <Button asChild className="min-h-11 rounded-none px-5">
                            <Link href="/countries">
                                <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
                                {t('countries.title')}
                            </Link>
                        </Button>
                    }
                />
            </>
        );
    }

    if (loadState === 'error' || !overview) {
        return (
            <>
                <PlatformPageHeader
                    eyebrow={t('countries.title')}
                    icon={Globe2}
                    title={t('common.error')}
                    description={t('institutions.description')}
                />
                <PlatformEmptyState
                    className="mt-8"
                    icon={AlertTriangle}
                    title={t('settings.errorLoadingCountries')}
                    description={loadError}
                    action={
                        <div className="flex flex-wrap justify-center gap-3">
                            <Button
                                type="button"
                                className="min-h-11 rounded-none px-5"
                                onClick={() => void loadCountry()}
                            >
                                <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
                                {t('common.retry')}
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                className="min-h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-5"
                            >
                                <Link href="/countries">{t('countries.title')}</Link>
                            </Button>
                        </div>
                    }
                />
            </>
        );
    }

    const { country, statistics, hasCountyBreakdown } = overview;
    const countryName = getCountryDisplayName(country, locale);

    return (
        <>
            <nav
                aria-label={t('countries.title')}
                className="mb-7 flex min-h-11 items-center gap-2 overflow-x-auto text-sm text-[var(--platform-ink-muted)]"
            >
                <Link
                    href="/"
                    aria-label={t('common.appName')}
                    className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center border border-transparent hover:border-[var(--platform-line)] hover:bg-[var(--platform-paper-strong)]"
                >
                    <Home className="h-4 w-4" aria-hidden="true" />
                </Link>
                <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
                <Link
                    href="/countries"
                    className="inline-flex min-h-11 shrink-0 items-center px-2 font-semibold hover:text-[var(--platform-violet)] hover:underline"
                >
                    {t('countries.title')}
                </Link>
                <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
                <span
                    className="truncate font-medium text-[var(--platform-ink)]"
                    aria-current="page"
                    dir="auto"
                >
                    {countryName}
                </span>
            </nav>

            <PlatformPageHeader
                eyebrow={`${t('countries.country')} · ${country.code}`}
                icon={Globe2}
                title={
                    <span className="inline-flex items-center gap-3">
                        <CountryFlag
                            countryCode={country.code}
                            countryName={countryName}
                            size="lg"
                            decorative
                        />
                        <span dir="auto">{countryName}</span>
                    </span>
                }
                description={
                    hasCountyBreakdown ? t('counties.description') : t('institutions.description')
                }
            />

            <dl className="mt-8 grid border-y border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] sm:grid-cols-2">
                <CountryMetric
                    icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
                    label={t('counties.totalInstitutions')}
                    value={numberFormatter.format(statistics.totalInstitutions)}
                />
                <CountryMetric
                    icon={<Users className="h-5 w-5" aria-hidden="true" />}
                    label={t('counties.totalUsers')}
                    value={numberFormatter.format(statistics.totalUsers)}
                />
            </dl>

            {hasCountyBreakdown ? (
                <section className="mt-12" aria-labelledby="country-county-directory">
                    <PlatformSectionHeading
                        titleId="country-county-directory"
                        title={t('counties.title')}
                        eyebrow={countryName}
                        description={t('counties.description')}
                        action={
                            <Button
                                asChild
                                variant="outline"
                                className="min-h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-4"
                            >
                                <Link href="/institutions?countryCode=RO">
                                    {t('counties.viewAllInstitutions')}
                                    <ArrowRight
                                        className="ms-2 h-4 w-4 rtl:rotate-180"
                                        aria-hidden="true"
                                    />
                                </Link>
                            </Button>
                        }
                    />
                    <CountyListView countryCode={country.code} />
                </section>
            ) : (
                <section className="mt-12" aria-labelledby="country-institution-directory">
                    <PlatformSectionHeading
                        titleId="country-institution-directory"
                        title={t('institutions.title')}
                        eyebrow={countryName}
                        description={t('institutions.description')}
                    />
                    <InstitutionListView fixedCountryCode={country.code} />
                </section>
            )}
        </>
    );
}

function CountryMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="grid min-h-28 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-4 border-b border-[var(--platform-line)] px-4 py-5 last:border-b-0 sm:border-b-0 sm:border-e sm:last:border-e-0 sm:px-6">
            <span className="grid h-11 w-11 place-items-center bg-[var(--platform-citron)] text-[var(--platform-on-accent)]">
                {icon}
            </span>
            <div>
                <dt className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                    {label}
                </dt>
                <dd className="mt-1 font-mono text-2xl font-black tabular-nums text-[var(--platform-violet)]">
                    {value}
                </dd>
            </div>
        </div>
    );
}

function CountryDetailLoading({ loadingLabel }: { loadingLabel: string }) {
    return (
        <div role="status" aria-label={loadingLabel} aria-busy="true">
            <Skeleton className="mb-7 h-11 w-64 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
            <div className="space-y-4 border-b border-[var(--platform-line-strong)] pb-8">
                <Skeleton className="h-4 w-32 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                <Skeleton className="h-12 w-72 max-w-full rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                <Skeleton className="h-5 w-96 max-w-full rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
            </div>
            <div className="mt-8 grid gap-px bg-[var(--platform-line)] sm:grid-cols-2">
                <Skeleton className="h-28 rounded-none bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                <Skeleton className="h-28 rounded-none bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
            </div>
        </div>
    );
}
