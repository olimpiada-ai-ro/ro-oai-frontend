'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Award,
    Building2,
    CalendarDays,
    CircleUserRound,
    Flame,
    Github,
    Globe2,
    History,
    Mail,
    MapPin,
    Pencil,
    ScanSearch,
    Sparkles,
    Target,
    TrendingUp,
    Trophy,
    Zap,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { AchievementShowcase } from '@/components/achievements/achievement-showcase';
import { AchievementsSection } from '@/components/achievements/achievements-section';
import { ShowcaseEditor } from '@/components/achievements/showcase-editor';
import { CountryFlag } from '@/components/country-flag';
import { EditorialContributionsSection } from '@/components/editorial';
import { ProfileAuthoredArticles } from '@/components/articles/profile-authored-articles';
import { ProfilePublishedProblems } from '@/components/profile-published-problems';
import {
    PlatformEmptyState,
    PlatformPageHeader,
    PlatformPageShell,
} from '@/components/platform-page-shell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SubmissionDetailsModal } from '@/components/submission-details-modal';
import { UserAvatar } from '@/components/user-avatar';
import { Link } from '@/i18n/routing';
import { analytics, AnalyticsEvents } from '@/lib/analytics';
import { updateShowcase } from '@/lib/api';
import { getInstitutionLocationLabel } from '@/lib/country-display';
import { formatLongDate, formatShortDate } from '@/lib/i18n-formatting';
import type { UserLevel } from '@/lib/level/types';
import { TIER_CONFIG } from '@/lib/level/tier-config';
import type {
    Achievement,
    AchievementProgress,
    AchievementRarity,
    AchievementStats,
    EditorialContribution,
    Locale,
    Submission,
    UserAchievement,
    UserProfile,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { useGTMTracker } from '@/hooks/use-gtm-tracker';
import type { ArticleSummary } from '@/lib/articles';
import type { ProfilePublishedProblem } from '@/lib/profile-published-problems';

type ProfileViewProps = {
    profile: UserProfile;
    submissions?: Submission[];
    focusSubmissions?: boolean;
    isLoading?: boolean;
    isOwnProfile?: boolean;
    editorialContributions?: EditorialContribution[];
    authoredArticles?: ArticleSummary[];
    authoredArticleCount?: number;
    publishedProblems?: ProfilePublishedProblem[];
    publishedProblemCount?: number;
    publishedProblemsStatus?: 'ready' | 'loading' | 'error';
    achievementShowcase?: UserAchievement[];
    userAchievements?: UserAchievement[];
    achievementProgress?: AchievementProgress[];
    achievementStats?: AchievementStats;
    allAchievements?: Achievement[];
    userLevel?: UserLevel;
};

const rarityOrder: AchievementRarity[] = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];

const rarityBarStyles: Record<AchievementRarity, string> = {
    COMMON: 'bg-[var(--platform-line-strong)]',
    UNCOMMON: 'bg-[var(--platform-ink-muted)]',
    RARE: 'bg-[var(--platform-violet)]',
    EPIC: 'bg-[var(--platform-coral)]',
    LEGENDARY: 'bg-[var(--platform-citron)]',
};

