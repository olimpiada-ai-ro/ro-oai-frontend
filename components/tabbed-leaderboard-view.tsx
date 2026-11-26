'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Globe2, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { CountryRankingsView } from '@/components/country-rankings-view';
import { InstitutionLeaderboardView } from '@/components/institution-leaderboard-view';
import { LeaderboardView } from '@/components/leaderboard-view';
import { TabNavigation, type TabConfig } from '@/components/tab-navigation';
import { useGTMTracker } from '@/hooks/use-gtm-tracker';
import { useRouter } from '@/i18n/routing';
import { getCountryRankings } from '@/lib/api';
import { fetchPublicApi } from '@/lib/public-api';
import type { CountryRanking, GenericLeaderboardEntry, InstitutionRanking } from '@/lib/types';

type TabId = 'users' | 'institutions' | 'countries';

interface TabbedLeaderboardViewProps {
    initialUserLeaderboard: GenericLeaderboardEntry[];
    initialUserError?: string | null;
    isCompetition?: boolean;
}

type InstitutionRankingApiEntry = {
    rank: number;
    memberCount: number;
    totalScore: number;
    institutionId: number;
    institutionName: string;
    institutionType: InstitutionRanking['institution']['type'];
    countyId: number;
    countyName: string;
    countyCode: string;
    countryCode?: string;
    countryName?: string;
    countryNameRo?: string;
    flagEmoji?: string;
};

