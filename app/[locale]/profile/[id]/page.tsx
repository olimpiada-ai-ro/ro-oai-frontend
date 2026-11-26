import { ProfileView } from '@/components/profile-view';
import {
    PlatformEmptyState,
    PlatformPageHeader,
    PlatformPageShell,
} from '@/components/platform-page-shell';
import { Link } from '@/i18n/routing';
import type {
    EditorialContribution,
    Submission,
    UserProfile,
    UserAchievement,
    AchievementProgress,
    AchievementStats,
    Achievement,
} from '@/lib/types';
import type { UserLevel } from '@/lib/level/types';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
    fetchApi,
    fetchEditorialContributions,
    getCountries,
    fetchUserShowcase,
    fetchUserAchievements,
    fetchUserProgress,
    fetchAchievementStats,
    fetchAchievements,
} from '@/lib/api';
import { fetchUserLevel } from '@/lib/level/api';
import { getServerLocale } from '@/lib/i18n-server';
import { generateProfileMetadata } from '@/lib/seo/page-metadata';
import { generatePersonSchema } from '@/lib/seo/structured-data';
import { getProfileIdentityPresentation } from '@/lib/profile-identity-presentation';
import { limitProfileBio } from '@/lib/profile-bio';
import { StructuredData } from '@/components/structured-data';
import { getSession } from '@/lib/auth';
import { getProfileArticles, type ArticlePage } from '@/lib/articles';
import {
    getProfilePublishedProblems,
    type ProfilePublishedProblemsResponse,
} from '@/lib/profile-published-problems';
import { getTranslations } from 'next-intl/server';
import { AlertTriangle, CircleUserRound, Home, LockKeyhole, RotateCcw, Trophy } from 'lucide-react';

/**
 * Enable ISR (Incremental Static Regeneration) for profile pages.
 * Pages will be revalidated every 1 hour to keep content fresh.
 */
// revalidate is replaced by "use cache" and cacheLife in Next.js 16
// export const revalidate = 3600; // 1 hour

interface ProfileResponse {
    profile: {
        identityPresentation?: unknown;
        leaderboard: {
            userId: string;
            totalScore: number;
            attainedAt: string;
            rank: number;
            solvedCount: number;
            averageScore: number;
            identityPresentation?: unknown;
        } | null;
        submissions: Submission[] | null;
    };
    settings: {
        userId: string;
        avatar: string | null;
        username: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        location: null | string;
        website: null | string;
        github: null | string;
        bio: null | string;
        isPublic: boolean;
        visibleInLeaderboards: boolean;
        publicSubmissionHistory: boolean;
        joinDate: string;
        institution: {
            id: number;
            name: string;
            type: 'GIMNAZIU' | 'LICEU' | 'FACULTATE';
            county: {
                id: number;
                name: string;
                code: string;
            };
            country?: {
                code: string;
                name: string;
                flagEmoji: string;
            };
        } | null;
        institutionJoinedAt: string | null;
        countryCode?: string | null;
        institutionCountryCode?: string | null;
    };
}

function normalizePercent(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    if (value >= 0 && value <= 1) return Math.round(value * 10000) / 100;
    return Math.round(value * 100) / 100;
}

/**
 * Helper function to get country object from country code
 */
async function getCountryFromCode(countryCode: string | null | undefined) {
    if (!countryCode) return undefined;

    try {
        const countries = await getCountries();
        return countries.find((c) => c.code === countryCode);
    } catch (error) {
        console.error('[Profile] Failed to fetch country data:', error);
        return undefined;
    }
}

/**
 * Generate metadata for profile page with user profile data
 */