export function ProfileView({
    profile,
    submissions,
    focusSubmissions = false,
    isLoading = false,
    isOwnProfile = false,
    editorialContributions = [],
    authoredArticles = [],
    authoredArticleCount = authoredArticles.length,
    publishedProblems = [],
    publishedProblemCount = publishedProblems.length,
    publishedProblemsStatus = 'ready',
    achievementShowcase = [],
    userAchievements = [],
    achievementProgress = [],
    achievementStats,
    allAchievements = [],
    userLevel,
}: ProfileViewProps) {
    const t = useTranslations('profile');
    const tCommon = useTranslations('common');
    const tSettings = useTranslations('settings');
    const tLevel = useTranslations('level');
    const tAchievements = useTranslations('achievements');
    const tSubmission = useTranslations('submissionDetails');
    const locale = useLocale() as Locale;
    const router = useRouter();
    const [showShowcaseEditor, setShowShowcaseEditor] = useState(false);
    const [displayedShowcase, setDisplayedShowcase] = useState(achievementShowcase);
    const [selectedSubmission, setSelectedSubmission] = useState<
        (Submission & { title: string }) | null
    >(null);
    const [achievementsTracked, setAchievementsTracked] = useState(false);
    const achievementsSectionRef = useRef<HTMLDivElement>(null);
    const showcaseEditButtonRef = useRef<HTMLButtonElement>(null);
    const { trackProfile } = useGTMTracker();

    const numberFormatter = useMemo(
        () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
        [locale],
    );

    useEffect(() => {
        setDisplayedShowcase(achievementShowcase);
    }, [achievementShowcase]);

    const formatDate = (date: Date) => formatLongDate(date, locale);

    const getStatusTranslation = (status: string) => {
        const statusMap: Record<string, string> = {
            EVALUATED: tSubmission('evaluated'),
            PROCESSING: tSubmission('processing'),
            ERROR: tSubmission('error'),
            PENDING: tSubmission('processing'),
        };
        return statusMap[status] || status;
    };

    useEffect(() => {
        if (isLoading || !profile) return;

        try {
            const viewerRelationship = isOwnProfile ? 'self' : 'other';

            trackProfile('view', {
                profileOwnerId: profile.userId,
                viewerRelationship,
                profileUsername: profile.username,
                profileRank: profile.rank,
                problemsSolved: profile.problemsSolved,
            });

            analytics.trackEvent({
                name: AnalyticsEvents.PROFILE_VIEW,
                properties: {
                    username: profile.username,
                    rank: profile.rank,
                    problemsSolved: profile.problemsSolved,
                    timestamp: new Date().toISOString(),
                },
            });
        } catch (error) {
            console.error('[Analytics] Failed to track profile view:', error);
        }
    }, [profile, isLoading, isOwnProfile, trackProfile]);

    const handleAchievementsView = useCallback(() => {
        if (achievementsTracked || !profile) return;

        trackProfile('achievements_view', {
            profileOwnerId: profile.userId,
            viewerRelationship: isOwnProfile ? 'self' : 'other',
        });
        setAchievementsTracked(true);
    }, [achievementsTracked, profile, isOwnProfile, trackProfile]);

    useEffect(() => {
        const section = achievementsSectionRef.current;
        if (
            !section ||
            achievementsTracked ||
            allAchievements.length === 0 ||
            typeof IntersectionObserver === 'undefined'
        ) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) return;
                handleAchievementsView();
                observer.disconnect();
            },
            { threshold: 0.2 },
        );

        observer.observe(section);
        return () => observer.disconnect();
    }, [achievementsTracked, allAchievements.length, handleAchievementsView]);

    if (isLoading) {
        return <ProfileViewSkeleton title={t('title')} />;
    }

    const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
    const headerDescription = profile.bio || t('joinedAt', { date: formatDate(profile.joinedAt) });

    return (
        <PlatformPageShell contentClassName="space-y-8 md:space-y-10">
            <PlatformPageHeader
                eyebrow={t('title')}
                icon={CircleUserRound}
                title={<span dir="auto">{profile.username}</span>}
                description={headerDescription}
                aside={
                    <div className="platform-panel flex w-full min-w-0 items-center gap-4 bg-[var(--platform-paper)] p-3 sm:w-auto sm:min-w-80 sm:p-4">
                        <UserAvatar
                            avatar={profile.avatar}
                            userId={profile.userId}
                            username={profile.username}
                            firstName={profile.firstName}
                            lastName={profile.lastName}
                            loading="eager"
                            className="h-16 w-16 shrink-0 rounded-none border border-[var(--platform-line-strong)] sm:h-20 sm:w-20"
                            imageClassName="rounded-none"
                            fallbackClassName="rounded-none text-lg font-bold"
                        />
                        <div className="min-w-0 flex-1">
                            {fullName ? (
                                <p
                                    className="truncate text-sm font-semibold text-[var(--platform-ink)]"
                                    dir="auto"
                                >
                                    {fullName}
                                </p>
                            ) : null}
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--platform-ink-muted)]">
                                <span className="inline-flex items-center gap-1.5">
                                    <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                                    {t('rank')} #{profile.rank > 0 ? profile.rank : tCommon('na')}
                                </span>
                                {userLevel ? (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                                        {tLevel('level')} {userLevel.level}
                                    </span>
                                ) : null}
                            </div>
                            {isOwnProfile ? (
                                <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="mt-3 min-h-10 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-3 text-[var(--platform-ink)] shadow-none hover:bg-[var(--platform-citron)] hover:text-[var(--platform-on-accent)]"
                                >
                                    <Link href="/settings">
                                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                        {tSettings('profileInfo')}
                                    </Link>
                                </Button>
                            ) : null}
                        </div>
                    </div>
                }
            />

            {profile.leaderboardPlaced ? (
                <ProfileScoreStrip
                    profile={profile}
                    labels={{
                        totalScore: t('totalScore'),
                        problemsSolved: t('problemsSolved'),
                        averageScore: t('averageScore'),
                        globalRank: t('globalRank'),
                    }}
                    formatNumber={(value) => numberFormatter.format(value)}
                    unavailableLabel={tCommon('na')}
                />
            ) : null}

            <div className="grid items-start gap-8 xl:grid-cols-[minmax(18rem,0.78fr)_minmax(0,2.2fr)] xl:gap-10">
                <ProfileRegister
                    profile={profile}
                    isOwnProfile={isOwnProfile}
                    fullName={fullName}
                    formatDate={formatDate}
                />

                <div className="min-w-0 space-y-8">
                    {userLevel ? (
                        <LevelRegister
                            userLevel={userLevel}
                            locale={locale}
                            labels={{
                                title: tLevel('levelProgress'),
                                level: tLevel('level'),
                                totalXp: tLevel('totalXp'),
                                viewAchievements: tLevel('viewAchievements'),
                                maxLevel: tLevel('maxLevel'),
                            }}
                        />
                    ) : null}

                    <ProfilePublishedProblems
                        problems={publishedProblems}
                        totalCount={publishedProblemCount}
                        status={publishedProblemsStatus}
                        retryHref={`/profile/${profile.userId}`}
                    />

                    <ProfileAuthoredArticles
                        articles={authoredArticles}
                        totalCount={authoredArticleCount}
                        authorId={profile.userId}
                        isOwnProfile={isOwnProfile}
                        achievements={allAchievements}
                        userAchievements={userAchievements}
                        achievementProgress={achievementProgress}
                    />

                    {submissions ? (
                        <SubmissionRegister
                            submissions={submissions}
                            focusOnMount={focusSubmissions}
                            canViewDetails={isOwnProfile}
                            locale={locale}
                            labels={{
                                title: t('submissionHistory'),
                                description: t('submissionHistoryDesc'),
                                empty: t('noSubmissions'),
                                problem: t('problem'),
                                date: t('date'),
                                score: t('score'),
                                finalScore: t('finalScore'),
                                status: t('status'),
                                unavailable: tCommon('na'),
                                details: tSubmission('details'),
                            }}
                            getStatusTranslation={getStatusTranslation}
                            onViewDetails={(submission) =>
                                setSelectedSubmission({
                                    ...submission,
                                    title: submission.problemTitle,
                                })
                            }
                        />
                    ) : null}

                    {displayedShowcase.length > 0 || isOwnProfile ? (
                        <section className="platform-panel bg-[var(--platform-paper)] p-4 sm:p-6">
                            <AchievementShowcase
                                achievements={displayedShowcase}
                                isOwnProfile={isOwnProfile}
                                onEditShowcase={() => setShowShowcaseEditor(true)}
                                editButtonRef={showcaseEditButtonRef}
                            />
                        </section>
                    ) : null}

                    {achievementStats ? (
                        <AchievementStatsRegister
                            stats={achievementStats}
                            locale={locale}
                            labels={{
                                title: tAchievements('statistics'),
                                earned: tAchievements('earned'),
                                of: tAchievements('of'),
                                complete: tAchievements('complete'),
                                totalXp: tAchievements('totalXp'),
                                dayStreak: tAchievements('dayStreak'),
                                bestStreak: tAchievements('bestStreak'),
                                rarityDistribution: tAchievements('rarityDistribution'),
                            }}
                            rarityLabel={(rarity) => tAchievements(`rarities.${rarity}`)}
                        />
                    ) : null}

                    {allAchievements.length > 0 ? (
                        <div ref={achievementsSectionRef}>
                            <AchievementsSection
                                className="rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] shadow-none"
                                userAchievements={userAchievements}
                                achievementProgress={achievementProgress}
                                allAchievements={allAchievements}
                            />
                        </div>
                    ) : null}

                    {editorialContributions.length > 0 ? (
                        <EditorialContributionsSection contributions={editorialContributions} />
                    ) : null}
                </div>
            </div>

            <ShowcaseEditor
                open={showShowcaseEditor}
                onOpenChange={(open) => {
                    setShowShowcaseEditor(open);
                    if (!open) {
                        window.requestAnimationFrame(() => showcaseEditButtonRef.current?.focus());
                    }
                }}
                earnedAchievements={userAchievements}
                currentShowcase={displayedShowcase.map((item) => item.achievement.id)}
                onSave={async (achievementIds) => {
                    await updateShowcase(profile.userId, achievementIds);

                    trackProfile('showcase_update', {
                        profileOwnerId: profile.userId,
                        achievementCount: achievementIds.length,
                        achievementIds: achievementIds.join(','),
                    });

                    const achievementsById = new Map(
                        [...userAchievements, ...displayedShowcase].map((item) => [
                            item.achievement.id,
                            item,
                        ]),
                    );
                    const nextShowcase = achievementIds.flatMap((achievementId, index) => {
                        const item = achievementsById.get(achievementId);
                        return item ? [{ ...item, isShowcased: true, showcaseOrder: index }] : [];
                    });
                    const scrollPosition = window.scrollY;
                    setDisplayedShowcase(nextShowcase);
                    router.refresh();
                    window.requestAnimationFrame(() => window.scrollTo(0, scrollPosition));
                }}
            />

            {selectedSubmission ? (
                <SubmissionDetailsModal
                    submission={selectedSubmission}
                    open
                    onOpenChange={(open) => {
                        if (!open) setSelectedSubmission(null);
                    }}
                />
            ) : null}
        </PlatformPageShell>
    );
}

