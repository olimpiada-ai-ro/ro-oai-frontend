'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Award, Crown, Medal, Trophy } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { CountryFlag } from '@/components/country-flag';
import { PlatformEmptyState, PlatformSectionHeading } from '@/components/platform-page-shell';
import { UserAvatar } from '@/components/user-avatar';
import { UserIdentityPresentation } from '@/components/user-identity-presentation';
import { useGTMTracker } from '@/hooks/use-gtm-tracker';
import { Link } from '@/i18n/routing';
import { analytics, AnalyticsEvents } from '@/lib/analytics';
import { formatShortDate, formatTime } from '@/lib/i18n-formatting';
import { getProblemContent } from '@/lib/problem-translations';
import { getProfileUrl } from '@/lib/profile-utils';
import type { GenericLeaderboardEntry, Locale, Problem } from '@/lib/types';
import type { IdentityPresentationSurface } from '@/lib/identity-presentation';
import { cn } from '@/lib/utils';

type LeaderboardViewProps = {
    leaderboard: GenericLeaderboardEntry[];
    problems?: Problem[];
    simple?: boolean;
    showMetric?: boolean;
    showAttainedAt?: boolean;
    isLoading?: boolean;
    showAwardRank?: boolean;
    error?: string | null;
    onRetry?: () => void;
    identitySurface?: IdentityPresentationSurface;
};

const scoreFormatterOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
};

const LEADERBOARD_BATCH_SIZE = 50;

