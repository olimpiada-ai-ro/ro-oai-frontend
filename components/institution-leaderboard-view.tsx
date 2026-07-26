'use client';

import { useCallback } from 'react';
import { AlertCircle, Award, Building2, Crown, MapPin, Medal, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { CountryFlag } from '@/components/country-flag';
import { PlatformEmptyState, PlatformSectionHeading } from '@/components/platform-page-shell';
import { useGTMTracker } from '@/hooks/use-gtm-tracker';
import { Link } from '@/i18n/routing';
import { getInstitutionLocationLabel } from '@/lib/country-display';
import type { InstitutionRanking, InstitutionType } from '@/lib/types';
import { cn } from '@/lib/utils';

type InstitutionLeaderboardViewProps = {
    rankings: InstitutionRanking[];
    isLoading?: boolean;
    error?: Error | null;
    onRetry?: () => void;
};

function RankMark({ rank }: { rank: number }) {
    const Icon = rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Award : null;

    return (
        <span
            className={cn(
                'inline-flex min-h-8 min-w-8 items-center justify-center gap-1 px-2 text-xs font-bold tabular-nums',
                rank === 1 && 'bg-[var(--platform-citron)] text-[var(--platform-on-accent)]',
                rank === 2 && 'bg-[var(--platform-paper-strong)] text-[var(--platform-ink)]',
                rank === 3 &&
                    'bg-[color-mix(in_oklch,var(--platform-coral)_22%,transparent)] text-[var(--platform-ink)]',
                rank > 3 &&
                    'border border-[var(--platform-line)] text-[var(--platform-ink-muted-strong)]',
            )}
        >
            {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            <span>#{rank}</span>
        </span>
    );
}

export function InstitutionLeaderboardView({
    rankings,
    isLoading = false,
    error = null,
    onRetry,
}: InstitutionLeaderboardViewProps) {
    const tInstitutions = useTranslations('institutions');
    const tRankings = useTranslations('rankings');
    const tCommon = useTranslations('common');
    const locale = useLocale();
    const { trackLeaderboard } = useGTMTracker();
    const scoreFormatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    const handleInstitutionClick = useCallback(
        (institutionId: number, institutionName: string, rank: number) => {
            trackLeaderboard('profile_click', 'institutions', {
                clickedInstitutionId: institutionId,
                clickedInstitutionName: institutionName,
                clickedInstitutionRank: rank,
            });
        },
        [trackLeaderboard],
    );

    const getInstitutionTypeLabel = (type: InstitutionType) => {
        const labels: Record<InstitutionType, string> = {
            GIMNAZIU: tInstitutions('types.gimnaziu'),
            LICEU: tInstitutions('types.liceu'),
            FACULTATE: tInstitutions('types.facultate'),
        };
        return labels[type];
    };

    const heading = (
        <PlatformSectionHeading
            title={tRankings('institutionTitle')}
            description={tRankings('institutionDescription')}
            action={
                !isLoading && !error ? (
                    <span className="text-sm font-semibold tabular-nums text-[var(--platform-ink-muted-strong)]">
                        {tRankings('resultsCount', { count: rankings.length })}
                    </span>
                ) : undefined
            }
        />
    );

    if (isLoading) {
        return (
            <div className="space-y-6 sm:space-y-8" aria-busy="true">
                {heading}
                <InstitutionLoadingState />
                <div className="sr-only" role="status" aria-live="polite">
                    {tRankings('loading')}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6 sm:space-y-8">
                {heading}
                <PlatformEmptyState
                    icon={AlertCircle}
                    title={tRankings('error')}
                    description={tRankings('loadError')}
                    action={
                        onRetry ? (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="inline-flex min-h-11 items-center justify-center bg-[var(--platform-ink)] px-5 text-sm font-semibold text-[var(--platform-paper)] transition-transform active:translate-y-px"
                            >
                                {tCommon('retry')}
                            </button>
                        ) : undefined
                    }
                />
            </div>
        );
    }

    if (rankings.length === 0) {
        return (
            <div className="space-y-6 sm:space-y-8">
                {heading}
                <PlatformEmptyState
                    icon={Building2}
                    title={tRankings('noResults')}
                    description={tRankings('institutionDescription')}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8">
            {heading}

            {rankings.length >= 3 ? (
                <section className="hidden md:block" aria-label={tRankings('topInstitutions')}>
                    <div className="platform-panel grid overflow-hidden md:grid-cols-[1.06fr_1fr_1fr]">
                        {rankings.slice(0, 3).map((entry) => (
                            <article
                                key={entry.institution.id}
                                className={cn(
                                    'min-w-0 border-b border-[var(--platform-line)] p-5 last:border-b-0 md:border-b-0 md:border-e md:last:border-e-0 sm:p-6',
                                    entry.rank === 1 &&
                                        'bg-[color-mix(in_oklch,var(--platform-citron)_18%,transparent)]',
                                )}
                            >
                                <RankMark rank={entry.rank} />

                                <div className="mt-6 flex min-w-0 items-start gap-3">
                                    <span className="grid h-11 w-11 shrink-0 place-items-center bg-[var(--platform-paper-strong)] text-[var(--platform-violet)]">
                                        <Building2 className="h-5 w-5" aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0">
                                        <Link
                                            href={`/institutions/${entry.institution.id}`}
                                            className="inline-flex min-h-11 min-w-0 items-center font-semibold leading-snug text-[var(--platform-ink)] underline-offset-4 hover:underline"
                                            onClick={() =>
                                                handleInstitutionClick(
                                                    entry.institution.id,
                                                    entry.institution.name,
                                                    entry.rank,
                                                )
                                            }
                                        >
                                            <span className="line-clamp-2">
                                                {entry.institution.name}
                                            </span>
                                        </Link>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--platform-ink-muted)]">
                                            {entry.institution.country ? (
                                                <CountryFlag
                                                    countryCode={entry.institution.country.code}
                                                    countryName={entry.institution.country.name}
                                                    size="sm"
                                                    showName={false}
                                                    decorative
                                                />
                                            ) : null}
                                            <span className="inline-flex items-center gap-1">
                                                <MapPin className="h-3 w-3" aria-hidden="true" />
                                                {getInstitutionLocationLabel(
                                                    entry.institution,
                                                    locale,
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-7 flex items-end justify-between gap-4 border-t border-[var(--platform-line)] pt-4">
                                    <div>
                                        <p className="text-2xl font-semibold tabular-nums tracking-[-0.045em] text-[var(--platform-ink)] sm:text-3xl">
                                            {scoreFormatter.format(entry.totalScore)}
                                        </p>
                                        <p className="mt-1 text-xs text-[var(--platform-ink-muted)]">
                                            {tRankings('totalScore')}
                                        </p>
                                    </div>
                                    <div className="text-end text-xs leading-5 text-[var(--platform-ink-muted-strong)]">
                                        <p>{getInstitutionTypeLabel(entry.institution.type)}</p>
                                        <p>
                                            {entry.memberCount}{' '}
                                            {tRankings('members').toLocaleLowerCase(locale)}
                                        </p>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            ) : null}

            <section aria-labelledby="institution-table-heading">
                <div className="platform-panel overflow-hidden">
                    <div className="flex items-center justify-between gap-4 border-b border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] px-4 py-3 sm:px-5">
                        <h3
                            id="institution-table-heading"
                            className="font-semibold text-[var(--platform-ink)]"
                        >
                            {tRankings('institutionRankings')}
                        </h3>
                        <span className="text-xs text-[var(--platform-ink-muted)]">
                            {tRankings('resultsCount', { count: rankings.length })}
                        </span>
                    </div>
                    <div
                        className="max-h-[42rem] overflow-auto overscroll-contain scrollbar-thin"
                        role="region"
                        aria-labelledby="institution-table-heading"
                        tabIndex={0}
                    >
                        <table className="w-full border-collapse text-sm text-[var(--platform-ink)]">
                            <thead className="sticky top-0 z-[1] bg-[var(--platform-paper-strong)]">
                                <tr className="border-b border-[var(--platform-line-strong)]">
                                    <th
                                        scope="col"
                                        className="h-12 w-16 px-3 text-start text-xs font-semibold text-[var(--platform-ink-muted-strong)]"
                                    >
                                        {tRankings('rank')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="h-12 min-w-40 px-3 text-start text-xs font-semibold text-[var(--platform-ink-muted-strong)] sm:px-4"
                                    >
                                        {tRankings('institution')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="hidden h-12 px-4 text-start text-xs font-semibold text-[var(--platform-ink-muted-strong)] sm:table-cell"
                                    >
                                        {tRankings('county')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="hidden h-12 px-4 text-start text-xs font-semibold text-[var(--platform-ink-muted-strong)] sm:table-cell"
                                    >
                                        {tRankings('type')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="h-12 min-w-24 px-3 text-end text-xs font-semibold text-[var(--platform-ink-muted-strong)] sm:px-4"
                                    >
                                        {tRankings('totalScore')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="hidden h-12 px-4 text-end text-xs font-semibold text-[var(--platform-ink-muted-strong)] md:table-cell"
                                    >
                                        {tRankings('members')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {rankings.map((entry) => (
                                    <tr
                                        key={entry.institution.id}
                                        className="border-b border-[var(--platform-line)] last:border-b-0 hover:bg-[var(--platform-paper-strong)] [content-visibility:auto] [contain-intrinsic-size:auto_3.75rem]"
                                    >
                                        <td className="px-3 py-2.5 align-middle">
                                            <RankMark rank={entry.rank} />
                                        </td>
                                        <td className="min-w-0 px-3 py-2 align-middle sm:px-4">
                                            <div className="flex min-w-0 items-start gap-2.5">
                                                {entry.institution.country ? (
                                                    <CountryFlag
                                                        countryCode={entry.institution.country.code}
                                                        countryName={entry.institution.country.name}
                                                        size="sm"
                                                        showName={false}
                                                        className="mt-3.5 shrink-0"
                                                        decorative
                                                    />
                                                ) : null}
                                                <div className="min-w-0">
                                                    <Link
                                                        href={`/institutions/${entry.institution.id}`}
                                                        className="inline-flex min-h-11 min-w-0 items-center font-semibold leading-snug underline-offset-4 hover:text-[var(--platform-violet)] hover:underline"
                                                        onClick={() =>
                                                            handleInstitutionClick(
                                                                entry.institution.id,
                                                                entry.institution.name,
                                                                entry.rank,
                                                            )
                                                        }
                                                    >
                                                        <span className="line-clamp-2">
                                                            {entry.institution.name}
                                                        </span>
                                                    </Link>
                                                    <div className="flex flex-wrap gap-x-2 text-xs text-[var(--platform-ink-muted)] sm:hidden">
                                                        <span>
                                                            {getInstitutionLocationLabel(
                                                                entry.institution,
                                                                locale,
                                                            )}
                                                        </span>
                                                        <span>
                                                            {getInstitutionTypeLabel(
                                                                entry.institution.type,
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="hidden px-4 py-2.5 text-[var(--platform-ink-muted-strong)] sm:table-cell">
                                            <span className="inline-flex items-center gap-1.5">
                                                <MapPin
                                                    className="h-3.5 w-3.5"
                                                    aria-hidden="true"
                                                />
                                                {getInstitutionLocationLabel(
                                                    entry.institution,
                                                    locale,
                                                )}
                                            </span>
                                        </td>
                                        <td className="hidden px-4 py-2.5 sm:table-cell">
                                            <span className="inline-flex border border-[var(--platform-line)] bg-[var(--platform-paper-strong)] px-2 py-1 text-xs font-medium text-[var(--platform-ink-muted-strong)]">
                                                {getInstitutionTypeLabel(entry.institution.type)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-end font-semibold tabular-nums sm:px-4">
                                            {scoreFormatter.format(entry.totalScore)}
                                        </td>
                                        <td className="hidden px-4 py-2.5 text-end tabular-nums md:table-cell">
                                            <span className="inline-flex items-center gap-1.5">
                                                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                                                {entry.memberCount}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}

function InstitutionLoadingState() {
    return (
        <div className="space-y-6 sm:space-y-8">
            <div className="platform-panel hidden overflow-hidden md:grid md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div
                        key={index}
                        className="border-b border-[var(--platform-line)] p-6 last:border-b-0 md:border-b-0 md:border-e md:last:border-e-0"
                    >
                        <div className="h-8 w-14 animate-pulse bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                        <div className="mt-6 h-5 w-3/4 animate-pulse bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                        <div className="mt-7 h-9 w-32 animate-pulse bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                    </div>
                ))}
            </div>
            <div className="platform-panel overflow-hidden">
                {Array.from({ length: 10 }).map((_, index) => (
                    <div
                        key={index}
                        className="flex h-14 items-center gap-4 border-b border-[var(--platform-line)] px-4 last:border-b-0"
                    >
                        <div className="h-7 w-10 animate-pulse bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                        <div className="h-4 flex-1 animate-pulse bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                        <div className="h-4 w-24 animate-pulse bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                    </div>
                ))}
            </div>
        </div>
    );
}