type ProfileScoreStripProps = {
    profile: UserProfile;
    labels: {
        totalScore: string;
        problemsSolved: string;
        averageScore: string;
        globalRank: string;
    };
    formatNumber: (value: number) => string;
    unavailableLabel: string;
};

function ProfileScoreStrip({
    profile,
    labels,
    formatNumber,
    unavailableLabel,
}: ProfileScoreStripProps) {
    const metrics = [
        {
            icon: Award,
            label: labels.totalScore,
            value: formatNumber(profile.totalScore),
        },
        {
            icon: Target,
            label: labels.problemsSolved,
            value: formatNumber(profile.problemsSolved),
        },
        {
            icon: TrendingUp,
            label: labels.averageScore,
            value: `${formatNumber(profile.averageScore)}%`,
        },
        {
            icon: Trophy,
            label: labels.globalRank,
            value: profile.rank > 0 ? `#${formatNumber(profile.rank)}` : unavailableLabel,
        },
    ];

    return (
        <dl className="grid grid-cols-2 border-y border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] lg:grid-cols-4">
            {metrics.map(({ icon: Icon, label, value }, index) => (
                <div
                    key={label}
                    className={cn(
                        'flex min-h-28 flex-col justify-between gap-5 p-4 sm:p-5',
                        index % 2 === 0 && 'border-e border-[var(--platform-line)]',
                        index < 2 && 'border-b border-[var(--platform-line)] lg:border-b-0',
                        index === 1 && 'lg:border-e',
                        index === 2 && 'lg:border-e',
                    )}
                >
                    <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span>{label}</span>
                    </dt>
                    <dd className="text-2xl font-semibold tabular-nums tracking-[-0.045em] text-[var(--platform-ink)] sm:text-3xl">
                        {value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

type ProfileRegisterProps = {
    profile: UserProfile;
    isOwnProfile: boolean;
    fullName: string;
    formatDate: (date: Date) => string;
};

function ProfileRegister({ profile, isOwnProfile, fullName, formatDate }: ProfileRegisterProps) {
    const t = useTranslations('profile');
    const locale = useLocale() as Locale;

    return (
        <aside className="platform-panel bg-[var(--platform-paper)] xl:sticky xl:top-24">
            <div className="platform-toolbar flex items-center gap-3 px-4 py-4 sm:px-5">
                <CircleUserRound
                    className="h-5 w-5 text-[var(--platform-violet)]"
                    aria-hidden="true"
                />
                <h2 className="text-lg font-semibold tracking-[-0.025em] text-[var(--platform-ink)]">
                    {t('about')}
                </h2>
            </div>

            <div className="divide-y divide-[var(--platform-line)] px-4 sm:px-5">
                {fullName ? (
                    <ProfileInfoRow icon={CircleUserRound}>
                        <span dir="auto">{fullName}</span>
                    </ProfileInfoRow>
                ) : null}
                {profile.email ? (
                    <ProfileInfoRow icon={Mail}>
                        <a
                            href={`mailto:${profile.email}`}
                            className="break-all text-[var(--platform-violet)] hover:underline"
                            dir="auto"
                        >
                            {profile.email}
                        </a>
                    </ProfileInfoRow>
                ) : null}
                <ProfileInfoRow icon={CalendarDays}>
                    {t('joinedAt', { date: formatDate(profile.joinedAt) })}
                </ProfileInfoRow>
                {profile.location ? (
                    <ProfileInfoRow icon={MapPin}>
                        <span dir="auto">{profile.location}</span>
                    </ProfileInfoRow>
                ) : null}
                {profile.website ? (
                    <ProfileInfoRow icon={Globe2}>
                        <a
                            href={toExternalUrl(profile.website)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-[var(--platform-violet)] hover:underline"
                            dir="auto"
                        >
                            {profile.website}
                        </a>
                    </ProfileInfoRow>
                ) : null}
                {profile.github ? (
                    <ProfileInfoRow icon={Github}>
                        <a
                            href={toGithubUrl(profile.github)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-[var(--platform-violet)] hover:underline"
                            dir="auto"
                        >
                            {profile.github}
                        </a>
                    </ProfileInfoRow>
                ) : null}
            </div>

            {profile.country || profile.institution?.country ? (
                <section className="border-t border-[var(--platform-line-strong)] p-4 sm:p-5">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--platform-ink-muted)]">
                        {t('country')}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-[var(--platform-ink)]">
                        <CountryFlag
                            countryCode={(profile.country || profile.institution!.country).code}
                            countryName={(profile.country || profile.institution!.country).name}
                            size="md"
                            showName
                        />
                        {profile.country &&
                        profile.institution?.country &&
                        profile.country.code !== profile.institution.country.code ? (
                            <span className="border border-[var(--platform-line)] bg-[var(--platform-paper-strong)] px-2 py-1 text-xs text-[var(--platform-ink-muted)]">
                                {t('customCountry')}
                            </span>
                        ) : null}
                    </div>
                    {profile.country &&
                    profile.institution?.country &&
                    profile.country.code !== profile.institution.country.code ? (
                        <p className="mt-2 text-xs leading-5 text-[var(--platform-ink-muted)]">
                            {t('institutionCountry')}: {profile.institution.country.name}{' '}
                            {profile.institution.country.flagEmoji}
                        </p>
                    ) : null}
                    {!profile.country && profile.institution?.country ? (
                        <p className="mt-2 text-xs text-[var(--platform-ink-muted)]">
                            {t('fromInstitution')}
                        </p>
                    ) : null}
                </section>
            ) : null}

            <section className="border-t border-[var(--platform-line-strong)] p-4 sm:p-5">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--platform-ink-muted)]">
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                    {t('institution')}
                </h3>
                {profile.institution ? (
                    <div>
                        <Link
                            href={`/institutions/${profile.institution.id}`}
                            className="font-semibold leading-6 text-[var(--platform-violet)] hover:underline"
                            dir="auto"
                        >
                            {profile.institution.name}
                        </Link>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--platform-ink-muted)]">
                            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                            <span dir="auto">
                                {getInstitutionLocationLabel(profile.institution, locale)}
                            </span>
                        </p>
                        {profile.institutionJoinedAt ? (
                            <p className="mt-2 text-xs leading-5 text-[var(--platform-ink-muted)]">
                                {t('memberSince', {
                                    date: formatDate(profile.institutionJoinedAt),
                                })}
                            </p>
                        ) : null}
                        {isOwnProfile ? (
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="mt-4 min-h-11 w-full rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] text-[var(--platform-ink)] shadow-none hover:bg-[var(--platform-paper-strong)]"
                            >
                                <Link href="/my-requests">{t('changeInstitution')}</Link>
                            </Button>
                        ) : null}
                    </div>
                ) : isOwnProfile ? (
                    <div>
                        <p className="text-sm leading-6 text-[var(--platform-ink-muted)]">
                            {t('noInstitution')}
                        </p>
                        <Button
                            asChild
                            size="sm"
                            className="mt-4 min-h-11 w-full rounded-none bg-[var(--platform-violet)] text-white shadow-none hover:bg-[var(--platform-violet-strong)] dark:text-[var(--platform-on-accent)]"
                        >
                            <Link href="/institutions">{t('joinInstitution')}</Link>
                        </Button>
                    </div>
                ) : (
                    <p className="text-sm text-[var(--platform-ink-muted)]">{t('noInstitution')}</p>
                )}
            </section>
        </aside>
    );
}

function ProfileInfoRow({
    icon: Icon,
    children,
}: {
    icon: typeof CircleUserRound;
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-12 items-start gap-3 py-3 text-sm leading-6 text-[var(--platform-ink-muted-strong)]">
            <Icon
                className="mt-1 h-4 w-4 shrink-0 text-[var(--platform-ink-muted)]"
                aria-hidden="true"
            />
            <div className="min-w-0">{children}</div>
        </div>
    );
}

type LevelRegisterProps = {
    userLevel: UserLevel;
    locale: string;
    labels: {
        title: string;
        level: string;
        totalXp: string;
        viewAchievements: string;
        maxLevel: string;
    };
};

function LevelRegister({ userLevel, locale, labels }: LevelRegisterProps) {
    const percentage = Math.min(100, Math.max(0, userLevel.progress.percentage));
    const formatter = new Intl.NumberFormat(locale);
    const tier = TIER_CONFIG[userLevel.tier];

    return (
        <section className="platform-panel bg-[var(--platform-paper)]">
            <div className="platform-toolbar flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center bg-[var(--platform-citron)] text-lg font-bold text-[var(--platform-on-accent)] shadow-[3px_3px_0_var(--platform-violet)]">
                        {userLevel.level}
                    </span>
                    <div>
                        <h2 className="font-semibold tracking-[-0.025em] text-[var(--platform-ink)]">
                            {labels.title}
                        </h2>
                        <p className="mt-0.5 text-xs text-[var(--platform-ink-muted)]">
                            <span aria-hidden="true">{tier.icon}</span> {userLevel.tierName}
                        </p>
                    </div>
                </div>
                <Link
                    href="/achievements"
                    className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold text-[var(--platform-violet)] hover:underline"
                >
                    <Award className="h-4 w-4" aria-hidden="true" />
                    {labels.viewAchievements}
                </Link>
            </div>

            <div className="p-4 sm:p-5">
                <dl className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <LevelMetric label={labels.level} value={formatter.format(userLevel.level)} />
                    <LevelMetric
                        label={labels.totalXp}
                        value={formatter.format(userLevel.totalXp)}
                    />
                    <LevelMetric
                        className="col-span-2 sm:col-span-1"
                        label={userLevel.tierName}
                        value={tier.icon}
                    />
                </dl>

                <div
                    className="h-3 overflow-hidden border border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)]"
                    role="progressbar"
                    aria-valuenow={userLevel.progress.isMaxLevel ? 100 : percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${labels.title}: ${percentage.toFixed(0)}%`}
                >
                    <div
                        className="h-full bg-[var(--platform-violet)] transition-[width] duration-200 motion-reduce:transition-none"
                        style={{ width: `${userLevel.progress.isMaxLevel ? 100 : percentage}%` }}
                    />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums text-[var(--platform-ink-muted)]">
                    {userLevel.progress.isMaxLevel ? (
                        <span className="font-semibold text-[var(--platform-violet)]">
                            {labels.maxLevel}
                        </span>
                    ) : (
                        <span>
                            {formatter.format(userLevel.progress.currentXpInLevel)} /{' '}
                            {formatter.format(userLevel.progress.xpNeededForNextLevel)} XP
                        </span>
                    )}
                    <span>{percentage.toFixed(0)}%</span>
                </div>
            </div>
        </section>
    );
}

function LevelMetric({
    label,
    value,
    className,
}: {
    label: string;
    value: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('border-b border-[var(--platform-line)] pb-3', className)}>
            <dt className="text-xs font-medium text-[var(--platform-ink-muted)]">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-[var(--platform-ink)]">
                {value}
            </dd>
        </div>
    );
}

type SubmissionRegisterProps = {
    submissions: Submission[];
    focusOnMount: boolean;
    canViewDetails: boolean;
    locale: Locale;
    labels: {
        title: string;
        description: string;
        empty: string;
        problem: string;
        date: string;
        score: string;
        finalScore: string;
        status: string;
        unavailable: string;
        details: string;
    };
    getStatusTranslation: (status: string) => string;
    onViewDetails: (submission: Submission) => void;
};

function SubmissionRegister({
    submissions,
    focusOnMount,
    canViewDetails,
    locale,
    labels,
    getStatusTranslation,
    onViewDetails,
}: SubmissionRegisterProps) {
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!focusOnMount) return;

        const animationFrame = window.requestAnimationFrame(() => {
            const section = sectionRef.current;
            if (!section) return;

            const prefersReducedMotion = window.matchMedia(
                '(prefers-reduced-motion: reduce)',
            ).matches;
            section.focus({ preventScroll: true });
            section.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
                block: 'start',
            });
        });

        return () => window.cancelAnimationFrame(animationFrame);
    }, [focusOnMount]);

    return (
        <section
            ref={sectionRef}
            id="submissions"
            tabIndex={-1}
            aria-labelledby="submission-register-title"
            className={cn(
                'platform-panel scroll-mt-24 overflow-hidden bg-[var(--platform-paper)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-violet)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--platform-paper)]',
                focusOnMount &&
                    'ring-2 ring-[var(--platform-violet)] ring-offset-4 ring-offset-[var(--platform-paper)]',
            )}
        >
            <div className="platform-toolbar flex flex-wrap items-end justify-between gap-4 px-4 py-4 sm:px-5">
                <div>
                    <div className="flex items-center gap-2">
                        <History
                            className="h-5 w-5 text-[var(--platform-violet)]"
                            aria-hidden="true"
                        />
                        <h2
                            id="submission-register-title"
                            className="text-lg font-semibold tracking-[-0.025em] text-[var(--platform-ink)]"
                        >
                            {labels.title}
                        </h2>
                    </div>
                    <p className="mt-1 text-sm text-[var(--platform-ink-muted)]">
                        {labels.description}
                    </p>
                </div>
                <span
                    className="font-mono text-sm font-semibold tabular-nums text-[var(--platform-ink-muted)]"
                    aria-label={`${submissions.length} ${labels.title}`}
                >
                    {new Intl.NumberFormat(locale).format(submissions.length)}
                </span>
            </div>

            {submissions.length === 0 ? (
                <PlatformEmptyState className="border-0" icon={History} title={labels.empty} />
            ) : (
                <div>
                    <div
                        className={cn(
                            'hidden gap-3 border-b border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--platform-ink-muted)] md:grid sm:px-5',
                            canViewDetails
                                ? 'grid-cols-[2.5rem_minmax(0,1.6fr)_minmax(7rem,0.8fr)_minmax(6rem,0.65fr)_minmax(6rem,0.65fr)_minmax(7rem,0.75fr)_2.75rem]'
                                : 'grid-cols-[2.5rem_minmax(0,1.6fr)_minmax(7rem,0.8fr)_minmax(6rem,0.65fr)_minmax(6rem,0.65fr)_minmax(7rem,0.75fr)]',
                        )}
                        aria-hidden="true"
                    >
                        <span>#</span>
                        <span>{labels.problem}</span>
                        <span>{labels.date}</span>
                        <span className="text-end">{labels.score}</span>
                        <span className="text-end">{labels.finalScore}</span>
                        <span className="text-end">{labels.status}</span>
                        {canViewDetails ? <span /> : null}
                    </div>
                    <ol className="divide-y divide-[var(--platform-line)]">
                        {submissions.map((submission, index) => (
                            <li
                                key={submission.id}
                                className={cn(
                                    'grid gap-4 px-4 py-4 transition-colors duration-200 hover:bg-[var(--platform-paper-strong)] focus-within:bg-[var(--platform-paper-strong)] md:items-center md:gap-3 sm:px-5',
                                    canViewDetails
                                        ? 'md:grid-cols-[2.5rem_minmax(0,1.6fr)_minmax(7rem,0.8fr)_minmax(6rem,0.65fr)_minmax(6rem,0.65fr)_minmax(7rem,0.75fr)_2.75rem]'
                                        : 'md:grid-cols-[2.5rem_minmax(0,1.6fr)_minmax(7rem,0.8fr)_minmax(6rem,0.65fr)_minmax(6rem,0.65fr)_minmax(7rem,0.75fr)]',
                                )}
                            >
                                <span className="hidden font-mono text-xs tabular-nums text-[var(--platform-ink-muted)] md:block">
                                    {String(index + 1).padStart(2, '0')}
                                </span>
                                <div className="min-w-0">
                                    <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[11px] tabular-nums text-[var(--platform-ink-muted)] md:hidden">
                                        <span>{String(index + 1).padStart(2, '0')}</span>
                                        <time dateTime={submission.submittedAt.toISOString()}>
                                            {formatShortDate(submission.submittedAt, locale)}
                                        </time>
                                    </div>
                                    <Link
                                        href={`/problems/${submission.problemId}`}
                                        className="rounded-none font-semibold leading-6 text-[var(--platform-ink)] underline-offset-4 transition-colors hover:text-[var(--platform-violet)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-violet)] focus-visible:ring-offset-2"
                                    >
                                        <span className="line-clamp-2" dir="auto">
                                            {submission.problemTitle}
                                        </span>
                                    </Link>
                                </div>
                                <time
                                    dateTime={submission.submittedAt.toISOString()}
                                    className="hidden font-mono text-sm tabular-nums text-[var(--platform-ink-muted)] md:block"
                                >
                                    {formatShortDate(submission.submittedAt, locale)}
                                </time>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:contents">
                                    <SubmissionValue
                                        label={labels.score}
                                        value={formatScore(
                                            submission.score,
                                            locale,
                                            labels.unavailable,
                                        )}
                                    />
                                    <SubmissionValue
                                        label={labels.finalScore}
                                        value={formatScore(
                                            submission.finalScore,
                                            locale,
                                            labels.unavailable,
                                        )}
                                    />
                                    <div className="col-span-2 flex min-w-0 items-center justify-between border-t border-[var(--platform-line)] pt-3 md:col-span-1 md:block md:border-0 md:pt-0 md:text-end">
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--platform-ink-muted)] md:hidden">
                                            {labels.status}
                                        </span>
                                        <span
                                            className={cn(
                                                'inline-flex min-h-7 items-center border px-2 text-[11px] font-semibold leading-none',
                                                getSubmissionStatusClassName(submission.status),
                                            )}
                                        >
                                            {getStatusTranslation(submission.status)}
                                        </span>
                                    </div>
                                </div>
                                {canViewDetails ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => onViewDetails(submission)}
                                        aria-label={`${labels.details}: ${submission.problemTitle}`}
                                        className="min-h-11 w-full rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-3 text-[var(--platform-ink)] shadow-none transition-colors hover:border-[var(--platform-violet)] hover:bg-[var(--platform-violet)] hover:text-white focus-visible:ring-[var(--platform-violet)] dark:hover:text-[var(--platform-on-accent)] md:h-11 md:w-11 md:px-0"
                                    >
                                        <ScanSearch className="h-4 w-4" aria-hidden="true" />
                                        <span className="md:sr-only">{labels.details}</span>
                                    </Button>
                                ) : null}
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </section>
    );
}

function getSubmissionStatusClassName(status: string) {
    if (status === 'EVALUATED') {
        return 'border-[color-mix(in_oklch,var(--platform-citron)_58%,var(--platform-line))] bg-[color-mix(in_oklch,var(--platform-citron)_38%,transparent)] text-[var(--platform-ink)]';
    }

    if (status === 'PROCESSING' || status === 'PENDING') {
        return 'border-[color-mix(in_oklch,var(--platform-violet)_36%,var(--platform-line))] bg-[color-mix(in_oklch,var(--platform-violet)_12%,transparent)] text-[var(--platform-violet)]';
    }

    if (status === 'ERROR') {
        return 'border-[color-mix(in_oklch,var(--platform-coral)_48%,var(--platform-line))] bg-[color-mix(in_oklch,var(--platform-coral)_18%,transparent)] text-[var(--platform-ink)]';
    }

    return 'border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] text-[var(--platform-ink-muted)]';
}

function SubmissionValue({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 text-end">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--platform-ink-muted)] md:hidden">
                {label}
            </span>
            <span className="text-sm font-semibold tabular-nums text-[var(--platform-ink)]">
                {value}
            </span>
        </div>
    );
}

type AchievementStatsRegisterProps = {
    stats: AchievementStats;
    locale: string;
    labels: {
        title: string;
        earned: string;
        of: string;
        complete: string;
        totalXp: string;
        dayStreak: string;
        bestStreak: string;
        rarityDistribution: string;
    };
    rarityLabel: (rarity: AchievementRarity) => string;
};

function AchievementStatsRegister({
    stats,
    locale,
    labels,
    rarityLabel,
}: AchievementStatsRegisterProps) {
    const formatter = new Intl.NumberFormat(locale);
    const maxRarityCount = Math.max(...rarityOrder.map((rarity) => stats.byRarity[rarity] || 0), 1);

    return (
        <section className="platform-panel bg-[var(--platform-paper)]">
            <div className="platform-toolbar flex items-center gap-3 px-4 py-4 sm:px-5">
                <Award className="h-5 w-5 text-[var(--platform-violet)]" aria-hidden="true" />
                <h2 className="text-lg font-semibold tracking-[-0.025em] text-[var(--platform-ink)]">
                    {labels.title}
                </h2>
            </div>
            <dl className="grid grid-cols-2 border-b border-[var(--platform-line)] lg:grid-cols-4">
                <AchievementMetric
                    icon={Award}
                    label={labels.earned}
                    value={`${formatter.format(stats.totalEarned)}/${formatter.format(stats.totalAvailable)}`}
                />
                <AchievementMetric
                    icon={Trophy}
                    label={labels.complete}
                    value={`${Math.round(stats.completionPercentage)}%`}
                />
                <AchievementMetric
                    icon={Zap}
                    label={labels.totalXp}
                    value={formatter.format(stats.totalXp)}
                />
                <AchievementMetric
                    icon={Flame}
                    label={labels.dayStreak}
                    value={formatter.format(stats.currentStreak)}
                    detail={`${labels.bestStreak}: ${formatter.format(stats.longestStreak)}`}
                />
            </dl>

            <div className="p-4 sm:p-5">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                    {labels.rarityDistribution}
                </h3>
                <div className="space-y-3">
                    {rarityOrder.map((rarity) => {
                        const count = stats.byRarity[rarity] || 0;
                        const percentage = (count / maxRarityCount) * 100;
                        return (
                            <div
                                key={rarity}
                                className="grid grid-cols-[minmax(5.5rem,0.8fr)_minmax(0,3fr)_2.5rem] items-center gap-3"
                            >
                                <span className="truncate text-xs text-[var(--platform-ink-muted)]">
                                    {rarityLabel(rarity)}
                                </span>
                                <div className="h-3 border border-[var(--platform-line)] bg-[var(--platform-paper-strong)]">
                                    <div
                                        className={cn('h-full', rarityBarStyles[rarity])}
                                        style={{
                                            width: `${percentage}%`,
                                            minWidth: count > 0 ? '0.5rem' : 0,
                                        }}
                                    />
                                </div>
                                <span className="text-end text-xs font-semibold tabular-nums text-[var(--platform-ink)]">
                                    {formatter.format(count)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

function AchievementMetric({
    icon: Icon,
    label,
    value,
    detail,
}: {
    icon: typeof Award;
    label: string;
    value: string;
    detail?: string;
}) {
    return (
        <div className="min-h-28 border-e border-b border-[var(--platform-line)] p-4 last:border-e-0 lg:border-b-0">
            <dt className="flex items-center gap-2 text-xs font-medium text-[var(--platform-ink-muted)]">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
            </dt>
            <dd className="mt-3 text-2xl font-semibold tabular-nums tracking-[-0.04em] text-[var(--platform-ink)]">
                {value}
            </dd>
            {detail ? (
                <dd className="mt-1 text-[11px] text-[var(--platform-ink-muted)]">{detail}</dd>
            ) : null}
        </div>
    );
}

function ProfileViewSkeleton({ title }: { title: string }) {
    return (
        <PlatformPageShell contentClassName="space-y-8" aria-busy="true">
            <PlatformPageHeader
                eyebrow={title}
                icon={CircleUserRound}
                title={
                    <Skeleton className="h-12 w-72 max-w-full rounded-none bg-[var(--platform-line)]" />
                }
                description={
                    <Skeleton className="h-5 w-[34rem] max-w-full rounded-none bg-[var(--platform-line)]" />
                }
            />
            <div className="grid grid-cols-2 border-y border-[var(--platform-line-strong)] lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="space-y-4 border-e border-[var(--platform-line)] p-5"
                    >
                        <Skeleton className="h-3 w-24 rounded-none bg-[var(--platform-line)]" />
                        <Skeleton className="h-8 w-20 rounded-none bg-[var(--platform-line)]" />
                    </div>
                ))}
            </div>
            <div className="grid gap-8 xl:grid-cols-[minmax(18rem,0.78fr)_minmax(0,2.2fr)]">
                <Skeleton className="h-[34rem] rounded-none bg-[var(--platform-paper-strong)]" />
                <div className="space-y-6">
                    <Skeleton className="h-56 rounded-none bg-[var(--platform-paper-strong)]" />
                    <Skeleton className="h-80 rounded-none bg-[var(--platform-paper-strong)]" />
                </div>
            </div>
        </PlatformPageShell>
    );
}

function formatScore(value: number | null, locale: string, unavailableLabel: string) {
    if (value == null) return unavailableLabel;
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

function toExternalUrl(value: string) {
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function toGithubUrl(value: string) {
    if (/^https?:\/\//i.test(value)) return value;
    return `https://github.com/${value.replace(/^@/, '')}`;
}
