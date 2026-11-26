'use client';

import * as React from 'react';
import { Trophy, Medal, Award, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { UserAvatar } from '@/components/user-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { fetchAchievementLeaderboard } from '@/lib/api';
import type { AchievementLeaderboardEntry } from '@/lib/types';
import { LevelBadge } from '@/components/level/level-badge';
import type { LevelTier } from '@/lib/level/types';
import { PlatformEmptyState, PlatformSectionHeading } from '@/components/platform-page-shell';
import { UserIdentityPresentation } from '@/components/user-identity-presentation';

type SortBy = 'achievements' | 'xp';

export interface AchievementLeaderboardProps {
    /** Current user's ID for highlighting */
    currentUserId?: string;
    /** Callback when a user is selected for comparison */
    onUserSelect?: (userId: string) => void;
    /** Additional CSS classes */
    className?: string;
}

/**
 * AchievementLeaderboard displays a ranked list of users by achievements or XP.
 *
 * Features:
 * - Sort by total achievements or XP
 * - Pagination support
 * - Current user highlighting
 * - Click to compare with another user
 *
 * Requirements: 11.2
 */
export function AchievementLeaderboard({
    currentUserId,
    onUserSelect,
    className,
}: AchievementLeaderboardProps) {
    const t = useTranslations('achievements');
    const format = useFormatter();
    const [entries, setEntries] = React.useState<AchievementLeaderboardEntry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [sortBy, setSortBy] = React.useState<SortBy>('achievements');
    const [page, setPage] = React.useState(0);
    const [totalPages, setTotalPages] = React.useState(0);
    const [totalElements, setTotalElements] = React.useState(0);
    const pageSize = 20;

    // Fetch leaderboard data
    React.useEffect(() => {
        async function loadLeaderboard() {
            try {
                setLoading(true);
                setError(null);
                const data = await fetchAchievementLeaderboard(page, pageSize, sortBy);
                setEntries(data.content);
                setTotalPages(data.totalPages);
                setTotalElements(data.totalElements);
            } catch (err) {
                setError(err instanceof Error ? err.message : t('errorLoading'));
            } finally {
                setLoading(false);
            }
        }

        loadLeaderboard();
    }, [page, sortBy]);

    // Reset page when sort changes
    const handleSortChange = (newSort: SortBy) => {
        setSortBy(newSort);
        setPage(0);
    };

    if (error) {
        return (
            <PlatformEmptyState
                className={className}
                icon={Trophy}
                title={t('errorLoading')}
                description={error}
            />
        );
    }

    return (
        <section className={className}>
            <PlatformSectionHeading
                eyebrow={t('leaderboard')}
                title={t('achievementLeaderboard')}
                description={
                    totalElements > 0 ? (
                        <>
                            {format.number(totalElements)} {t('usersRanked')}{' '}
                            {sortBy === 'achievements'
                                ? t('byAchievements').toLowerCase()
                                : t('byXp').toLowerCase()}
                        </>
                    ) : undefined
                }
                action={
                    <Select value={sortBy} onValueChange={(v) => handleSortChange(v as SortBy)}>
                        <SelectTrigger
                            className="h-12 w-[180px] rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] text-[var(--platform-ink)]"
                            aria-label={t('sortBy')}
                        >
                            <SelectValue placeholder={t('sortBy')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="achievements">{t('byAchievements')}</SelectItem>
                            <SelectItem value="xp">{t('byXp')}</SelectItem>
                        </SelectContent>
                    </Select>
                }
            />

            {loading ? (
                <LeaderboardSkeleton />
            ) : entries.length === 0 ? (
                <PlatformEmptyState
                    className="mt-6"
                    icon={Trophy}
                    title={t('noUsersOnLeaderboard')}
                />
            ) : (
                <div className="mt-6 border-y border-[var(--platform-line-strong)]">
                    {entries.map((entry) => (
                        <LeaderboardRow
                            key={entry.userId}
                            entry={entry}
                            isCurrentUser={entry.userId === currentUserId}
                            sortBy={sortBy}
                            onClick={onUserSelect ? () => onUserSelect(entry.userId) : undefined}
                        />
                    ))}
                </div>
            )}

            {totalPages > 1 && !loading && (
                <nav
                    className="mt-6 flex flex-col gap-4 border-t border-[var(--platform-line)] pt-5 sm:flex-row sm:items-center sm:justify-between"
                    aria-label={t('achievementLeaderboard')}
                >
                    <p className="text-sm font-medium tabular-nums text-[var(--platform-ink-muted)]">
                        {t('page')} {format.number(page + 1)} {t('of')} {format.number(totalPages)}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="min-h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)]"
                            onClick={() => setPage((value) => Math.max(0, value - 1))}
                            disabled={page === 0}
                        >
                            <ChevronLeft className="me-1 h-4 w-4 rtl:rotate-180" />
                            {t('previous')}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="min-h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)]"
                            onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
                            disabled={page >= totalPages - 1}
                        >
                            {t('next')}
                            <ChevronRight className="ms-1 h-4 w-4 rtl:rotate-180" />
                        </Button>
                    </div>
                </nav>
            )}
        </section>
    );
}

// Leaderboard Row Component
function LeaderboardRow({
    entry,
    isCurrentUser,
    sortBy,
    onClick,
}: {
    entry: AchievementLeaderboardEntry;
    isCurrentUser: boolean;
    sortBy: SortBy;
    onClick?: () => void;
}) {
    const tCommon = useTranslations('common');
    const format = useFormatter();
    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Medal className="h-5 w-5 text-yellow-500" />;
            case 2:
                return <Medal className="h-5 w-5 text-gray-400" />;
            case 3:
                return <Medal className="h-5 w-5 text-amber-600" />;
            default:
                return (
                    <span className="w-5 text-center font-mono text-muted-foreground">
                        {format.number(rank)}
                    </span>
                );
        }
    };
    const rowClassName = cn(
        'grid min-h-20 w-full grid-cols-[2.5rem_2.5rem_minmax(0,1fr)] items-center gap-3 border-b border-[var(--platform-line)] px-2 py-3 text-start transition-colors last:border-b-0 sm:grid-cols-[3rem_2.5rem_minmax(0,1fr)_auto] sm:px-4',
        isCurrentUser
            ? 'bg-[var(--platform-paper-strong)] shadow-[inset_0_0_0_2px_var(--platform-citron)]'
            : 'hover:bg-[var(--platform-paper-strong)]',
        onClick &&
            'cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--platform-coral)]',
    );

    const rowContent = (
        <>
            {/* Rank */}
            <div className="flex h-10 w-10 items-center justify-center bg-[var(--platform-paper-strong)] font-mono font-semibold tabular-nums text-[var(--platform-ink-muted-strong)]">
                {getRankIcon(entry.rank)}
            </div>

            {/* Avatar */}
            <UserAvatar
                avatar={entry.avatarUrl}
                userId={entry.userId}
                username={entry.username}
                className="h-10 w-10 border border-[var(--platform-line)]"
                loading="lazy"
            />

            {/* Username with Level Badge */}
            <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <UserIdentityPresentation
                        username={entry.username}
                        identityPresentation={entry.identityPresentation}
                        surface="GLOBAL_LEADERBOARD"
                        compact
                        usernameClassName={cn(
                            'truncate font-semibold text-[var(--platform-ink)]',
                            isCurrentUser && 'text-[var(--platform-violet)]',
                        )}
                    />
                    {isCurrentUser ? (
                        <span className="text-xs text-[var(--platform-ink-muted)]">
                            ({tCommon('you')})
                        </span>
                    ) : null}
                    {entry.level && (
                        <LevelBadge level={entry.level} tier={entry.tier as LevelTier} size="xs" />
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="col-span-3 flex items-center justify-end gap-5 border-t border-[var(--platform-line)] pt-3 text-sm tabular-nums sm:col-span-1 sm:border-t-0 sm:pt-0">
                <div
                    className={cn(
                        'flex items-center gap-1',
                        sortBy === 'achievements' && 'font-semibold text-[var(--platform-violet)]',
                    )}
                >
                    <Award className="h-4 w-4" />
                    <span>{format.number(entry.totalAchievements)}</span>
                </div>
                <div
                    className={cn(
                        'flex min-w-[80px] items-center justify-end gap-1',
                        sortBy === 'xp' && 'font-semibold text-[var(--platform-violet)]',
                    )}
                >
                    <span>{format.number(entry.totalXp)} XP</span>
                </div>
            </div>
        </>
    );

    const accessibleLabel = `${entry.username}, rank ${format.number(entry.rank)}, ${format.number(entry.totalAchievements)} achievements, ${format.number(entry.totalXp)} XP`;

    if (onClick) {
        return (
            <button
                type="button"
                className={rowClassName}
                onClick={onClick}
                aria-label={accessibleLabel}
            >
                {rowContent}
            </button>
        );
    }

    return (
        <div className={rowClassName} aria-label={accessibleLabel}>
            {rowContent}
        </div>
    );
}

// Loading Skeleton
function LeaderboardSkeleton() {
    return (
        <div className="mt-6 border-y border-[var(--platform-line)]">
            {[...Array(10)].map((_, i) => (
                <div
                    key={i}
                    className="flex min-h-20 items-center gap-4 border-b border-[var(--platform-line)] p-3 last:border-b-0"
                >
                    <Skeleton className="h-10 w-10 rounded-none" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-5 flex-1" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                </div>
            ))}
        </div>
    );
}

export default AchievementLeaderboard;
