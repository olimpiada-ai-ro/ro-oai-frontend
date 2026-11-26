import type { Metadata } from 'next';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { CompetitionSeriesView } from '@/components/competition-series-view';
import { Link } from '@/i18n/routing';
import {
    CompetitionSeriesApiError,
    getCompetitionSeries,
    getCompetitionSeriesLeaderboard,
} from '@/lib/competition-series';
import type { Locale } from '@/lib/types';
import { PlatformEmptyState, PlatformPageShell } from '@/components/platform-page-shell';

type PageProps = {
    params: Promise<{ locale: Locale; id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, id } = await params;
    const t = await getTranslations({ locale, namespace: 'competitionSeries' });
    try {
        const series = await getCompetitionSeries(id, locale);
        const description =
            series.shortDescription || t('metadataDescription', { name: series.name });
        return {
            title: `${series.name} | MLCompete`,
            description,
            openGraph: {
                title: series.name,
                description,
                type: 'website',
            },
            twitter: {
                card: 'summary_large_image',
                title: series.name,
                description,
            },
        };
    } catch {
        return {
            title: `${t('eyebrow')} | MLCompete`,
            description: t('errorDescription'),
            robots: { index: false, follow: false },
        };
    }
}

export default async function CompetitionSeriesPage({ params }: PageProps) {
    const { locale, id } = await params;
    setRequestLocale(locale);
    const t = await getTranslations({ locale, namespace: 'competitionSeries' });

    let series;
    try {
        series = await getCompetitionSeries(id, locale, { authenticated: true });
    } catch (error) {
        if (error instanceof CompetitionSeriesApiError && error.status === 404) notFound();
        console.error(`[CompetitionSeries] Failed to load series ${id}:`, error);
        return (
            <PlatformPageShell>
                <PlatformEmptyState
                    icon={AlertTriangle}
                    title={t('errorTitle')}
                    description={t('errorDescription')}
                    action={
                        <Link
                            href={`/competition-series/${id}`}
                            className="inline-flex min-h-11 items-center gap-2 bg-[var(--platform-violet)] px-5 text-sm font-semibold text-[var(--platform-paper)] hover:bg-[var(--platform-violet-strong)]"
                        >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            {t('retry')}
                        </Link>
                    }
                />
            </PlatformPageShell>
        );
    }

    const leaderboard = await getCompetitionSeriesLeaderboard(id, locale, series.mode, {
        authenticated: true,
    }).catch((error) => {
        console.error(`[CompetitionSeries] Failed to load series leaderboard ${id}:`, error);
        return null;
    });

    return (
        <CompetitionSeriesView
            series={series}
            leaderboard={leaderboard}
            locale={locale}
            messages={{
                eyebrow: t('eyebrow'),
                modes: {
                    multiRound: t('modes.multiRound'),
                    divisions: t('modes.divisions'),
                },
                tabs: {
                    overview: t('tabs.overview'),
                    children: t('tabs.children'),
                    combined: t('tabs.combined'),
                },
                period: t('period'),
                periodHint: t('periodHint'),
                starts: t('starts'),
                ends: t('ends'),
                events: (count) => t('events', { count }),
                problems: (count) => t('problems', { count }),
                roundLabel: (number) => t('roundLabel', { number }),
                divisionLabel: (number) => t('divisionLabel', { number }),
                childrenTitle: t('childrenTitle'),
                childrenMultiRoundDescription: t('childrenMultiRoundDescription'),
                childrenDivisionsDescription: t('childrenDivisionsDescription'),
                viewCompetition: t('viewCompetition'),
                viewLeaderboard: t('viewLeaderboard'),
                combinedTitle: t('combinedTitle'),
                combinedDescription: t('combinedDescription'),
                childLeaderboardsTitle: t('childLeaderboardsTitle'),
                childLeaderboardsDescription: t('childLeaderboardsDescription'),
                rank: t('rank'),
                participant: t('participant'),
                total: t('total'),
                roundTotals: t('roundTotals'),
                problemScores: t('problemScores'),
                noResults: t('noResults'),
                unavailable: t('unavailable'),
            }}
        />
    );
}
