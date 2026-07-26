'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Building2,
    ChevronRight,
    Home,
    MapPinned,
    RefreshCw,
    TrendingUp,
    Users,
} from 'lucide-react';

import {
    PlatformEmptyState,
    PlatformPageHeader,
    PlatformSectionHeading,
} from '@/components/platform-page-shell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/routing';
import { getCountryCountyById } from '@/lib/api';
import type { CountyResponse, InstitutionType } from '@/lib/types';

interface CountyDetailViewProps {
    countyId: number | null;
    countryCode?: string;
}

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

function isNotFoundError(error: unknown) {
    return error instanceof Error && /not found/i.test(error.message);
}

export function CountyDetailView({ countyId, countryCode = 'RO' }: CountyDetailViewProps) {
    const t = useTranslations();
    const locale = useLocale();
    const [county, setCounty] = useState<CountyResponse | null>(null);
    const [loadState, setLoadState] = useState<LoadState>(
        countyId === null ? 'not-found' : 'loading',
    );
    const [loadError, setLoadError] = useState<string | null>(null);
    const countryHref = `/countries/${countryCode.toUpperCase()}`;

    const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
    const decimalFormatter = useMemo(
        () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
        [locale],
    );

    const loadCounty = useCallback(async () => {
        if (countyId === null) {
            setCounty(null);
            setLoadState('not-found');
            return;
        }

        setLoadState('loading');
        setLoadError(null);

        try {
            const data = await getCountryCountyById(countryCode, countyId);
            setCounty(data);
            setLoadState('ready');
        } catch (error) {
            console.error('Failed to load county:', error);
            setCounty(null);

            if (isNotFoundError(error)) {
                setLoadState('not-found');
                return;
            }

            setLoadError(error instanceof Error ? error.message : t('counties.loadError'));
            setLoadState('error');
        }
    }, [countryCode, countyId, t]);

    useEffect(() => {
        void loadCounty();
    }, [loadCounty]);

    const getInstitutionTypeLabel = (type: InstitutionType) => {
        const labels: Record<InstitutionType, string> = {
            GIMNAZIU: t('institutions.types.gimnaziu'),
            LICEU: t('institutions.types.liceu'),
            FACULTATE: t('institutions.types.facultate'),
        };
        return labels[type];
    };

    if (loadState === 'loading') {
        return <CountyDetailLoading loadingLabel={t('common.loading')} />;
    }

    if (loadState === 'not-found') {
        return (
            <>
                <PlatformPageHeader
                    eyebrow={t('counties.title')}
                    icon={MapPinned}
                    title={t('counties.notFound')}
                    description={t('counties.description')}
                />
                <PlatformEmptyState
                    className="mt-8"
                    icon={MapPinned}
                    title={t('counties.notFound')}
                    action={
                        <Button asChild className="min-h-11 rounded-none px-5">
                            <Link href={countryHref}>
                                <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
                                {t('counties.backToList')}
                            </Link>
                        </Button>
                    }
                />
            </>
        );
    }

    if (loadState === 'error' || !county) {
        return (
            <>
                <PlatformPageHeader
                    eyebrow={t('counties.title')}
                    icon={MapPinned}
                    title={t('counties.error')}
                    description={t('counties.description')}
                />
                <PlatformEmptyState
                    className="mt-8"
                    icon={AlertTriangle}
                    title={t('counties.loadError')}
                    description={loadError}
                    action={
                        <div className="flex flex-wrap justify-center gap-3">
                            <Button
                                type="button"
                                className="min-h-11 rounded-none px-5"
                                onClick={() => void loadCounty()}
                            >
                                <RefreshCw className="me-2 h-4 w-4" />
                                {t('common.retry')}
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                className="min-h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-5"
                            >
                                <Link href={countryHref}>{t('counties.backToList')}</Link>
                            </Button>
                        </div>
                    }
                />
            </>
        );
    }

    const stats = county.statistics;
    const averageUsers =
        stats && stats.totalInstitutions > 0 ? stats.totalUsers / stats.totalInstitutions : 0;

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
                <Link
                    href={countryHref}
                    className="inline-flex min-h-11 shrink-0 items-center px-2 font-semibold hover:text-[var(--platform-violet)] hover:underline"
                >
                    {t('countries.defaultCountry')}
                </Link>
                <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
                <span
                    className="truncate font-medium text-[var(--platform-ink)]"
                    aria-current="page"
                >
                    {county.name}
                </span>
            </nav>

            <PlatformPageHeader
                eyebrow={`${t('countries.defaultCountry')} · ${county.code}`}
                icon={MapPinned}
                title={<span dir="auto">{county.name}</span>}
                description={t('counties.detailDescription')}
            />

            {!stats ? (
                <PlatformEmptyState
                    className="mt-8"
                    icon={Building2}
                    title={t('counties.noResults')}
                    description={t('counties.detailDescription')}
                    action={
                        <Button asChild className="min-h-11 rounded-none px-5">
                            <Link href={`/institutions?countryCode=RO&countyId=${county.id}`}>
                                {t('counties.viewAllInstitutions')}
                                <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                            </Link>
                        </Button>
                    }
                />
            ) : (
                <>
                    <dl className="mt-8 grid border-y border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] sm:grid-cols-3">
                        <CountyMetric
                            icon={<Users className="h-5 w-5" aria-hidden="true" />}
                            label={t('counties.totalUsers')}
                            value={numberFormatter.format(stats.totalUsers)}
                            note={t('counties.registeredUsers')}
                        />
                        <CountyMetric
                            icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
                            label={t('counties.totalInstitutions')}
                            value={numberFormatter.format(stats.totalInstitutions)}
                            note={t('counties.educationalInstitutions')}
                        />
                        <CountyMetric
                            icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
                            label={t('counties.averageUsers')}
                            value={decimalFormatter.format(averageUsers)}
                            note={t('counties.usersPerInstitution')}
                        />
                    </dl>

                    <div className="mt-12 grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
                        <section aria-label={t('counties.userDistribution')}>
                            <PlatformSectionHeading
                                eyebrow={t('counties.statisticsPreview')}
                                title={t('counties.userDistribution')}
                                description={t('counties.userDistributionDescription')}
                            />
                            <div className="mt-5 border-t border-[var(--platform-line-strong)]">
                                {Object.entries(stats.usersByType).map(([type, count]) => {
                                    const percentage =
                                        stats.totalUsers > 0 ? (count / stats.totalUsers) * 100 : 0;
                                    const typeLabel = getInstitutionTypeLabel(
                                        type as InstitutionType,
                                    );

                                    return (
                                        <div
                                            key={type}
                                            className="border-b border-[var(--platform-line)] py-4"
                                        >
                                            <div className="flex items-baseline justify-between gap-4">
                                                <span className="font-semibold text-[var(--platform-ink)]">
                                                    {typeLabel}
                                                </span>
                                                <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-[var(--platform-ink-muted)]">
                                                    {numberFormatter.format(count)} ·{' '}
                                                    {decimalFormatter.format(percentage)}%
                                                </span>
                                            </div>
                                            <div
                                                role="progressbar"
                                                aria-label={typeLabel}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                                aria-valuenow={Math.round(percentage)}
                                                className="mt-3 h-2 overflow-hidden bg-[var(--platform-line)]"
                                            >
                                                <div
                                                    className="h-full bg-[var(--platform-violet)] transition-[width] duration-500 motion-reduce:transition-none"
                                                    style={{
                                                        width: `${Math.min(percentage, 100)}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        <section aria-label={t('counties.institutionDistribution')}>
                            <PlatformSectionHeading
                                eyebrow={t('counties.statisticsPreview')}
                                title={t('counties.institutionDistribution')}
                                description={t('counties.institutionDistributionDescription')}
                            />
                            <dl className="mt-5 border-t border-[var(--platform-line-strong)]">
                                {Object.entries(stats.institutionsByType).map(
                                    ([type, count], index) => (
                                        <div
                                            key={type}
                                            className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--platform-line)] py-3"
                                        >
                                            <dt className="flex min-w-0 items-center gap-4 font-semibold text-[var(--platform-ink)]">
                                                <span
                                                    className={
                                                        index === 1
                                                            ? 'grid h-11 w-11 shrink-0 place-items-center bg-[var(--platform-coral)] text-[var(--platform-on-accent)]'
                                                            : 'grid h-11 w-11 shrink-0 place-items-center bg-[var(--platform-citron)] text-[var(--platform-on-accent)]'
                                                    }
                                                    aria-hidden="true"
                                                >
                                                    <Building2 className="h-5 w-5" />
                                                </span>
                                                <span>
                                                    {getInstitutionTypeLabel(
                                                        type as InstitutionType,
                                                    )}
                                                </span>
                                            </dt>
                                            <dd className="font-mono text-xl font-black tabular-nums text-[var(--platform-violet)]">
                                                {numberFormatter.format(count)}
                                            </dd>
                                        </div>
                                    ),
                                )}
                            </dl>
                        </section>
                    </div>

                    {stats.topInstitutions.length > 0 ? (
                        <section className="mt-14" aria-label={t('counties.topInstitutions')}>
                            <PlatformSectionHeading
                                eyebrow={t('rankings.institutionRankings')}
                                title={t('counties.topInstitutions')}
                                description={t('counties.topInstitutionsDescription')}
                                action={
                                    <Button
                                        asChild
                                        variant="outline"
                                        className="hidden min-h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-4 sm:inline-flex"
                                    >
                                        <Link
                                            href={`/institutions?countryCode=RO&countyId=${county.id}`}
                                        >
                                            {t('counties.viewAllInstitutions')}
                                            <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                                        </Link>
                                    </Button>
                                }
                            />
                            <ol className="mt-5 border-t border-[var(--platform-line-strong)]">
                                {stats.topInstitutions.map((institution, index) => (
                                    <li key={institution.id}>
                                        <Link
                                            href={`/institutions/${institution.id}`}
                                            aria-label={t('accessibility.viewDetailsFor', {
                                                title: institution.name,
                                            })}
                                            className="group grid min-h-20 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--platform-line)] py-3 outline-none transition-colors hover:bg-[var(--platform-paper-strong)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--platform-violet)] sm:grid-cols-[2.75rem_minmax(0,1fr)_9rem_auto] sm:px-3"
                                        >
                                            <span
                                                className={
                                                    index === 0
                                                        ? 'grid h-11 w-11 place-items-center bg-[var(--platform-citron)] font-mono text-sm font-black text-[var(--platform-on-accent)]'
                                                        : 'grid h-11 w-11 place-items-center border border-[var(--platform-line-strong)] font-mono text-sm font-black text-[var(--platform-violet)]'
                                                }
                                            >
                                                {String(index + 1).padStart(2, '0')}
                                            </span>
                                            <span className="min-w-0">
                                                <span
                                                    className="block truncate font-semibold text-[var(--platform-ink)] group-hover:text-[var(--platform-violet)] group-hover:underline"
                                                    dir="auto"
                                                >
                                                    {institution.name}
                                                </span>
                                                <span className="mt-1 block text-xs font-bold uppercase tracking-[0.06em] text-[var(--platform-ink-muted)]">
                                                    {getInstitutionTypeLabel(institution.type)}
                                                </span>
                                            </span>
                                            <span className="hidden text-sm text-[var(--platform-ink-muted)] sm:block">
                                                {t('rankings.members')}
                                                <strong className="ms-2 font-mono text-[var(--platform-ink)]">
                                                    {numberFormatter.format(
                                                        institution.memberCount,
                                                    )}
                                                </strong>
                                            </span>
                                            <ArrowRight
                                                className="h-5 w-5 text-[var(--platform-ink-muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--platform-violet)] motion-reduce:transition-none rtl:rotate-180 rtl:group-hover:-translate-x-1"
                                                aria-hidden="true"
                                            />
                                        </Link>
                                    </li>
                                ))}
                            </ol>
                            <Button
                                asChild
                                className="mt-5 min-h-11 w-full rounded-none px-5 sm:hidden"
                            >
                                <Link href={`/institutions?countryCode=RO&countyId=${county.id}`}>
                                    {t('counties.viewAllInstitutions')}
                                    <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                                </Link>
                            </Button>
                        </section>
                    ) : (
                        <PlatformEmptyState
                            className="mt-12"
                            icon={Building2}
                            title={t('counties.noResults')}
                            description={t('counties.noResultsDescription')}
                            action={
                                <Button asChild className="min-h-11 rounded-none px-5">
                                    <Link
                                        href={`/institutions?countryCode=RO&countyId=${county.id}`}
                                    >
                                        {t('counties.viewAllInstitutions')}
                                    </Link>
                                </Button>
                            }
                        />
                    )}
                </>
            )}
        </>
    );
}

function CountyMetric({
    icon,
    label,
    value,
    note,
}: {
    icon: ReactNode;
    label: string;
    value: ReactNode;
    note: string;
}) {
    return (
        <div className="grid min-h-32 grid-cols-[2.75rem_minmax(0,1fr)] grid-rows-[auto_1fr] items-center gap-x-3 border-b border-[var(--platform-line)] p-4 last:border-b-0 sm:border-b-0 sm:border-e sm:last:border-e-0">
            <dt className="col-start-2 self-end text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                {label}
            </dt>
            <dd className="col-span-2 grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-3">
                <span
                    className="grid h-11 w-11 place-items-center bg-[var(--platform-citron)] text-[var(--platform-on-accent)]"
                    aria-hidden="true"
                >
                    {icon}
                </span>
                <span className="min-w-0">
                    <span className="block font-mono text-2xl font-black tabular-nums text-[var(--platform-ink)]">
                        {value}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--platform-ink-muted)]">
                        {note}
                    </span>
                </span>
            </dd>
        </div>
    );
}

function CountyDetailLoading({ loadingLabel }: { loadingLabel: string }) {
    return (
        <div role="status" aria-label={loadingLabel} aria-busy="true">
            <Skeleton className="h-11 w-48 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
            <div className="mt-7 border-b border-[var(--platform-line-strong)] pb-10">
                <Skeleton className="h-4 w-32 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                <Skeleton className="mt-5 h-16 w-full max-w-2xl rounded-none bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                <Skeleton className="mt-4 h-5 w-full max-w-md rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
            </div>
            <div className="mt-8 grid border-y border-[var(--platform-line)] sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div
                        key={index}
                        className="min-h-32 border-b border-e border-[var(--platform-line)] p-4 sm:border-b-0"
                    >
                        <Skeleton className="h-11 w-11 rounded-none bg-[var(--platform-citron)] motion-reduce:animate-none" />
                        <Skeleton className="mt-3 h-5 w-28 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                    </div>
                ))}
            </div>
            <div className="mt-12 grid gap-12 lg:grid-cols-2">
                {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index}>
                        <Skeleton className="h-8 w-56 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                        <Skeleton className="mt-5 h-64 rounded-none bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                    </div>
                ))}
            </div>
            <span className="sr-only">{loadingLabel}</span>
        </div>
    );
}
