'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
    AlertTriangle,
    ArrowRight,
    Building2,
    MapPin,
    RefreshCw,
    Trophy,
    Users,
} from 'lucide-react';

import { PlatformEmptyState, PlatformSectionHeading } from '@/components/platform-page-shell';
import { Button } from '@/components/ui/button';
import { CountryFlag } from '@/components/country-flag';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/routing';
import { getInstitutionLocationLabel } from '@/lib/country-display';
import { getCounties, getInstitutionRankings } from '@/lib/api';
import type { County, InstitutionRanking, InstitutionType } from '@/lib/types';

type LoadState = 'loading' | 'ready' | 'error';

export function InstitutionRankingsView() {
    const t = useTranslations();
    const locale = useLocale();
    const [rankings, setRankings] = useState<InstitutionRanking[]>([]);
    const [counties, setCounties] = useState<County[]>([]);
    const [loadState, setLoadState] = useState<LoadState>('loading');
    const [loadError, setLoadError] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<InstitutionType | 'ALL'>('ALL');
    const [selectedCounty, setSelectedCounty] = useState<number | 'ALL'>('ALL');

    const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

    const loadCounties = useCallback(async () => {
        try {
            setCounties(await getCounties());
        } catch (error) {
            console.error('Failed to load counties:', error);
        }
    }, []);

    const loadRankings = useCallback(async () => {
        setLoadState('loading');
        setLoadError(null);

        const filters: { type?: InstitutionType; countyId?: number } = {};
        if (selectedType !== 'ALL') filters.type = selectedType;
        if (selectedCounty !== 'ALL') filters.countyId = selectedCounty;

        try {
            setRankings(await getInstitutionRankings(filters, 100));
            setLoadState('ready');
        } catch (error) {
            console.error('Failed to load institution rankings:', error);
            setRankings([]);
            setLoadError(error instanceof Error ? error.message : t('rankings.loadError'));
            setLoadState('error');
        }
    }, [selectedCounty, selectedType, t]);

    useEffect(() => {
        void loadCounties();
    }, [loadCounties]);

    useEffect(() => {
        void loadRankings();
    }, [loadRankings]);

    const getInstitutionTypeLabel = (type: InstitutionType) => {
        const labels: Record<InstitutionType, string> = {
            GIMNAZIU: t('institutions.types.gimnaziu'),
            LICEU: t('institutions.types.liceu'),
            FACULTATE: t('institutions.types.facultate'),
        };
        return labels[type];
    };

    return (
        <div className="mt-8">
            <div className="platform-toolbar grid gap-4 px-4 py-5 sm:px-6 md:grid-cols-2">
                <div className="space-y-2">
                    <label
                        id="institution-ranking-type-label"
                        htmlFor="institution-ranking-type"
                        className="block text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]"
                    >
                        {t('institutions.filterByType')}
                    </label>
                    <Select
                        value={selectedType}
                        onValueChange={(value) => setSelectedType(value as InstitutionType | 'ALL')}
                    >
                        <SelectTrigger
                            id="institution-ranking-type"
                            aria-labelledby="institution-ranking-type-label"
                            className="h-11 w-full rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)]"
                        >
                            <SelectValue placeholder={t('institutions.filterByType')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">{t('institutions.allTypes')}</SelectItem>
                            <SelectItem value="GIMNAZIU">
                                {t('institutions.types.gimnaziu')}
                            </SelectItem>
                            <SelectItem value="LICEU">{t('institutions.types.liceu')}</SelectItem>
                            <SelectItem value="FACULTATE">
                                {t('institutions.types.facultate')}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label
                        id="institution-ranking-county-label"
                        htmlFor="institution-ranking-county"
                        className="block text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]"
                    >
                        {t('institutions.filterByCounty')}
                    </label>
                    <Select
                        value={String(selectedCounty)}
                        onValueChange={(value) =>
                            setSelectedCounty(value === 'ALL' ? 'ALL' : Number(value))
                        }
                    >
                        <SelectTrigger
                            id="institution-ranking-county"
                            aria-labelledby="institution-ranking-county-label"
                            className="h-11 w-full rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)]"
                        >
                            <SelectValue placeholder={t('institutions.filterByCounty')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">{t('institutions.allCounties')}</SelectItem>
                            {counties.map((county) => (
                                <SelectItem key={county.id} value={String(county.id)}>
                                    {county.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <section className="mt-10" aria-label={t('rankings.topInstitutions')}>
                <PlatformSectionHeading
                    eyebrow={t('rankings.institutionRankings')}
                    title={t('rankings.topInstitutions')}
                    description={
                        loadState === 'loading'
                            ? t('rankings.loading')
                            : t('rankings.resultsCount', { count: rankings.length })
                    }
                />
                <div className="sr-only" aria-live="polite">
                    {loadState === 'loading'
                        ? t('rankings.loading')
                        : t('rankings.resultsCount', { count: rankings.length })}
                </div>

                {loadState === 'loading' ? (
                    <InstitutionRankingLoading loadingLabel={t('rankings.loading')} />
                ) : loadState === 'error' ? (
                    <PlatformEmptyState
                        className="mt-5"
                        icon={AlertTriangle}
                        title={t('rankings.error')}
                        description={loadError || t('rankings.loadError')}
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
                        icon={Building2}
                        title={t('rankings.noResults')}
                    />
                ) : (
                    <ol className="mt-5 border-t border-[var(--platform-line-strong)]">
                        {rankings.map((ranking) => (
                            <li key={ranking.institution.id}>
                                <Link
                                    href={`/institutions/${ranking.institution.id}`}
                                    aria-label={t('accessibility.viewDetailsFor', {
                                        title: ranking.institution.name,
                                    })}
                                    className="group grid min-h-24 grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--platform-line)] py-4 outline-none transition-colors hover:bg-[var(--platform-paper-strong)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--platform-violet)] sm:px-3 lg:grid-cols-[3rem_minmax(0,1fr)_8rem_8rem_auto]"
                                >
                                    <RankMark rank={ranking.rank} />
                                    <span className="min-w-0">
                                        <span
                                            className="block truncate text-base font-semibold text-[var(--platform-ink)] group-hover:text-[var(--platform-violet)] group-hover:underline"
                                            dir="auto"
                                        >
                                            {ranking.institution.name}
                                        </span>
                                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold uppercase tracking-[0.06em] text-[var(--platform-ink-muted)]">
                                            <span className="inline-flex items-center gap-1.5">
                                                {ranking.institution.country ? (
                                                    <CountryFlag
                                                        countryCode={
                                                            ranking.institution.country.code
                                                        }
                                                        countryName={
                                                            ranking.institution.country.name
                                                        }
                                                        size="sm"
                                                        decorative
                                                    />
                                                ) : (
                                                    <MapPin
                                                        className="h-3.5 w-3.5"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                {getInstitutionLocationLabel(
                                                    ranking.institution,
                                                    locale,
                                                )}
                                            </span>
                                            <span>
                                                {getInstitutionTypeLabel(ranking.institution.type)}
                                            </span>
                                        </span>
                                        <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--platform-ink-muted)] lg:hidden">
                                            <span>
                                                {t('rankings.members')}{' '}
                                                <strong className="font-mono text-[var(--platform-ink)]">
                                                    {numberFormatter.format(ranking.memberCount)}
                                                </strong>
                                            </span>
                                            <span>
                                                {t('rankings.totalScore')}{' '}
                                                <strong className="font-mono text-[var(--platform-ink)]">
                                                    {numberFormatter.format(ranking.totalScore)}
                                                </strong>
                                            </span>
                                        </span>
                                    </span>
                                    <RankingValue
                                        className="hidden lg:block"
                                        label={t('rankings.members')}
                                        value={numberFormatter.format(ranking.memberCount)}
                                        icon={Users}
                                    />
                                    <RankingValue
                                        className="hidden lg:block"
                                        label={t('rankings.totalScore')}
                                        value={numberFormatter.format(ranking.totalScore)}
                                        icon={Trophy}
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
        </div>
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

function InstitutionRankingLoading({ loadingLabel }: { loadingLabel: string }) {
    return (
        <div
            className="mt-5 border-t border-[var(--platform-line-strong)]"
            role="status"
            aria-label={loadingLabel}
            aria-busy="true"
        >
            {Array.from({ length: 6 }).map((_, index) => (
                <div
                    key={index}
                    className="grid min-h-24 grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--platform-line)] py-4 sm:px-3 lg:grid-cols-[3rem_minmax(0,1fr)_8rem_8rem_auto]"
                >
                    <Skeleton className="h-12 w-12 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-3/4 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                        <Skeleton className="h-3 w-1/2 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                    </div>
                    <Skeleton className="hidden h-9 w-24 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none lg:block" />
                    <Skeleton className="hidden h-9 w-24 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none lg:block" />
                    <Skeleton className="h-5 w-5 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                </div>
            ))}
            <span className="sr-only">{loadingLabel}</span>
        </div>
    );
}