function RankMark({ rank }: { rank: number }) {
    const Icon = rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Award : null;

    return (
        <span
            className={cn(
                'inline-flex min-h-8 min-w-8 items-center justify-center gap-1 px-2 text-xs font-bold tabular-nums',
                rank === 1 && 'bg-[var(--platform-citron)] text-[var(--platform-on-accent)]',
                rank === 2 &&
                    'bg-muted text-foreground bg-[var(--platform-paper-strong)] text-[var(--platform-ink)]',
                rank === 3 &&
                    'bg-[color-mix(in_oklch,var(--platform-coral)_22%,transparent)] text-[var(--platform-ink)]',
                rank > 3 &&
                    'border border-border text-muted-foreground border-[var(--platform-line)] text-[var(--platform-ink-muted-strong)]',
            )}
        >
            {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            <span>#{rank}</span>
        </span>
    );
}

function LevelMark({ level }: { level?: number }) {
    if (!level) return null;

    return (
        <span className="inline-flex h-6 min-w-6 items-center justify-center border border-[var(--platform-line)] px-1.5 text-[10px] font-bold tabular-nums text-[var(--platform-ink-muted-strong)]">
            L{level}
        </span>
    );
}

function RetryButton({ onRetry, label }: { onRetry?: () => void; label: string }) {
    if (!onRetry) return null;

    return (
        <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center justify-center bg-[var(--platform-ink)] px-5 text-sm font-semibold text-[var(--platform-paper)] transition-transform active:translate-y-px"
        >
            {label}
        </button>
    );
}

export function LeaderboardView({
    leaderboard,
    problems,
    simple = false,
    showMetric = false,
    showAttainedAt = false,
    showAwardRank = false,
    isLoading = false,
    error = null,
    onRetry,
    identitySurface = 'RESTRICTED_COMPETITION_LEADERBOARD',
}: LeaderboardViewProps) {
    const { data: session } = useSession();
    const currentUserId = session?.id ?? session?.user?.email;
    const t = useTranslations('leaderboard');
    const tStats = useTranslations('stats');
    const tCommon = useTranslations('common');
    const tProblems = useTranslations('problems');
    const tRankings = useTranslations('rankings');
    const tAccessibility = useTranslations('accessibility');
    const locale = useLocale() as Locale;
    const { trackLeaderboard } = useGTMTracker();
    const scoreFormatter = useMemo(
        () => new Intl.NumberFormat(locale, scoreFormatterOptions),
        [locale],
    );
    const countFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
    const formatScore = (score: number) => scoreFormatter.format(score);
    const shouldProgressivelyRender = !simple && !problems?.length;
    const [visibleBatchCount, setVisibleBatchCount] = useState(1);
    const visibleRowCount = shouldProgressivelyRender
        ? Math.min(visibleBatchCount * LEADERBOARD_BATCH_SIZE, leaderboard.length)
        : leaderboard.length;

    const visibleEntries = shouldProgressivelyRender
        ? leaderboard.slice(0, visibleRowCount)
        : leaderboard;
    const currentUserEntry = currentUserId
        ? leaderboard.find((entry) => entry.userId === currentUserId)
        : undefined;
    const isCurrentUserPinned = Boolean(
        currentUserEntry &&
            !visibleEntries.some((entry) => entry.userId === currentUserEntry.userId),
    );
    const displayedEntries =
        isCurrentUserPinned && currentUserEntry
            ? [...visibleEntries, currentUserEntry]
            : visibleEntries;
    const hasMoreRows = shouldProgressivelyRender && visibleRowCount < leaderboard.length;
    const visibleResultsLabel = `${tRankings('resultsCount', {
        count: displayedEntries.length,
    })} / ${countFormatter.format(leaderboard.length)}`;

    const handleProfileClick = useCallback(
        (userId: string, username: string, rank: number) => {
            trackLeaderboard('profile_click', 'users', {
                clickedUserId: userId,
                clickedUsername: username,
                clickedUserRank: rank,
            });
        },
        [trackLeaderboard],
    );

    useEffect(() => {
        if (isLoading || simple) return;

        try {
            analytics.trackEvent({
                name: AnalyticsEvents.LEADERBOARD_VIEW,
                properties: {
                    entryCount: leaderboard.length,
                    timestamp: new Date().toISOString(),
                },
            });
        } catch (trackingError) {
            console.error('[Analytics] Failed to track leaderboard view:', trackingError);
        }
    }, [leaderboard.length, isLoading, simple]);

    if (isLoading) {
        return <LeaderboardLoadingState simple={simple} />;
    }

    if (error) {
        return (
            <PlatformEmptyState
                icon={AlertCircle}
                title={tRankings('error')}
                description={tRankings('loadError')}
                action={<RetryButton onRetry={onRetry} label={tCommon('retry')} />}
            />
        );
    }

    if (leaderboard.length === 0) {
        return (
            <PlatformEmptyState
                icon={Trophy}
                title={tRankings('noResults')}
                description={t('fullLeaderboardDesc')}
            />
        );
    }

    const isCurrentUser = (userId: string) => currentUserId === userId;

    return (
        <div className={cn('space-y-6 sm:space-y-8', simple && 'space-y-0')}>
            {!simple ? (
                <PlatformSectionHeading
                    title={t('fullLeaderboard')}
                    description={t('fullLeaderboardDesc')}
                    action={
                        <span className="text-sm font-semibold tabular-nums text-[var(--platform-ink-muted-strong)]">
                            {tRankings('resultsCount', { count: leaderboard.length })}
                        </span>
                    }
                />
            ) : null}

            {!simple && leaderboard.length >= 3 ? (
                <section aria-label={t('topPodium')}>
                    <div className="platform-panel border bg-card grid overflow-hidden md:grid-cols-[1.06fr_1fr_1fr]">
                        {leaderboard.slice(0, 3).map((entry, index) => {
                            const current = isCurrentUser(entry.userId);

                            return (
                                <article
                                    key={entry.userId}
                                    aria-label={tAccessibility('rankLabel', {
                                        rank: entry.rank,
                                        username: entry.username,
                                        score: entry.totalScore,
                                    })}
                                    className={cn(
                                        'relative min-w-0 border-b border-[var(--platform-line)] p-4 last:border-b-0 md:border-b-0 md:border-e md:last:border-e-0 sm:p-6',
                                        entry.rank === 1 &&
                                            'bg-[color-mix(in_oklch,var(--platform-citron)_18%,transparent)]',
                                        current &&
                                            'bg-[color-mix(in_oklch,var(--platform-violet)_10%,var(--platform-paper))]',
                                    )}
                                >
                                    <div className="flex min-w-0 items-center gap-3 sm:hidden">
                                        <RankMark rank={entry.rank} />
                                        <UserAvatar
                                            avatar={entry.avatar}
                                            fallbackInitials={entry.avatarInitials}
                                            userId={entry.userId}
                                            username={entry.username}
                                            loading="eager"
                                            className="h-10 w-10 shrink-0 border border-[var(--platform-line-strong)]"
                                            fallbackClassName="text-xs font-semibold"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex min-w-0 items-start gap-1.5">
                                                <UserIdentityPresentation
                                                    surface={identitySurface}
                                                    layout="stacked"
                                                    compact
                                                    identityPresentation={
                                                        entry.identityPresentation
                                                    }
                                                    username={
                                                        <Link
                                                            href={getProfileUrl(
                                                                entry.userId,
                                                                entry.username,
                                                            )}
                                                            className="inline-flex min-h-11 max-w-full items-center truncate font-semibold text-inherit underline-offset-4 hover:underline"
                                                            onClick={() =>
                                                                handleProfileClick(
                                                                    entry.userId,
                                                                    entry.username,
                                                                    entry.rank,
                                                                )
                                                            }
                                                        >
                                                            {entry.username}
                                                        </Link>
                                                    }
                                                />
                                                <LevelMark level={entry.level} />
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-[var(--platform-ink-muted)]">
                                                {entry.country ? (
                                                    <CountryFlag
                                                        countryCode={entry.country.code}
                                                        countryName={entry.country.name}
                                                        size="sm"
                                                        showName={false}
                                                    />
                                                ) : null}
                                                {current ? <span>{tCommon('you')}</span> : null}
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-end">
                                            <p className="text-lg font-semibold tabular-nums tracking-[-0.035em] text-[var(--platform-ink)]">
                                                {formatScore(entry.totalScore)}
                                            </p>
                                            <p className="text-[10px] text-[var(--platform-ink-muted)]">
                                                {tStats('totalScore')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="hidden sm:block">
                                        <div className="flex items-start justify-between gap-4">
                                            <RankMark rank={entry.rank} />
                                            <span className="text-xs font-semibold tabular-nums text-[var(--platform-ink-muted)]">
                                                0{index + 1}
                                            </span>
                                        </div>

                                        <div className="mt-6 flex items-center gap-3">
                                            <UserAvatar
                                                avatar={entry.avatar}
                                                fallbackInitials={entry.avatarInitials}
                                                userId={entry.userId}
                                                username={entry.username}
                                                loading="eager"
                                                className="h-14 w-14 shrink-0 border border-[var(--platform-line-strong)]"
                                                fallbackClassName="text-sm font-semibold"
                                            />
                                            <div className="min-w-0">
                                                <div className="flex min-w-0 items-start gap-2">
                                                    <UserIdentityPresentation
                                                        surface={identitySurface}
                                                        layout="stacked"
                                                        compact
                                                        identityPresentation={
                                                            entry.identityPresentation
                                                        }
                                                        username={
                                                            <Link
                                                                href={getProfileUrl(
                                                                    entry.userId,
                                                                    entry.username,
                                                                )}
                                                                className="inline-flex min-h-11 min-w-0 items-center truncate font-semibold text-inherit underline-offset-4 hover:underline"
                                                                onClick={() =>
                                                                    handleProfileClick(
                                                                        entry.userId,
                                                                        entry.username,
                                                                        entry.rank,
                                                                    )
                                                                }
                                                            >
                                                                {entry.username}
                                                            </Link>
                                                        }
                                                    />
                                                    <LevelMark level={entry.level} />
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-[var(--platform-ink-muted)]">
                                                    {entry.country ? (
                                                        <CountryFlag
                                                            countryCode={entry.country.code}
                                                            countryName={entry.country.name}
                                                            size="sm"
                                                            showName={false}
                                                        />
                                                    ) : null}
                                                    {current ? <span>{tCommon('you')}</span> : null}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-7 flex items-end justify-between gap-4 border-t border-[var(--platform-line)] pt-4">
                                            <div>
                                                <p className="text-3xl font-semibold tabular-nums tracking-[-0.045em] text-[var(--platform-ink)]">
                                                    {formatScore(entry.totalScore)}
                                                </p>
                                                <p className="mt-1 text-xs text-[var(--platform-ink-muted)]">
                                                    {tStats('totalScore')}
                                                </p>
                                            </div>
                                            <div className="text-end text-xs leading-5 text-[var(--platform-ink-muted-strong)]">
                                                <p>
                                                    {entry.solvedCount ?? 0} {tStats('solved')}
                                                </p>
                                                <p>
                                                    {formatScore(entry.averageScore ?? 0)}%{' '}
                                                    {tStats('average')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            ) : null}

            <section aria-label={t('fullLeaderboard')}>
                <div className="platform-panel border bg-card overflow-hidden">
                    <div
                        className="max-h-[42rem] overflow-auto overscroll-contain scrollbar-thin"
                        role="region"
                        aria-label={t('fullLeaderboard')}
                        tabIndex={0}
                    >
                        <table
                            className={cn(
                                'w-full border-collapse text-sm text-foreground text-[var(--platform-ink)]',
                                problems?.length && 'min-w-max',
                            )}
                        >
                            <thead className="sticky top-0 z-[1] bg-card bg-[var(--platform-paper-strong)]">
                                <tr className="border-b border-[var(--platform-line-strong)]">
                                    {showAwardRank ? (
                                        <th
                                            scope="col"
                                            className="h-12 w-16 px-3 text-start text-xs font-semibold text-[var(--platform-ink-muted-strong)]"
                                        >
                                            {t('awardRank')}
                                        </th>
                                    ) : null}
                                    <th
                                        scope="col"
                                        className="h-12 w-16 px-3 text-start text-xs font-semibold text-[var(--platform-ink-muted-strong)]"
                                    >
                                        {t('rank')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="h-12 min-w-36 px-3 text-start text-xs font-semibold text-[var(--platform-ink-muted-strong)] sm:px-4"
                                    >
                                        {t('user')}
                                    </th>
                                    {problems?.map((problem) => (
                                        <th
                                            key={problem.id}
                                            scope="col"
                                            className="h-12 px-4 text-end text-xs font-semibold text-[var(--platform-ink-muted-strong)]"
                                        >
                                            {getProblemContent(problem, locale).title}
                                        </th>
                                    ))}
                                    <th
                                        scope="col"
                                        className="h-12 min-w-24 px-3 text-end text-xs font-semibold text-[var(--platform-ink-muted-strong)] sm:px-4"
                                    >
                                        {t('score')}
                                    </th>
                                    {showMetric ? (
                                        <th
                                            scope="col"
                                            className="h-12 px-4 text-end text-xs font-semibold text-[var(--platform-ink-muted-strong)]"
                                        >
                                            {t('metric')}
                                        </th>
                                    ) : null}
                                    {showAttainedAt ? (
                                        <th
                                            scope="col"
                                            className="h-12 px-4 text-end text-xs font-semibold text-[var(--platform-ink-muted-strong)]"
                                        >
                                            {t('attainedAt')}
                                        </th>
                                    ) : null}
                                    {!simple ? (
                                        <>
                                            <th
                                                scope="col"
                                                className="hidden h-12 px-4 text-end text-xs font-semibold text-[var(--platform-ink-muted-strong)] sm:table-cell"
                                            >
                                                {t('problems')}
                                            </th>
                                            <th
                                                scope="col"
                                                className="hidden h-12 px-4 text-end text-xs font-semibold text-[var(--platform-ink-muted-strong)] md:table-cell"
                                            >
                                                {t('average')}
                                            </th>
                                        </>
                                    ) : null}
                                </tr>
                            </thead>
                            <tbody>
                                {displayedEntries.map((entry) => {
                                    const current = isCurrentUser(entry.userId);
                                    const pinned = isCurrentUserPinned && current;

                                    return (
                                        <tr
                                            key={entry.userId}
                                            aria-current={current ? 'true' : undefined}
                                            className={cn(
                                                'border-b border-[var(--platform-line)] last:border-b-0 hover:bg-muted/50 hover:bg-[var(--platform-paper-strong)] [content-visibility:auto] [contain-intrinsic-size:auto_3.5rem]',
                                                current &&
                                                    'bg-[color-mix(in_oklch,var(--platform-violet)_10%,transparent)]',
                                                pinned &&
                                                    'border-t-2 border-t-[var(--platform-violet)]',
                                            )}
                                        >
                                            {showAwardRank ? (
                                                <td className="px-3 py-2.5 align-middle">
                                                    {entry.awardRank ? (
                                                        <RankMark rank={entry.awardRank} />
                                                    ) : null}
                                                </td>
                                            ) : null}
                                            <td className="px-3 py-2.5 align-middle">
                                                <RankMark rank={entry.rank} />
                                            </td>
                                            <td className="min-w-0 px-3 py-2 align-middle sm:px-4">
                                                <div className="flex min-w-0 items-center gap-2.5">
                                                    <UserAvatar
                                                        avatar={entry.avatar}
                                                        fallbackInitials={entry.avatarInitials}
                                                        userId={entry.userId}
                                                        username={entry.username}
                                                        className="h-8 w-8 shrink-0 border border-[var(--platform-line)]"
                                                        fallbackClassName="text-[10px] font-semibold"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="flex min-w-0 items-start gap-1.5">
                                                            <UserIdentityPresentation
                                                                surface={identitySurface}
                                                                layout="stacked"
                                                                compact
                                                                identityPresentation={
                                                                    entry.identityPresentation
                                                                }
                                                                username={
                                                                    <Link
                                                                        href={getProfileUrl(
                                                                            entry.userId,
                                                                            entry.username,
                                                                        )}
                                                                        className="inline-flex min-h-11 min-w-0 items-center truncate font-semibold text-inherit underline-offset-4 hover:opacity-80 hover:underline"
                                                                        onClick={() =>
                                                                            handleProfileClick(
                                                                                entry.userId,
                                                                                entry.username,
                                                                                entry.rank,
                                                                            )
                                                                        }
                                                                    >
                                                                        {entry.username}
                                                                    </Link>
                                                                }
                                                            />
                                                            <LevelMark level={entry.level} />
                                                            {entry.country ? (
                                                                <CountryFlag
                                                                    countryCode={entry.country.code}
                                                                    countryName={entry.country.name}
                                                                    size="sm"
                                                                    showName={false}
                                                                    className="shrink-0"
                                                                />
                                                            ) : null}
                                                        </div>
                                                        {current ? (
                                                            <span className="block text-xs text-[var(--platform-violet)]">
                                                                {tCommon('you')}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </td>
                                            {problems?.map((problem) => (
                                                <td
                                                    key={problem.id}
                                                    className="px-4 py-2.5 text-end font-semibold tabular-nums"
                                                >
                                                    {formatScore(
                                                        entry.problemScores?.[problem.id] ?? 0,
                                                    )}
                                                </td>
                                            ))}
                                            <td className="px-3 py-2.5 text-end align-middle font-semibold tabular-nums sm:px-4">
                                                {formatScore(entry.totalScore)}
                                            </td>
                                            {showMetric ? (
                                                <td className="px-4 py-2.5 text-end align-middle font-semibold tabular-nums">
                                                    {entry.metric}
                                                </td>
                                            ) : null}
                                            {showAttainedAt ? (
                                                <td className="px-4 py-2.5 text-end align-middle">
                                                    <span className="block font-medium">
                                                        {formatShortDate(
                                                            entry.attainedAt as string,
                                                            locale,
                                                        )}
                                                    </span>
                                                    <span className="block text-xs text-[var(--platform-ink-muted)]">
                                                        {formatTime(
                                                            entry.attainedAt as string,
                                                            locale,
                                                        )}
                                                    </span>
                                                </td>
                                            ) : null}
                                            {!simple ? (
                                                <>
                                                    <td className="hidden px-4 py-2.5 text-end align-middle tabular-nums sm:table-cell">
                                                        {entry.solvedCount ?? 0}
                                                    </td>
                                                    <td className="hidden px-4 py-2.5 text-end align-middle tabular-nums md:table-cell">
                                                        {formatScore(entry.averageScore ?? 0)}%
                                                    </td>
                                                </>
                                            ) : null}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {hasMoreRows ? (
                        <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] px-4 py-4 sm:flex-row">
                            <span
                                className="text-sm font-medium tabular-nums text-[var(--platform-ink-muted-strong)]"
                                aria-live="polite"
                            >
                                {visibleResultsLabel}
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setVisibleBatchCount((count) => count + 1)}
                                className="min-h-11 w-full rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-5 shadow-none sm:w-auto"
                            >
                                {tProblems('loadMore')}
                            </Button>
                        </div>
                    ) : null}
                </div>
            </section>
        </div>
    );
}

function LeaderboardLoadingState({ simple }: { simple: boolean }) {
    const t = useTranslations('leaderboard');

    return (
        <div className={cn('space-y-6 sm:space-y-8', simple && 'space-y-0')} aria-busy="true">
            {!simple ? (
                <PlatformSectionHeading
                    title={t('fullLeaderboard')}
                    description={t('loadingLeaderboard')}
                />
            ) : null}

            {!simple ? (
                <div className="platform-panel border bg-card grid overflow-hidden md:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div
                            key={index}
                            className="border-b border-[var(--platform-line)] p-6 last:border-b-0 md:border-b-0 md:border-e md:last:border-e-0"
                        >
                            <div className="h-8 w-14 animate-pulse bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                            <div className="mt-6 flex items-center gap-3">
                                <div className="h-12 w-12 animate-pulse rounded-full bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                                <div className="h-5 w-28 animate-pulse bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                            </div>
                            <div className="mt-7 h-9 w-32 animate-pulse bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                        </div>
                    ))}
                </div>
            ) : null}

            <div className="platform-panel border bg-card overflow-hidden">
                <div className="border-b border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] px-4 py-4">
                    <div className="h-4 w-44 animate-pulse bg-[var(--platform-line)] motion-reduce:animate-none" />
                </div>
                {Array.from({ length: simple ? 5 : 10 }).map((_, index) => (
                    <div
                        key={index}
                        className="flex h-14 items-center gap-4 border-b border-[var(--platform-line)] px-4 last:border-b-0"
                    >
                        <div className="h-7 w-9 animate-pulse bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                        <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                        <div className="h-4 flex-1 animate-pulse bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                        <div className="h-4 w-20 animate-pulse bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                    </div>
                ))}
            </div>
        </div>
    );
}
