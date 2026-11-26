'use client';

import dynamic from 'next/dynamic';
import { Fragment, useMemo } from 'react';
import { ArrowUpRight, Layers3, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { AntiCheatBadge } from '@/components/anti-cheat-badge';
import { CompetitionScoringBadge } from '@/components/competition-scoring-badge';
import StatusPillInner from '@/components/competition-status-pill';
import { useLocale } from '@/hooks/use-locale';
import { Link } from '@/i18n/routing';
import { getCompetitionContent, TranslatableCompetition } from '@/lib/competition-translations';
import { hasLiveFinalScores, sortCompetitions } from '@/lib/competition-utils';
import type { CompetitionUserListResponse } from '@/lib/types';
import { cn } from '@/lib/utils';

const CompetitionDateDisplayClient = dynamic(
    () =>
        import('@/components/competition-date-display').then((mod) => ({
            default: mod.CompetitionDateDisplay,
        })),
    { ssr: false },
);

const StatusPillClient = dynamic(() => Promise.resolve(StatusPillInner), { ssr: false });

type CompetitionRowProps = {
    competition: CompetitionUserListResponse;
    indexLabel: string;
    nested?: boolean;
};

function CompetitionRow({ competition, indexLabel, nested = false }: CompetitionRowProps) {
    const t = useTranslations('competitions');
    const tAccessibility = useTranslations('accessibility');
    const { locale } = useLocale();
    const content = getCompetitionContent(
        competition as unknown as TranslatableCompetition,
        locale,
    );
    const detailsLabel = competition.highlighted
        ? `${content.name} - ${tAccessibility('highlightedCompetition')}`
        : tAccessibility('viewDetailsFor', { title: content.name });
    const accessibleLabel = hasLiveFinalScores(competition.competitionType)
        ? `${detailsLabel}. ${t('scoring.visibleDescription')}`
        : competition.competitionType === 'HYBRID'
          ? `${detailsLabel}. ${t('hybrid.format')}`
          : detailsLabel;

    return (
        <Link
            href={{ pathname: `/competitions/${competition.id}` }}
            className={cn(
                'group relative grid min-h-44 grid-cols-[2.25rem_minmax(0,1fr)] gap-4 border-b border-[var(--platform-line)] px-4 py-6 outline-none transition-[background-color,transform] duration-200 ease-out hover:bg-[var(--platform-paper-strong)] focus-visible:bg-[var(--platform-paper-strong)] sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:items-start sm:gap-5 sm:px-6',
                competition.highlighted &&
                    'bg-[color-mix(in_oklch,var(--platform-citron)_12%,var(--platform-paper))]',
                nested && 'min-h-36 sm:pl-10',
            )}
            aria-label={accessibleLabel}
        >
            <span
                className="font-mono text-sm font-bold tabular-nums text-[var(--platform-violet)]"
                aria-hidden="true"
            >
                {indexLabel}
            </span>

            <div className="min-w-0 pe-12 sm:pe-0">
                <div className="flex flex-wrap items-center gap-2">
                    <StatusPillClient
                        startIso={competition.startTime}
                        endIso={competition.endTime}
                    />
                    <CompetitionScoringBadge competitionType={competition.competitionType} />
                    <AntiCheatBadge enabled={competition.antiCheatEnabled === true} size="sm" />
                    {competition.parentSeries ? (
                        <span className="inline-flex min-h-7 items-center gap-1.5 border border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-2.5 text-xs font-semibold text-[var(--platform-ink-muted-strong)]">
                            <Layers3 className="h-3.5 w-3.5" aria-hidden="true" />
                            {competition.parentSeries.name}
                        </span>
                    ) : null}
                    {competition.joined ? (
                        <span className="inline-flex min-h-7 items-center gap-1.5 border border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-2.5 text-xs font-semibold text-[var(--platform-ink-muted-strong)]">
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            {t('status.joined')}
                        </span>
                    ) : null}
                    {competition.highlighted ? (
                        <Sparkles
                            className="h-4 w-4 text-[var(--platform-coral)]"
                            aria-hidden="true"
                        />
                    ) : null}
                </div>

                <h2
                    className={cn(
                        'mt-4 text-pretty text-xl font-semibold leading-tight tracking-[-0.03em] text-[var(--platform-ink)] transition-colors group-hover:text-[var(--platform-violet)] sm:text-2xl',
                        nested && 'sm:text-xl',
                    )}
                >
                    {content.name}
                </h2>

                {content.shortDescription ? (
                    <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-[var(--platform-ink-muted)]">
                        {content.shortDescription}
                    </p>
                ) : null}

                <div className="mt-4">
                    <CompetitionDateDisplayClient
                        startTime={competition.startTime}
                        endTime={competition.endTime}
                        variant="compact"
                    />
                </div>
            </div>

            <span className="absolute end-4 top-6 flex h-11 w-11 items-center justify-center bg-[var(--platform-violet)] text-[var(--platform-paper)] transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1 motion-reduce:transition-none sm:static sm:mt-1 sm:self-start">
                <ArrowUpRight className="h-5 w-5 rtl:-rotate-90" aria-hidden="true" />
            </span>
        </Link>
    );
}

export function CompetitionList({ competitions }: { competitions: CompetitionUserListResponse[] }) {
    const t = useTranslations('competitions');
    const { locale } = useLocale();

    const sortedCompetitions = useMemo(() => sortCompetitions(competitions), [competitions]);
    const indexFormatter = useMemo(
        () =>
            new Intl.NumberFormat(locale, {
                minimumIntegerDigits: 2,
                useGrouping: false,
            }),
        [locale],
    );

    const childrenByParent = useMemo(() => {
        const parentIds = new Set(
            sortedCompetitions.filter((c) => !c.parentCompetitionId).map((c) => c.id),
        );
        const map = new Map<number, CompetitionUserListResponse[]>();
        for (const competition of sortedCompetitions) {
            if (competition.parentCompetitionId && parentIds.has(competition.parentCompetitionId)) {
                const children = map.get(competition.parentCompetitionId) ?? [];
                children.push(competition);
                map.set(competition.parentCompetitionId, children);
            }
        }
        return map;
    }, [sortedCompetitions]);
    if (!sortedCompetitions.length) {
        return (
            <div className="platform-empty-state mt-8">
                <span className="platform-empty-icon">
                    <Trophy className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="max-w-lg text-sm leading-6 text-[var(--platform-ink-muted)]">
                    {t('list.none')}
                </p>
            </div>
        );
    }

    let visibleIndex = 0;
    return (
        <div
            className="mt-8 border-t border-[var(--platform-line-strong)]"
            role="list"
            aria-label={t('list.title')}
        >
            {sortedCompetitions.map((competition) => {
                if (
                    competition.parentCompetitionId &&
                    childrenByParent.has(competition.parentCompetitionId)
                ) {
                    return null;
                }

                visibleIndex += 1;
                const parentIndex = visibleIndex;
                const children = childrenByParent.get(competition.id);

                return (
                    <Fragment key={competition.id}>
                        <div role="listitem">
                            <CompetitionRow
                                competition={competition}
                                indexLabel={indexFormatter.format(parentIndex)}
                            />
                        </div>
                        {children?.length ? (
                            <div
                                className="border-s-4 border-[var(--platform-coral)] bg-[color-mix(in_oklch,var(--platform-paper-strong)_65%,transparent)] sm:ms-8"
                                role="list"
                            >
                                {children.map((child, childIndex) => (
                                    <div key={child.id} role="listitem">
                                        <CompetitionRow
                                            competition={child}
                                            indexLabel={`${indexFormatter.format(parentIndex)}.${childIndex + 1}`}
                                            nested
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </Fragment>
                );
            })}
        </div>
    );
}