export function TabbedLeaderboardView({
    initialUserLeaderboard,
    initialUserError = null,
    isCompetition = false,
}: TabbedLeaderboardViewProps) {
    const t = useTranslations('leaderboard');
    const tCommon = useTranslations('common');
    const tRankings = useTranslations('rankings');
    const router = useRouter();
    const { trackLeaderboard } = useGTMTracker();
    const [activeTab, setActiveTab] = useState<TabId>('users');
    const [institutionRankings, setInstitutionRankings] = useState<InstitutionRanking[] | null>(
        null,
    );
    const [isLoadingInstitutions, setIsLoadingInstitutions] = useState(false);
    const [institutionError, setInstitutionError] = useState<Error | null>(null);
    const [countryRankings, setCountryRankings] = useState<CountryRanking[] | null>(null);
    const [isLoadingCountries, setIsLoadingCountries] = useState(false);
    const [countryError, setCountryError] = useState<Error | null>(null);
    const hasLoadedInstitutions = useRef(false);
    const hasLoadedCountries = useRef(false);
    const hasTrackedInitialView = useRef(false);
    const scrollPositionRef = useRef<Partial<Record<TabId, number>>>({ users: 0 });

    useEffect(() => {
        if (hasTrackedInitialView.current) return;

        trackLeaderboard('view', 'users', {
            entryCount: initialUserLeaderboard.length,
            isCompetition,
        });
        hasTrackedInitialView.current = true;
    }, [initialUserLeaderboard.length, isCompetition, trackLeaderboard]);

    const fetchInstitutionRankings = async () => {
        if (hasLoadedInstitutions.current || isLoadingInstitutions) return;

        setIsLoadingInstitutions(true);
        setInstitutionError(null);

        try {
            const response = await fetchPublicApi(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/institutions/rankings`,
            );

            if (!response.ok) {
                throw new Error(
                    `Institution rankings request failed with status ${response.status}`,
                );
            }

            const data: unknown = await response.json();
            const rankings = Array.isArray(data) ? (data as InstitutionRankingApiEntry[]) : [];
            const transformedData: InstitutionRanking[] = rankings.map((ranking) => ({
                rank: ranking.rank,
                memberCount: ranking.memberCount,
                totalScore: ranking.totalScore,
                institution: {
                    id: ranking.institutionId,
                    name: ranking.institutionName,
                    type: ranking.institutionType,
                    county: {
                        id: ranking.countyId,
                        name: ranking.countyName,
                        code: ranking.countyCode,
                    },
                    country: {
                        code: ranking.countryCode || '',
                        name: ranking.countryName || '',
                        nameRo: ranking.countryNameRo,
                        flagEmoji: ranking.flagEmoji || '',
                    },
                    memberCount: ranking.memberCount,
                    createdAt: new Date(),
                },
            }));

            setInstitutionRankings(transformedData);
            hasLoadedInstitutions.current = true;
        } catch (error) {
            console.error('[TabbedLeaderboardView] Error fetching institution rankings:', error);
            setInstitutionError(error instanceof Error ? error : new Error(tRankings('loadError')));
            toast.error(t('institutionLeaderboard.errorLoading'), {
                description: tRankings('loadError'),
                action: {
                    label: tCommon('retry'),
                    onClick: () => {
                        hasLoadedInstitutions.current = false;
                        void fetchInstitutionRankings();
                    },
                },
            });
        } finally {
            setIsLoadingInstitutions(false);
        }
    };

    const fetchCountryRankings = async () => {
        if (hasLoadedCountries.current || isLoadingCountries) return;

        setIsLoadingCountries(true);
        setCountryError(null);

        try {
            const data = await getCountryRankings();
            setCountryRankings(data);
            hasLoadedCountries.current = true;
        } catch (error) {
            console.error('[TabbedLeaderboardView] Error fetching country rankings:', error);
            setCountryError(error instanceof Error ? error : new Error(tRankings('loadError')));
            toast.error(t('countryRankings.errorTitle'), {
                description: t('countryRankings.errorMessage'),
                action: {
                    label: tCommon('retry'),
                    onClick: () => {
                        hasLoadedCountries.current = false;
                        void fetchCountryRankings();
                    },
                },
            });
        } finally {
            setIsLoadingCountries(false);
        }
    };

    const handleInstitutionRetry = () => {
        hasLoadedInstitutions.current = false;
        setInstitutionError(null);
        void fetchInstitutionRankings();
    };

    const handleCountryRetry = () => {
        hasLoadedCountries.current = false;
        setCountryError(null);
        void fetchCountryRankings();
    };

    const handleTabChange = (tabId: string) => {
        const newTab = tabId as TabId;
        if (newTab === activeTab) return;

        const previousTab = activeTab;
        scrollPositionRef.current[activeTab] = window.scrollY;
        setActiveTab(newTab);

        trackLeaderboard('tab_change', newTab, { previousTab, isCompetition });
        trackLeaderboard('view', newTab, { isCompetition });

        if (newTab === 'institutions' && !hasLoadedInstitutions.current) {
            void fetchInstitutionRankings();
        }

        if (newTab === 'countries' && !hasLoadedCountries.current) {
            void fetchCountryRankings();
        }

        const savedPosition = scrollPositionRef.current[newTab];
        if (savedPosition !== undefined) {
            requestAnimationFrame(() => window.scrollTo({ top: savedPosition, behavior: 'auto' }));
        }
    };

    const tabs: TabConfig[] = [
        {
            id: 'users',
            label: t('tabs.users'),
            icon: Users,
            count: initialUserLeaderboard.length,
            ariaLabel: t('tabs.usersAriaLabel'),
        },
        {
            id: 'institutions',
            label: t('tabs.institutions'),
            icon: Building2,
            count: institutionRankings?.length,
            ariaLabel: t('tabs.institutionsAriaLabel'),
        },
        {
            id: 'countries',
            label: t('tabs.countries'),
            icon: Globe2,
            count: countryRankings?.length,
            ariaLabel: t('tabs.countriesAriaLabel'),
        },
    ];

    return (
        <div className="space-y-8">
            <TabNavigation
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                ariaLabel={t('tabs.ariaLabel')}
            />

            <div id="leaderboard-content">
                {activeTab === 'users' ? (
                    <div
                        role="tabpanel"
                        id="tabpanel-users"
                        aria-labelledby="tab-users"
                        tabIndex={0}
                        className="focus:outline-none"
                    >
                        <LeaderboardView
                            leaderboard={initialUserLeaderboard}
                            simple={isCompetition}
                            identitySurface={
                                isCompetition
                                    ? 'RESTRICTED_COMPETITION_LEADERBOARD'
                                    : 'GLOBAL_LEADERBOARD'
                            }
                            error={initialUserError}
                            onRetry={() => router.refresh()}
                        />
                    </div>
                ) : null}

                {activeTab === 'institutions' ? (
                    <div
                        role="tabpanel"
                        id="tabpanel-institutions"
                        aria-labelledby="tab-institutions"
                        tabIndex={0}
                        className="focus:outline-none"
                    >
                        <InstitutionLeaderboardView
                            rankings={institutionRankings || []}
                            isLoading={isLoadingInstitutions}
                            error={institutionError}
                            onRetry={handleInstitutionRetry}
                        />
                    </div>
                ) : null}

                {activeTab === 'countries' ? (
                    <div
                        role="tabpanel"
                        id="tabpanel-countries"
                        aria-labelledby="tab-countries"
                        tabIndex={0}
                        className="focus:outline-none"
                    >
                        <CountryRankingsView
                            rankings={countryRankings || []}
                            isLoading={isLoadingCountries}
                            error={countryError}
                            onRetry={handleCountryRetry}
                        />
                    </div>
                ) : null}
            </div>

            <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {activeTab === 'users' ? t('tabs.usersActive') : null}
                {activeTab === 'institutions' ? t('tabs.institutionsActive') : null}
                {activeTab === 'countries' ? t('tabs.countriesActive') : null}
                {isLoadingInstitutions || isLoadingCountries ? tRankings('loading') : null}
            </div>
        </div>
    );
}
