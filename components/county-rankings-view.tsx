'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
    AlertTriangle,
    ArrowRight,
    Building2,
    MapPinned,
    RefreshCw,
    TrendingUp,
    Users,
} from 'lucide-react';

import { PlatformEmptyState, PlatformSectionHeading } from '@/components/platform-page-shell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/routing';
import { getCountyRankings } from '@/lib/api';
import type { CountyRanking } from '@/lib/types';

type LoadState = 'loading' | 'ready' | 'error';

export function CountyRankingsView() {
    const t = useTranslations();
    const locale = useLocale();
    const [rankings, setRankings] = useState<CountyRanking[]>([]);
    const [loadState, setLoadState] = useState<LoadState>('loading');

    const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
    const decimalFormatter = useMemo(
        () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
        [locale],
    );

    const loadRankings = useCallback(async () => {
        setLoadState('loading');

        try {
            setRankings(await getCountyRankings(50));
            setLoadState('ready');
        } catch (error) {
            console.error('Failed to load county rankings:', error);
            setRankings([]);
            setLoadState('error');
        }
    }, []);

    useEffect(() => {
        void loadRankings();
    }, [loadRankings]);

    return (
        <section
            className="mt-10"
            aria-label={t('rankings.topCounties')}
            aria-busy={loadState === 'loading'}
        >
            <PlatformSectionHeading
                eyebrow={t('rankings.countyRankings')}
                title={t('rankings.topCounties')}
                description={
                    loadState === 'loading'
                        ? t('rankings.loading')
                        : loadState === 'error'
                          ? t('rankings.loadError')
                          : t('rankings.resultsCount', { count: rankings.length })
                }
            />
            <div className="sr-only" role="status" aria-live="polite">
                {loadState === 'loading'
                    ? t('rankings.loading')
                    : loadState === 'error'
                      ? t('rankings.loadError')
                      : t('rankings.resultsCount', { count: rankings.length })}
            </div>

            {loadState === 'loading' ? (
                <CountyRankingLoading />
            ) : loadState === 'error' ? (
                <PlatformEmptyState
                    className="mt-5"
                    icon={AlertTriangle}
                    title={t('rankings.error')}
                    description={t('rankings.loadError')}
                    action={
                        <Button
                            type="button"
                            className="min-h-11 rounded-none px-5"
                            onClick={() => void loadRankings()}
                        >
                            <RefreshCw className="me-2 h-4 w-4" />
                            {t('common.retry')}
                        </Button>
                    }
                />
            ) : rankings.length === 0 ? (
                <PlatformEmptyState
                    className="mt-5"
                    icon={MapPinned}
                    title={t('rankings.noResults')}
                />
            ) : (
                <ol className="mt-5 border-t border-[var(--platform-line-strong)]">
                    {rankings.map((ranking) => (
                        <li key={ranking.county.id}>
                            <Link
                                href={`/countries/RO/counties/${ranking.county.id}`}
                                aria-label={t('accessibility.viewDetailsFor', {
                                    title: ranking.county.name,
                                })}
                                className="group grid min-h-24 grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--platform-line)] py-4 outline-none transition-colors hover:bg-[var(--platform-paper-strong)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--platform-violet)] sm:px-3 lg:grid-cols-[3rem_minmax(0,1fr)_8rem_8rem_8rem_auto]"
                            >
                                <RankMark rank={ranking.rank} />
                                <span className="min-w-0">
                                    <span
                                        className="block truncate text-base font-semibold text-[var(--platform-ink)] group-hover:text-[var(--platform-violet)] group-hover:underline"
                                        dir="auto"
                                    >
                                        {ranking.county.name}
                                    </span>
                                    {ranking.county.code ? (
                                        <span className="mt-1 block font-mono text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                                            {ranking.county.code}
                                        </span>
                                    ) : null}
                                    <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--platform-ink-muted)] lg:hidden">
                                        <span>
                                            {t('rankings.totalUsers')}{' '}
                                            <strong className="font-mono text-[var(--platform-ink)]">
                                                {numberFormatter.format(ranking.totalUsers)}
                                            </strong>
                                        </span>
                                        <span>
                                            {t('rankings.institutions')}{' '}
                                            <strong className="font-mono text-[var(--platform-ink)]">
                                                {numberFormatter.format(ranking.institutionCount)}
                                            </strong>
                                        </span>
                                    </span>
                                </span>
                                <RankingValue
                                    className="hidden lg:block"
                                    label={t('rankings.totalUsers')}
                                    value={numberFormatter.format(ranking.totalUsers)}
                                    icon={Users}
                                />
                                <RankingValue
                                    className="hidden lg:block"
                                    label={t('rankings.institutions')}
                                    value={numberFormatter.format(ranking.institutionCount)}
                                    icon={Building2}
                                />
                                <RankingValue
                                    className="hidden lg:block"
                                    label={t('rankings.avgUsers')}
                                    value={decimalFormatter.format(
                                        ranking.averageUsersPerInstitution,
                                    )}
                                    icon={TrendingUp}
                                />
                                <ArrowRight
                                    className="h-5 w-5 text-[var(--platform-ink-muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--platform-violet)] motion-reduce:transition-none rtl:rotate-180 rtl:group-hover:-translate-x-1"
                                    aria-hidden="true"
                                />
                            </Link>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

function RankMark({ rank }: { rank: number }) {
    const accent =
        rank === 1
            ? 'bg-[var(--platform-citron)] text-[var(--platform-on-accent)]'
            : rank === 2
              ? 'bg-[var(--platform-coral)] text-[var(--platform-on-accent)]'
              : rank === 3
                ? 'bg-[var(--platform-violet)] text-white dark:text-[var(--platform-on-accent)]'
                : 'border border-[var(--platform-line-strong)] text-[var(--platform-violet)]';

    return (
        <span
            className={`grid h-12 w-12 place-items-center font-mono text-sm font-black tabular-nums ${accent}`}
        >
            {String(rank).padStart(2, '0')}
        </span>
    );
}

function RankingValue({
    className,
    label,
    value,
    icon: Icon,
}: {
    className?: string;
    label: string;
    value: string;
    icon: typeof Users;
}) {
    return (
        <span className={className}>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[var(--platform-ink-muted)]">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
            </span>
            <strong className="mt-1 block font-mono text-base font-black tabular-nums text-[var(--platform-ink)]">
                {value}
            </strong>
        </span>
    );
}

function CountyRankingLoading() {
    return (
        <div className="mt-5 border-t border-[var(--platform-line-strong)]" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
                <div
                    key={index}
                    className="grid min-h-24 grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--platform-line)] py-4 sm:px-3 lg:grid-cols-[3rem_minmax(0,1fr)_8rem_8rem_8rem_auto]"
                >
                    <Skeleton className="h-12 w-12 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-1/2 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                        <Skeleton className="h-3 w-12 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                    </div>
                    {Array.from({ length: 3 }).map((_, metricIndex) => (
                        <Skeleton
                            key={metricIndex}
                            className="hidden h-9 w-24 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none lg:block"
                        />
                    ))}
                    <Skeleton className="h-5 w-5 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                </div>
            ))}
        </div>
    );
}
