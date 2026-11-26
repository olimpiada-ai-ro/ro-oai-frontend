import { ArrowUpRight, CalendarDays, Layers3, ListOrdered, Trophy, Users } from 'lucide-react';

import { Link } from '@/i18n/routing';
import {
    getCompetitionSeriesCellScore,
    getCompetitionSeriesScoreColumns,
} from '@/lib/competition-series/view-model';
import type {
    CompetitionSeriesChild,
    CompetitionSeriesChildLeaderboard,
    CompetitionSeriesDetail,
    CompetitionSeriesLeaderboard,
    CompetitionSeriesLeaderboardRow,
} from '@/lib/competition-series/types';
import type { Locale } from '@/lib/types';
import { getProfileUrl } from '@/lib/profile-utils';
import {
    PlatformEmptyState,
    PlatformPageHeader,
    PlatformPageShell,
    PlatformSectionHeading,
} from '@/components/platform-page-shell';
import { cn } from '@/lib/utils';
import { UserIdentityPresentation } from '@/components/user-identity-presentation';
import type { IdentityPresentationSurface } from '@/lib/identity-presentation';

export type CompetitionSeriesMessages = {
    eyebrow: string;
    modes: { multiRound: string; divisions: string };
    tabs: { overview: string; children: string; combined: string };
    period: string;
    periodHint: string;
    starts: string;
    ends: string;
    events: (count: number) => string;
    problems: (count: number) => string;
    roundLabel: (number: number) => string;
    divisionLabel: (number: number) => string;
    childrenTitle: string;
    childrenMultiRoundDescription: string;
    childrenDivisionsDescription: string;
    viewCompetition: string;
    viewLeaderboard: string;
    combinedTitle: string;
    combinedDescription: string;
    childLeaderboardsTitle: string;
    childLeaderboardsDescription: string;
    rank: string;
    participant: string;
    total: string;
    roundTotals: string;
    problemScores: string;
    noResults: string;
    unavailable: string;
};

type Props = {
    series: CompetitionSeriesDetail;
    leaderboard: CompetitionSeriesLeaderboard | null;
    locale: Locale;
    messages: CompetitionSeriesMessages;
};

function safeDate(value: string): Date | null {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
}

function dateRange(series: CompetitionSeriesDetail, locale: Locale): string {
    const start = safeDate(series.startTime);
    const end = safeDate(series.endTime);
    if (!start || !end) return '—';
    const formatter = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Bucharest',
    });
    return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function scoreFormatter(locale: Locale) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
}

function SeriesChildRow({
    child,
    index,
    locale,
    label,
    leaderboardComplete,
    messages,
}: {
    child: CompetitionSeriesChild;
    index: number;
    locale: Locale;
    label: (number: number) => string;
    leaderboardComplete: boolean;
    messages: CompetitionSeriesMessages;
}) {
    const start = safeDate(child.startTime);
    const end = safeDate(child.endTime);
    const formatter = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Bucharest',
    });

    return (
        <article className="group grid gap-4 border-b border-[var(--platform-line)] px-4 py-5 last:border-b-0 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-center sm:px-6">
            <span className="font-mono text-sm font-bold tabular-nums text-[var(--platform-violet)]">
                {String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.09em] text-[var(--platform-ink-muted)]">
                    {label(index + 1)}
                </p>
                <h3 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[var(--platform-ink)]">
                    {child.name}
                </h3>
                {child.shortDescription ? (
                    <p className="mt-1 line-clamp-2 max-w-[68ch] text-sm leading-6 text-[var(--platform-ink-muted)]">
                        {child.shortDescription}
                    </p>
                ) : null}
                <dl className="mt-3 grid gap-x-5 gap-y-2 text-xs text-[var(--platform-ink-muted-strong)] sm:grid-cols-2">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                        <dt className="font-bold uppercase tracking-[0.06em] text-[var(--platform-ink-muted)]">
                            {messages.starts}
                        </dt>
                        <dd className="font-medium text-[var(--platform-ink)]">
                            {start ? (
                                <time dateTime={child.startTime}>{formatter.format(start)}</time>
                            ) : (
                                '—'
                            )}
                        </dd>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                        <dt className="font-bold uppercase tracking-[0.06em] text-[var(--platform-ink-muted)]">
                            {messages.ends}
                        </dt>
                        <dd className="font-medium text-[var(--platform-ink)]">
                            {end ? (
                                <time dateTime={child.endTime}>{formatter.format(end)}</time>
                            ) : (
                                '—'
                            )}
                        </dd>
                    </div>
                </dl>
                <p className="mt-2 text-xs text-[var(--platform-ink-muted-strong)]">
                    {messages.problems(child.problemCount)}
                </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
                <Link
                    href={{
                        pathname: `/competitions/${child.id}`,
                        query: { tab: leaderboardComplete ? 'final' : 'partial' },
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-4 text-sm font-semibold text-[var(--platform-ink)] transition-colors hover:border-[var(--platform-violet)] hover:text-[var(--platform-violet)]"
                >
                    {messages.viewLeaderboard}
                </Link>
                <Link
                    href={`/competitions/${child.id}`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--platform-violet)] px-4 text-sm font-semibold text-[var(--platform-paper)] transition-colors hover:bg-[var(--platform-violet-strong)]"
                >
                    {messages.viewCompetition}
                    <ArrowUpRight className="h-4 w-4 rtl:-rotate-90" aria-hidden="true" />
                </Link>
            </div>
        </article>
    );
}

