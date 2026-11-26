import { fetchApi } from '@/lib/api';
import {
    GenericLeaderboardEntry,
    CompetitionUserResponse,
    SimpleLeaderboardEntry,
} from '@/lib/types';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { AlertTriangle, RotateCcw, Trophy } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { CompetitionDetailsWithOnboarding } from '@/components/competition-details-with-onboarding';
import {
    PlatformEmptyState,
    PlatformPageHeader,
    PlatformPageShell,
} from '@/components/platform-page-shell';
import { mapSimpleLeaderboardEntry } from '@/lib/mappers';
import { getServerLocale } from '@/lib/i18n-server';
import { generateCompetitionMetadata } from '@/lib/seo/page-metadata';
import { generateCompetitionSchema, generateBreadcrumbSchema } from '@/lib/seo/structured-data';
import { StructuredData } from '@/components/structured-data';
import { BASE_URL } from '@/lib/seo/config';
import { Link } from '@/i18n/routing';
import {
    getCompetitionOrganizerDataConsent,
    type CompetitionOrganizerDataConsent,
} from '@/lib/competition-hosting';

const PageTransition = dynamic(
    () => import('@/components/page-transition').then((mod) => ({ default: mod.PageTransition })),
    { loading: () => <div /> },
);

type PageProps = { params: Promise<{ id: string }> };

/**
 * Generate metadata for competition page with competition details
 */
export async function generateMetadata({
    params: paramsPromise,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const locale = await getServerLocale();
    const t = await getTranslations({ locale, namespace: 'competitions.list' });
    const id = (await paramsPromise).id;
    const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${encodeURIComponent(id)}`;

    try {
        // Keep social metadata on the anonymous representation. Joined users
        // and admins may see private competitions that must not enter a public URL.
        const res = await fetch(url, {
            headers: {
                accept: 'application/json',
                'accept-language': locale,
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            // Return fallback metadata for error case with noindex
            return {
                title: `${t('title')} - MLCompete`,
                description: t('error'),
                robots: {
                    index: false,
                    follow: false,
                },
            };
        }

        const competition = (await res.json()) as CompetitionUserResponse;
        const metadata = await generateCompetitionMetadata(
            {
                ...competition,
                problemCount: competition.problems?.length,
            },
            locale,
        );

        return {
            title: metadata.title,
            description: metadata.description,
            keywords: metadata.keywords,
            openGraph: metadata.openGraph,
            twitter: metadata.twitter,
            alternates: metadata.alternates,
            robots: metadata.robots,
        };
    } catch (error) {
        console.error('[SEO] Failed to generate competition metadata:', error);
        return {
            title: `${t('title')} - MLCompete`,
            description: t('error'),
            robots: {
                index: false,
                follow: false,
            },
        };
    }
}

export default async function CompetitionDetailsPage({ params }: PageProps) {
    const { id } = await params;
    const [t, tCommon, locale] = await Promise.all([
        getTranslations('competitions.list'),
        getTranslations('common'),
        getServerLocale(),
    ]);
    const localizedHeaders = { 'accept-language': locale };

    let competition: CompetitionUserResponse | null = null;
    let leaderboard: {
        partialLeaderboard: SimpleLeaderboardEntry[];
        completeLeaderboard: SimpleLeaderboardEntry[] | null;
    } = { partialLeaderboard: [], completeLeaderboard: null };
    let leaderboardUnavailable = false;
    let organizerDataConsent: CompetitionOrganizerDataConsent | null = null;

    const [competitionResult, leaderboardResult, organizerConsentResult] = await Promise.allSettled(
        [
            fetchApi(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${encodeURIComponent(id)}`,
                { headers: localizedHeaders },
            ),
            fetchApi(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${encodeURIComponent(id)}/leaderboards`,
                { headers: localizedHeaders },
            ),
            getCompetitionOrganizerDataConsent(id),
        ],
    );

    if (organizerConsentResult.status === 'fulfilled') {
        organizerDataConsent = organizerConsentResult.value;
    }

    if (competitionResult.status === 'fulfilled' && competitionResult.value.status === 404) {
        notFound();
    }

    try {
        if (competitionResult.status === 'rejected') throw competitionResult.reason;
        if (!competitionResult.value.ok) {
            throw new Error(
                `Competition request failed with status ${competitionResult.value.status}`,
            );
        }

        competition = (await competitionResult.value.json()) as CompetitionUserResponse;
    } catch (error) {
        console.error(`[Competitions] Failed to load competition ${id}:`, error);
    }

    if (!competition) {
        return (
            <PageTransition>
                <PlatformPageShell>
                    <PlatformPageHeader
                        eyebrow={t('title')}
                        icon={Trophy}
                        title={t('title')}
                        description={t('subtitle')}
                    />
                    <PlatformEmptyState
                        className="mt-8"
                        icon={AlertTriangle}
                        title={t('error')}
                        action={
                            <Link
                                href={`/competitions/${id}`}
                                className="inline-flex min-h-11 items-center gap-2 border border-[var(--platform-line-strong)] bg-[var(--platform-violet)] px-5 py-2 text-sm font-bold text-white shadow-[4px_4px_0_var(--platform-line)] hover:bg-[var(--platform-violet-strong)] dark:text-[var(--platform-on-accent)]"
                            >
                                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                {tCommon('retry')}
                            </Link>
                        }
                    />
                </PlatformPageShell>
            </PageTransition>
        );
    }

    try {
        if (leaderboardResult.status === 'rejected') throw leaderboardResult.reason;
        if (!leaderboardResult.value.ok) {
            throw new Error(
                `Leaderboard request failed with status ${leaderboardResult.value.status}`,
            );
        }
        leaderboard = (await leaderboardResult.value.json()) as typeof leaderboard;
    } catch (error) {
        leaderboardUnavailable = true;
        console.error(`[Competitions] Failed to load leaderboard for ${id}:`, error);
    }

    const mappedLeaderboard: {
        partialLeaderboard: GenericLeaderboardEntry[];
        completeLeaderboard: GenericLeaderboardEntry[] | null;
    } = {
        partialLeaderboard: leaderboard.partialLeaderboard.map(mapSimpleLeaderboardEntry),
        completeLeaderboard: leaderboard.completeLeaderboard
            ? leaderboard.completeLeaderboard.map(mapSimpleLeaderboardEntry)
            : null,
    };

    const localePrefix = `/${locale}`;

    // Generate structured data for competition page
    const competitionSchema = generateCompetitionSchema(competition, locale);
    const breadcrumbSchema = generateBreadcrumbSchema([
        { name: tCommon('appName'), url: `${BASE_URL}${localePrefix}` },
        { name: t('title'), url: `${BASE_URL}${localePrefix}/competitions` },
        {
            name: competition.name,
            url: `${BASE_URL}${localePrefix}/competitions/${competition.id}`,
        },
    ]);

    return (
        <>
            <StructuredData data={[competitionSchema, breadcrumbSchema]} />
            <PageTransition>
                <CompetitionDetailsWithOnboarding
                    competition={competition}
                    leaderboard={mappedLeaderboard}
                    leaderboardUnavailable={leaderboardUnavailable}
                    organizerDataConsent={organizerDataConsent}
                />
            </PageTransition>
        </>
    );
}
