import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Trophy } from 'lucide-react';

import { PlatformPageHeader, PlatformPageShell } from '@/components/platform-page-shell';
import { StructuredData } from '@/components/structured-data';
import { TabbedLeaderboardView } from '@/components/tabbed-leaderboard-view';
import { getServerLocale } from '@/lib/i18n-server';
import { fetchPublicApi } from '@/lib/public-api';
import { generateLeaderboardMetadata } from '@/lib/seo/page-metadata';
import { generateItemListSchema } from '@/lib/seo/structured-data';
import type { GenericLeaderboardEntry } from '@/lib/types';
import type { Locale } from '@/lib/types';

/**
 * Generate metadata for leaderboard page.
 */
export async function generateMetadata(): Promise<Metadata> {
    const locale = await getServerLocale();
    const metadata = await generateLeaderboardMetadata(locale);

    return {
        title: metadata.title,
        description: metadata.description,
        keywords: metadata.keywords,
        openGraph: metadata.openGraph,
        twitter: metadata.twitter,
        alternates: metadata.alternates,
        robots: metadata.robots,
    };
}

type LeaderboardResult = {
    entries: GenericLeaderboardEntry[];
    failed: boolean;
};

async function getGeneralLeaderboard(locale: Locale): Promise<LeaderboardResult> {
    try {
        const response = await fetchPublicApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/leaderboard`,
            {
                headers: { 'accept-language': locale },
                next: { revalidate: 30 },
            },
        );

        if (!response.ok) {
            throw new Error(`Leaderboard request failed with status ${response.status}`);
        }

        const data: unknown = await response.json();

        return {
            entries: Array.isArray(data) ? (data as GenericLeaderboardEntry[]) : [],
            failed: false,
        };
    } catch (error) {
        console.error('[LeaderboardPage] Failed to load user rankings:', error);
        return { entries: [], failed: true };
    }
}

export default async function LeaderboardPage() {
    const locale = await getServerLocale();
    const [{ entries, failed }, t, tRankings] = await Promise.all([
        getGeneralLeaderboard(locale),
        getTranslations('leaderboard'),
        getTranslations('rankings'),
    ]);
    const itemListSchema =
        entries.length > 0
            ? generateItemListSchema(entries.slice(0, 10), locale, entries.length)
            : null;

    return (
        <PlatformPageShell contentClassName="space-y-8">
            {itemListSchema ? <StructuredData data={itemListSchema} /> : null}

            <PlatformPageHeader
                eyebrow={t('fullLeaderboard')}
                icon={Trophy}
                title={t('title')}
                description={t('subtitle')}
                aside={
                    !failed ? (
                        <div className="platform-toolbar flex min-w-44 items-baseline justify-between gap-5 px-4 py-3 sm:px-5">
                            <span className="text-sm font-medium text-[var(--platform-ink-muted)]">
                                {t('countryRankings.participants')}
                            </span>
                            <strong className="text-2xl font-semibold tabular-nums tracking-[-0.04em] text-[var(--platform-ink)]">
                                {new Intl.NumberFormat(locale).format(entries.length)}
                            </strong>
                        </div>
                    ) : undefined
                }
            />

            <TabbedLeaderboardView
                initialUserLeaderboard={entries}
                initialUserError={failed ? tRankings('loadError') : null}
                isCompetition={false}
            />
        </PlatformPageShell>
    );
}