function Rank({ rank }: { rank: number }) {
    return (
        <span
            className={cn(
                'inline-flex min-h-8 min-w-8 items-center justify-center px-2 text-xs font-bold tabular-nums',
                rank === 1
                    ? 'bg-[var(--platform-citron)] text-[var(--platform-on-accent)]'
                    : 'border border-[var(--platform-line)] text-[var(--platform-ink-muted-strong)]',
            )}
        >
            #{rank}
        </span>
    );
}

function ParticipantLink({
    row,
    identitySurface,
}: {
    row: CompetitionSeriesLeaderboardRow;
    identitySurface: IdentityPresentationSurface;
}) {
    return (
        <UserIdentityPresentation
            surface={identitySurface}
            layout="stacked"
            compact
            identityPresentation={row.user.identityPresentation}
            username={
                <Link
                    href={getProfileUrl(row.user.id, row.user.username)}
                    className="block max-w-full truncate font-semibold text-inherit underline-offset-4 hover:opacity-80 hover:underline"
                >
                    {row.user.username}
                </Link>
            }
        />
    );
}

function ScoreMatrix({
    rows,
    locale,
    messages,
    identitySurface,
}: {
    rows: CompetitionSeriesLeaderboardRow[];
    locale: Locale;
    messages: CompetitionSeriesMessages;
    identitySurface: IdentityPresentationSurface;
}) {
    if (!rows.length) {
        return <PlatformEmptyState icon={Trophy} title={messages.noResults} />;
    }

    const columns = getCompetitionSeriesScoreColumns(rows);
    const format = scoreFormatter(locale);
    const formatScore = (score: number | null) => (score === null ? '—' : format.format(score));

    return (
        <>
            <div className="space-y-3 md:hidden" role="list">
                {rows.map((row) => (
                    <article
                        key={`${row.rank}:${row.user.id}`}
                        className="platform-panel p-4"
                        role="listitem"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <Rank rank={row.rank} />
                                <ParticipantLink row={row} identitySurface={identitySurface} />
                            </div>
                            <strong className="font-mono text-lg tabular-nums text-[var(--platform-violet)]">
                                {formatScore(row.totalScore)}
                            </strong>
                        </div>
                        {row.rounds.length ? (
                            <dl className="mt-4 grid grid-cols-2 gap-px border border-[var(--platform-line)] bg-[var(--platform-line)]">
                                {row.rounds.map((score) => (
                                    <div
                                        key={`${score.competitionId}:${score.id}`}
                                        className="bg-[var(--platform-paper)] p-3"
                                    >
                                        <dt className="truncate text-xs text-[var(--platform-ink-muted)]">
                                            {score.name}
                                        </dt>
                                        <dd className="mt-1 font-mono text-sm font-bold tabular-nums text-[var(--platform-ink)]">
                                            {formatScore(score.score)}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        ) : null}
                        {row.problems.length ? (
                            <div className="mt-4">
                                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                                    {messages.problemScores}
                                </p>
                                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
                                    {row.problems.map((score) => (
                                        <div key={`${score.competitionId}:${score.id}`}>
                                            <dt className="truncate text-xs text-[var(--platform-ink-muted)]">
                                                {score.name}
                                            </dt>
                                            <dd className="mt-0.5 font-mono text-sm font-bold tabular-nums text-[var(--platform-ink)]">
                                                {formatScore(score.score)}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        ) : null}
                    </article>
                ))}
            </div>

            <div className="platform-panel hidden overflow-x-auto md:block" tabIndex={0}>
                <table className="min-w-full border-collapse text-sm">
                    <caption className="sr-only">{messages.combinedTitle}</caption>
                    <thead>
                        <tr className="border-b border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] text-start">
                            <th
                                rowSpan={2}
                                scope="col"
                                className="sticky start-0 z-20 bg-[var(--platform-paper-strong)] px-4 py-3 text-start"
                            >
                                {messages.rank}
                            </th>
                            <th
                                rowSpan={2}
                                scope="col"
                                className="sticky start-[4.5rem] z-20 min-w-48 bg-[var(--platform-paper-strong)] px-4 py-3 text-start"
                            >
                                {messages.participant}
                            </th>
                            <th rowSpan={2} scope="col" className="px-4 py-3 text-end">
                                {messages.total}
                            </th>
                            {columns.rounds.length ? (
                                <th
                                    colSpan={columns.rounds.length}
                                    scope="colgroup"
                                    className="border-s border-[var(--platform-line)] px-4 py-3 text-center"
                                >
                                    {messages.roundTotals}
                                </th>
                            ) : null}
                            {columns.problems.length ? (
                                <th
                                    colSpan={columns.problems.length}
                                    scope="colgroup"
                                    className="border-s border-[var(--platform-line)] px-4 py-3 text-center"
                                >
                                    {messages.problemScores}
                                </th>
                            ) : null}
                        </tr>
                        <tr className="border-b border-[var(--platform-line)] bg-[var(--platform-paper-strong)]">
                            {columns.rounds.map((column) => (
                                <th
                                    key={`round:${column.id}`}
                                    scope="col"
                                    className="min-w-28 border-s border-[var(--platform-line)] px-3 py-2 text-end text-xs font-semibold text-[var(--platform-ink-muted-strong)]"
                                >
                                    {column.name}
                                </th>
                            ))}
                            {columns.problems.map((column) => (
                                <th
                                    key={`problem:${column.competitionId}:${column.id}`}
                                    scope="col"
                                    className="min-w-28 border-s border-[var(--platform-line)] px-3 py-2 text-end text-xs font-semibold text-[var(--platform-ink-muted-strong)]"
                                >
                                    {column.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr
                                key={`${row.rank}:${row.user.id}`}
                                className="border-b border-[var(--platform-line)] last:border-b-0 hover:bg-[var(--platform-paper-strong)]"
                            >
                                <td className="sticky start-0 z-10 bg-[var(--platform-paper)] px-4 py-3">
                                    <Rank rank={row.rank} />
                                </td>
                                <th
                                    scope="row"
                                    className="sticky start-[4.5rem] z-10 bg-[var(--platform-paper)] px-4 py-3 text-start"
                                >
                                    <ParticipantLink row={row} identitySurface={identitySurface} />
                                </th>
                                <td className="px-4 py-3 text-end font-mono font-bold tabular-nums text-[var(--platform-violet)]">
                                    {formatScore(row.totalScore)}
                                </td>
                                {columns.rounds.map((column) => (
                                    <td
                                        key={`round:${column.id}`}
                                        className="border-s border-[var(--platform-line)] px-3 py-3 text-end font-mono tabular-nums"
                                    >
                                        {formatScore(
                                            getCompetitionSeriesCellScore(row, 'rounds', column),
                                        )}
                                    </td>
                                ))}
                                {columns.problems.map((column) => (
                                    <td
                                        key={`problem:${column.competitionId}:${column.id}`}
                                        className="border-s border-[var(--platform-line)] px-3 py-3 text-end font-mono tabular-nums"
                                    >
                                        {formatScore(
                                            getCompetitionSeriesCellScore(row, 'problems', column),
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

function ChildLeaderboardSection({
    section,
    child,
    locale,
    messages,
}: {
    section: CompetitionSeriesChildLeaderboard;
    child?: CompetitionSeriesChild;
    locale: Locale;
    messages: CompetitionSeriesMessages;
}) {
    const format = scoreFormatter(locale);
    return (
        <section
            className="platform-panel overflow-hidden"
            aria-labelledby={`child-leaderboard-${section.competitionId}`}
        >
            <div className="flex flex-col gap-3 border-b border-[var(--platform-line)] bg-[var(--platform-paper-strong)] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <h3
                    id={`child-leaderboard-${section.competitionId}`}
                    className="text-lg font-semibold text-[var(--platform-ink)]"
                >
                    {child?.name ?? section.competitionName}
                </h3>
                <Link
                    href={{
                        pathname: `/competitions/${section.competitionId}`,
                        query: { tab: section.complete ? 'final' : 'partial' },
                    }}
                    className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--platform-violet)] underline-offset-4 hover:underline"
                >
                    {messages.viewLeaderboard}
                    <ArrowUpRight className="h-4 w-4 rtl:-rotate-90" aria-hidden="true" />
                </Link>
            </div>
            {section.entries.length ? (
                <ol className="divide-y divide-[var(--platform-line)]">
                    {section.entries.map((row) => (
                        <li
                            key={`${row.rank}:${row.user.id}`}
                            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6"
                        >
                            <Rank rank={row.rank} />
                            <div className="min-w-0">
                                <ParticipantLink
                                    row={row}
                                    identitySurface={
                                        child?.competitionType === 'CASUAL'
                                            ? 'CASUAL_COMPETITION_LEADERBOARD'
                                            : 'RESTRICTED_COMPETITION_LEADERBOARD'
                                    }
                                />
                            </div>
                            <strong className="font-mono text-sm tabular-nums text-[var(--platform-violet)]">
                                {format.format(row.totalScore)}
                            </strong>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="p-6 text-sm text-[var(--platform-ink-muted)]">{messages.noResults}</p>
            )}
        </section>
    );
}

export function CompetitionSeriesView({ series, leaderboard, locale, messages }: Props) {
    const multiRound = series.mode === 'MULTI_ROUND';
    const totalProblems = series.children.reduce((sum, child) => sum + child.problemCount, 0);
    const childById = new Map(series.children.map((child) => [child.id, child]));
    const completedLeaderboards = new Set(
        leaderboard?.children
            .filter((section) => section.complete)
            .map((section) => section.competitionId) ?? [],
    );
    const modeLabel = multiRound ? messages.modes.multiRound : messages.modes.divisions;
    const childLabel = multiRound ? messages.roundLabel : messages.divisionLabel;
    const combinedIdentitySurface: IdentityPresentationSurface =
        series.children.length > 0 &&
        series.children.every((child) => child.competitionType === 'CASUAL')
            ? 'CASUAL_COMPETITION_LEADERBOARD'
            : 'RESTRICTED_COMPETITION_LEADERBOARD';

    return (
        <PlatformPageShell>
            <PlatformPageHeader
                eyebrow={messages.eyebrow}
                icon={Layers3}
                title={series.name}
                description={series.shortDescription || undefined}
                aside={
                    <span className="inline-flex min-h-9 items-center border border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] px-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-violet)]">
                        {modeLabel}
                    </span>
                }
            />

            <nav className="platform-toolbar mt-8 overflow-x-auto" aria-label={messages.eyebrow}>
                <div className="flex min-w-max">
                    <a
                        href="#overview"
                        className="inline-flex min-h-12 items-center border-b-[3px] border-[var(--platform-violet)] bg-[var(--platform-paper-strong)] px-5 text-sm font-semibold text-[var(--platform-violet)]"
                    >
                        {messages.tabs.overview}
                    </a>
                    <a
                        href="#children"
                        className="inline-flex min-h-12 items-center border-b-[3px] border-transparent px-5 text-sm font-semibold text-[var(--platform-ink-muted)] hover:bg-[var(--platform-paper-strong)] hover:text-[var(--platform-ink)]"
                    >
                        {messages.tabs.children}
                    </a>
                    {multiRound ? (
                        <a
                            href="#combined"
                            className="inline-flex min-h-12 items-center border-b-[3px] border-transparent px-5 text-sm font-semibold text-[var(--platform-ink-muted)] hover:bg-[var(--platform-paper-strong)] hover:text-[var(--platform-ink)]"
                        >
                            {messages.tabs.combined}
                        </a>
                    ) : null}
                </div>
            </nav>

            <section id="overview" className="scroll-mt-24 pt-8" aria-labelledby="overview-title">
                <h2 id="overview-title" className="sr-only">
                    {messages.tabs.overview}
                </h2>
                <div className="grid border-y border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] sm:grid-cols-3">
                    <div className="flex items-start gap-3 border-b border-[var(--platform-line)] p-5 sm:border-b-0 sm:border-e">
                        <CalendarDays
                            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--platform-violet)]"
                            aria-hidden="true"
                        />
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                                {messages.period}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-[var(--platform-ink)]">
                                {dateRange(series, locale)}
                            </p>
                            <p className="mt-1 max-w-[34ch] text-xs leading-5 text-[var(--platform-ink-muted)]">
                                {messages.periodHint}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 border-b border-[var(--platform-line)] p-5 sm:border-b-0 sm:border-e">
                        <ListOrdered
                            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--platform-violet)]"
                            aria-hidden="true"
                        />
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                                {modeLabel}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-[var(--platform-ink)]">
                                {messages.events(series.children.length)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-5">
                        <Trophy
                            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--platform-violet)]"
                            aria-hidden="true"
                        />
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                                {messages.problemScores}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-[var(--platform-ink)]">
                                {messages.problems(totalProblems)}
                            </p>
                        </div>
                    </div>
                </div>
                {series.description ? (
                    <div
                        className="themed-html mt-8 max-w-[75ch]"
                        dangerouslySetInnerHTML={{ __html: series.description }}
                    />
                ) : null}
            </section>

            <section id="children" className="scroll-mt-24 pt-14" aria-labelledby="children-title">
                <PlatformSectionHeading
                    titleId="children-title"
                    title={messages.childrenTitle}
                    description={
                        multiRound
                            ? messages.childrenMultiRoundDescription
                            : messages.childrenDivisionsDescription
                    }
                    action={
                        <span className="font-mono text-sm font-bold tabular-nums text-[var(--platform-ink-muted-strong)]">
                            {series.children.length}
                        </span>
                    }
                />
                <div className="mt-5 border-y border-[var(--platform-line-strong)]">
                    {series.children.length ? (
                        series.children.map((child, index) => (
                            <SeriesChildRow
                                key={child.id}
                                child={child}
                                index={index}
                                locale={locale}
                                label={childLabel}
                                leaderboardComplete={completedLeaderboards.has(child.id)}
                                messages={messages}
                            />
                        ))
                    ) : (
                        <PlatformEmptyState icon={ListOrdered} title={messages.unavailable} />
                    )}
                </div>
            </section>

            {multiRound ? (
                <section
                    id="combined"
                    className="scroll-mt-24 pt-14"
                    aria-labelledby="combined-title"
                >
                    <PlatformSectionHeading
                        titleId="combined-title"
                        title={messages.combinedTitle}
                        description={messages.combinedDescription}
                        action={
                            <Users
                                className="h-5 w-5 text-[var(--platform-violet)]"
                                aria-hidden="true"
                            />
                        }
                    />
                    <div className="mt-5">
                        {leaderboard?.combined ? (
                            <ScoreMatrix
                                rows={leaderboard.combined}
                                locale={locale}
                                messages={messages}
                                identitySurface={combinedIdentitySurface}
                            />
                        ) : (
                            <PlatformEmptyState icon={Trophy} title={messages.unavailable} />
                        )}
                    </div>
                </section>
            ) : null}

            <section className="pt-14" aria-labelledby="child-leaderboards-title">
                <PlatformSectionHeading
                    titleId="child-leaderboards-title"
                    title={messages.childLeaderboardsTitle}
                    description={messages.childLeaderboardsDescription}
                />
                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    {leaderboard?.children.length ? (
                        leaderboard.children.map((section) => (
                            <ChildLeaderboardSection
                                key={section.competitionId}
                                section={section}
                                child={childById.get(section.competitionId)}
                                locale={locale}
                                messages={messages}
                            />
                        ))
                    ) : (
                        <PlatformEmptyState
                            className="lg:col-span-2"
                            icon={Trophy}
                            title={messages.noResults}
                        />
                    )}
                </div>
            </section>
        </PlatformPageShell>
    );
}