export async function generateMetadata({
    params: paramsPromise,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const locale = await getServerLocale();
    const [tProfile, tErrors] = await Promise.all([
        getTranslations({ locale, namespace: 'profile' }),
        getTranslations({ locale, namespace: 'errors' }),
    ]);
    const id = (await paramsPromise).id;
    const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/profile/${id}`;

    try {
        const resp = await fetchApi(url, {
            headers: { 'accept-language': locale },
        });

        if (resp.status === 403) {
            // Private profile - do not index
            return {
                title: { absolute: `${tProfile('privateTitle')} - MLCompete` },
                description: tProfile('privateDescription'),
                robots: { index: false, follow: true },
            };
        }

        if (!resp.ok) {
            // Return fallback metadata for error case
            return {
                title: {
                    absolute: `${tProfile('title')} - ${tErrors('notFound.title')} - MLCompete`,
                },
                description: tErrors('notFound.description'),
                robots: { index: false, follow: false },
            };
        }

        const data = (await resp.json()) as ProfileResponse;
        const settings = data.settings;
        const leaderboard = data.profile.leaderboard;

        // A private profile must never emit identity, score, or country data in
        // social metadata, even for an authenticated owner viewing the page.
        if (settings.isPublic === false) {
            return {
                title: { absolute: `${tProfile('privateTitle')} - MLCompete` },
                description: tProfile('privateDescription'),
                robots: { index: false, follow: true },
            };
        }

        // Get country data
        const userCountry = await getCountryFromCode(settings.countryCode);
        const institutionCountry =
            settings.institution?.country ||
            (await getCountryFromCode(settings.institutionCountryCode));

        // Default country for Romania if no country data available
        const defaultCountry: import('@/lib/types').Country = {
            code: 'RO',
            name: 'Romania',
            nameRo: 'România',
            flagEmoji: '🇷🇴',
        };

        const profile: UserProfile = {
            userId: settings.userId,
            username: settings.username,
            firstName: settings.firstName,
            lastName: settings.lastName,
            email: settings.email,
            joinedAt: new Date(settings.joinDate),
            avatar: settings.avatar,
            bio: limitProfileBio(settings.bio),
            location: settings.location,
            website: settings.website,
            github: settings.github,
            totalScore: normalizePercent(leaderboard?.totalScore ?? 0),
            problemsSolved: Number(leaderboard?.solvedCount ?? 0),
            averageScore: normalizePercent(leaderboard?.averageScore ?? 0),
            rank: Number(leaderboard?.rank ?? 0),
            leaderboardPlaced: !!leaderboard,
            country: userCountry || institutionCountry,
            institution: settings.institution
                ? {
                      id: settings.institution.id,
                      name: settings.institution.name,
                      type: settings.institution.type,
                      county: settings.institution.county,
                      country: institutionCountry || defaultCountry,
                      memberCount: 0,
                      createdAt: new Date(),
                  }
                : undefined,
            institutionJoinedAt: settings.institutionJoinedAt
                ? new Date(settings.institutionJoinedAt)
                : undefined,
            identityPresentation: getProfileIdentityPresentation(data),
        };

        const metadata = await generateProfileMetadata(profile, locale, {
            countryCode:
                settings.countryCode ||
                settings.institution?.country?.code ||
                settings.institutionCountryCode,
        });

        return {
            title: { absolute: metadata.title },
            description: metadata.description,
            keywords: metadata.keywords,
            openGraph: metadata.openGraph,
            twitter: metadata.twitter,
            alternates: metadata.alternates,
            robots: metadata.robots,
        };
    } catch (error) {
        console.error('[SEO] Failed to generate profile metadata:', error);
        // Return indexable metadata even on error - the page will handle the error display
        return {
            title: { absolute: `${tProfile('title')} - MLCompete` },
            description:
                locale === 'ro'
                    ? 'Profil de utilizator pe platforma MLCompete.'
                    : 'User profile on MLCompete.',
            robots: { index: true, follow: true },
        };
    }
}

export default async function ProfilePage({
    params: paramsPromise,
    searchParams: searchParamsPromise,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ tab?: string | string[] }>;
}) {
    const [t, tError, params, searchParams, locale] = await Promise.all([
        getTranslations('profile'),
        getTranslations('errorBoundary'),
        paramsPromise,
        searchParamsPromise,
        getServerLocale(),
    ]);
    const id = params.id;
    const requestedTab = Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab;
    const focusSubmissions = requestedTab === 'submissions';
    const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/profile/${id}`;
    let resp: Response;

    try {
        resp = await fetchApi(url, {
            headers: { 'accept-language': locale },
        });
    } catch (error) {
        console.error('[Profile] Failed to fetch profile:', error);
        return (
            <ProfileStateShell
                icon={AlertTriangle}
                eyebrow={t('title')}
                title={tError('title')}
                description={tError('suggestion')}
                actions={
                    <div className="flex flex-col justify-center gap-3 sm:flex-row">
                        <StateAction
                            href={`/profile/${id}`}
                            icon={RotateCcw}
                            label={tError('reloadPage')}
                            reload
                        />
                        <StateAction href="/" icon={Home} label={t('goHome')} variant="outline" />
                    </div>
                }
            />
        );
    }

    if (resp.status === 403) {
        return (
            <ProfileStateShell
                icon={LockKeyhole}
                eyebrow={t('title')}
                title={t('privateTitle')}
                description={t('privateDescription')}
                actions={
                    <div className="flex flex-col justify-center gap-3 sm:flex-row">
                        <StateAction
                            href="/leaderboard"
                            icon={Trophy}
                            label={t('viewLeaderboardCta')}
                        />
                        <StateAction href="/" icon={Home} label={t('goHome')} variant="outline" />
                    </div>
                }
            />
        );
    }

    if (!resp.ok) {
        console.error(`[Profile] Profile request failed with status ${resp.status}`);
        return (
            <ProfileStateShell
                icon={AlertTriangle}
                eyebrow={t('title')}
                title={tError('title')}
                description={tError('suggestion')}
                actions={
                    <div className="flex flex-col justify-center gap-3 sm:flex-row">
                        <StateAction
                            href={`/profile/${id}`}
                            icon={RotateCcw}
                            label={tError('reloadPage')}
                            reload
                        />
                        <StateAction href="/" icon={Home} label={t('goHome')} variant="outline" />
                    </div>
                }
            />
        );
    }

    let data: ProfileResponse;
    try {
        data = (await resp.json()) as ProfileResponse;
    } catch (error) {
        console.error('[Profile] Failed to parse profile response:', error);
        return (
            <ProfileStateShell
                icon={AlertTriangle}
                eyebrow={t('title')}
                title={tError('title')}
                description={tError('suggestion')}
                actions={
                    <StateAction
                        href={`/profile/${id}`}
                        icon={RotateCcw}
                        label={tError('reloadPage')}
                        reload
                    />
                }
            />
        );
    }

    const profile = data.profile;
    const settings = data.settings;

    if (!settings?.userId || !settings.username) {
        console.error('[Profile] Profile response is missing required settings data');
        return (
            <ProfileStateShell
                icon={AlertTriangle}
                eyebrow={t('title')}
                title={tError('title')}
                description={tError('suggestion')}
                actions={
                    <StateAction
                        href={`/profile/${id}`}
                        icon={RotateCcw}
                        label={tError('reloadPage')}
                        reload
                    />
                }
            />
        );
    }

    // IMPORTANT: Use the actual userId from settings for all subsequent API calls
    // The URL parameter 'id' might be a username slug, but APIs expect the UUID
    const userId = settings.userId;
    const authoredArticlesPromise = getProfileArticles(userId, { size: 3, locale }).catch(
        (error) => {
            console.error('[Profile] Failed to fetch authored articles:', error);
            return {
                content: [],
                page: { number: 0, size: 3, totalElements: 0, totalPages: 0 },
            } as ArticlePage;
        },
    );
    const publishedProblemsPromise = getProfilePublishedProblems(userId, locale)
        .then((publishedProblems) => ({
            publishedProblems,
            status: 'ready' as const,
        }))
        .catch((error) => {
            console.error('[Profile] Failed to fetch published problems:', error);
            return {
                publishedProblems: {
                    items: [],
                    totalElements: 0,
                } as ProfilePublishedProblemsResponse,
                status: 'error' as const,
            };
        });

    const leaderboard = profile?.leaderboard;
    const submissions = profile?.submissions?.map((sub) => ({
        ...sub,
        submittedAt: new Date(sub.submittedAt),
    }));

    // Get country data
    const userCountry = await getCountryFromCode(settings.countryCode);
    const institutionCountry =
        settings.institution?.country ||
        (await getCountryFromCode(settings.institutionCountryCode));

    // Default country for Romania if no country data available
    const defaultCountry: import('@/lib/types').Country = {
        code: 'RO',
        name: 'Romania',
        nameRo: 'România',
        flagEmoji: '🇷🇴',
    };

    const finalProfile: UserProfile = {
        userId: settings.userId,
        username: settings.username,
        firstName: settings.firstName,
        lastName: settings.lastName,
        email: settings.email,
        joinedAt: new Date(settings.joinDate),
        avatar: settings.avatar,
        bio: limitProfileBio(settings.bio),
        location: settings.location,
        website: settings.website,
        github: settings.github,
        totalScore: normalizePercent(leaderboard?.totalScore ?? 0),
        problemsSolved: leaderboard?.solvedCount ?? 0,
        averageScore: normalizePercent(leaderboard?.averageScore ?? 0),
        rank: leaderboard?.rank ?? 0,
        leaderboardPlaced: !!leaderboard,
        country: userCountry || institutionCountry,
        institution: settings.institution
            ? {
                  id: settings.institution.id,
                  name: settings.institution.name,
                  type: settings.institution.type,
                  county: settings.institution.county,
                  country: institutionCountry || defaultCountry,
                  memberCount: 0, // Not provided in basic info
                  createdAt: new Date(), // Not provided in basic info
              }
            : undefined,
        institutionJoinedAt: settings.institutionJoinedAt
            ? new Date(settings.institutionJoinedAt)
            : undefined,
        identityPresentation: getProfileIdentityPresentation(data),
    };

    // Generate structured data for profile page (only if explicitly private)
    const personSchema =
        settings.isPublic === false ? null : generatePersonSchema(finalProfile, locale);

    // Check if this is the current user's profile (compare with actual userId)
    const session = await getSession();
    const isOwnProfile = session?.id === userId;

    // Fetch editorial contributions for the user (use userId, not URL slug)
    let editorialContributions: EditorialContribution[] = [];
    try {
        editorialContributions = await fetchEditorialContributions(userId, locale);
    } catch (error) {
        console.error('[Profile] Failed to fetch editorial contributions:', error);
        // Continue without editorial contributions
    }

    // Fetch achievement data for the user (use userId, not URL slug)
    let achievementShowcase: UserAchievement[] = [];
    let userAchievements: UserAchievement[] = [];
    let achievementProgress: AchievementProgress[] = [];
    let achievementStats: AchievementStats | undefined;
    let allAchievements: Achievement[] = [];

    try {
        // Fetch all achievement data in parallel using userId
        const [showcaseData, achievementsData, progressData, statsData, allAchievementsData] =
            await Promise.all([
                fetchUserShowcase(userId).catch(() => []),
                fetchUserAchievements(userId).catch(() => []),
                fetchUserProgress(userId).catch(() => []),
                fetchAchievementStats(userId).catch(() => undefined),
                fetchAchievements().catch(() => []),
            ]);

        achievementShowcase = showcaseData;
        userAchievements = achievementsData;
        achievementProgress = progressData;
        achievementStats = statsData;
        allAchievements = allAchievementsData;
    } catch (error) {
        console.error('[Profile] Failed to fetch achievement data:', error);
        // Continue without achievement data
    }

    // Fetch user level data (use userId, not URL slug)
    let userLevel: UserLevel | undefined;
    try {
        userLevel = await fetchUserLevel(userId);
    } catch (error) {
        console.error('[Profile] Failed to fetch user level:', error);
        // Continue without level data
    }

    const [authoredArticles, publishedProblemsResult] = await Promise.all([
        authoredArticlesPromise,
        publishedProblemsPromise,
    ]);

    return (
        <>
            {personSchema && <StructuredData data={personSchema} />}
            <ProfileView
                profile={finalProfile}
                submissions={submissions}
                focusSubmissions={focusSubmissions}
                isOwnProfile={isOwnProfile}
                editorialContributions={editorialContributions}
                authoredArticles={authoredArticles.content}
                authoredArticleCount={authoredArticles.page.totalElements}
                publishedProblems={publishedProblemsResult.publishedProblems.items}
                publishedProblemCount={publishedProblemsResult.publishedProblems.totalElements}
                publishedProblemsStatus={publishedProblemsResult.status}
                achievementShowcase={achievementShowcase}
                userAchievements={userAchievements}
                achievementProgress={achievementProgress}
                achievementStats={achievementStats}
                allAchievements={allAchievements}
                userLevel={userLevel}
            />
        </>
    );
}

function ProfileStateShell({
    icon,
    eyebrow,
    title,
    description,
    actions,
}: {
    icon: LucideIcon;
    eyebrow: string;
    title: string;
    description: string;
    actions: ReactNode;
}) {
    return (
        <PlatformPageShell contentClassName="space-y-8">
            <PlatformPageHeader
                eyebrow={eyebrow}
                icon={CircleUserRound}
                title={title}
                description={description}
            />
            <PlatformEmptyState
                className="mt-8"
                icon={icon}
                title={title}
                description={description}
                action={actions}
            />
        </PlatformPageShell>
    );
}

function StateAction({
    href,
    icon: Icon,
    label,
    variant = 'primary',
    reload = false,
}: {
    href: string;
    icon: LucideIcon;
    label: string;
    variant?: 'primary' | 'outline';
    reload?: boolean;
}) {
    const content = (
        <>
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
        </>
    );
    const className =
        variant === 'outline'
            ? 'relative inline-flex min-h-11 items-center justify-center gap-2 rounded-none border border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-8 text-sm font-medium text-[var(--platform-ink)] shadow-none transition-colors hover:bg-[var(--platform-paper-strong)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--platform-coral)]'
            : 'relative inline-flex min-h-11 items-center justify-center gap-2 rounded-none bg-[var(--platform-violet)] px-8 text-sm font-medium text-white shadow-[3px_3px_0_var(--platform-citron)] transition-colors hover:bg-[var(--platform-violet-strong)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--platform-coral)] dark:text-[var(--platform-on-accent)]';

    return reload ? (
        <a href={href} className={className}>
            {content}
        </a>
    ) : (
        <Link href={href} className={className}>
            {content}
        </Link>
    );
}
