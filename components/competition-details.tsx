'use client';

import { Link } from '@/i18n/routing';
import { CompetitionUserResponse, GenericLeaderboardEntry, EditorialResponse } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeaderboardView } from '@/components/leaderboard-view';
import { ProblemList } from '@/components/problem-list';
import { useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CompetitionCountdown } from '@/components/competition-countdown';
import { CompetitionScoringBadge } from '@/components/competition-scoring-badge';
import dynamic from 'next/dynamic';
import StatusPillInner from '@/components/competition-status-pill';
import { AntiCheatBadge } from '@/components/anti-cheat-badge';
import { AntiCheatRulesSection } from '@/components/anti-cheat-rules-section';
import { SebRequiredBadge } from '@/components/seb-required-badge';
import { SebDownloadSection } from '@/components/seb-download-section';
import {
    AntiCheatConnectionProvider,
    useAntiCheatConnectionSafe,
} from '@/components/anti-cheat-connection-provider';
import { DisqualificationBanner } from '@/components/disqualification-banner';
import { useDisqualificationNotifications } from '@/components/disqualification-notification-provider';
import { useSession, signIn } from 'next-auth/react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    CheckCircle2,
    MoreVertical,
    LogOut,
    AlertCircle,
    Loader2,
    Share2,
    ShieldAlert,
    RefreshCcw,
    Wifi,
    UserCircle,
    FileDown,
    Trophy,
    ArrowUpRight,
    Layers3,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { DismissibleAlert } from '@/components/dismissible-alert';
import {
    fetchApi,
    fetchEditorial,
    refreshCompetitionProblems,
    acknowledgeSubmissionSelection,
    updateRecordingLink,
} from '@/lib/api';
import { toast } from 'sonner';
import { EditorialTab } from '@/components/editorial';
import { useGTMTracker } from '@/hooks/use-gtm-tracker';
import { AnalyticsEvents } from '@/lib/analytics';
import { useLocale } from '@/hooks/use-locale';
import { getCompetitionContent, TranslatableCompetition } from '@/lib/competition-translations';
import { renderLatex } from '@/lib/render-latex';
import { createLatexClickHandler, createLatexKeyDownHandler } from '@/components/latex-content';
import { AppealSection } from '@/components/appeal-section';
import { PlatformPageShell } from '@/components/platform-page-shell';
import { platformSans } from '@/lib/platform-fonts';
import { cn } from '@/lib/utils';
import { scrollActiveTabIntoView } from '@/lib/scroll-active-tab';
import { normalizeAuthoredHtmlAnchorTargets } from '@/lib/normalize-authored-html';
import { hasLiveFinalScores } from '@/lib/competition-utils';
import { OrganizerDataConsentSettings } from '@/components/competition-organizer-data-consent';
import type { CompetitionOrganizerDataConsent } from '@/lib/competition-hosting';

const competitionDialogClassName = cn(
    platformSans.className,
    'max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-none border-2 border-[oklch(0.62_0.06_287)] bg-[oklch(0.978_0.014_292)] text-[oklch(0.22_0.055_282)] shadow-[8px_8px_0_oklch(0.43_0.235_291/0.24)] dark:border-[oklch(0.5_0.07_287)] dark:bg-[oklch(0.18_0.038_286)] dark:text-[oklch(0.94_0.016_292)]',
);

/** Re-render exactly when a competition crosses a start/end/post-event boundary. */
function useCompetitionBoundaryTime(startTime: string, endTime: string): number {
    const [nowMs, setNowMs] = useState(() => Date.now());

    useEffect(() => {
        const currentTime = Date.now();
        const startMs = Date.parse(startTime);
        const endMs = Date.parse(endTime);
        const boundaries = [startMs, endMs, endMs + 8 * 60 * 60 * 1000].filter(
            (boundary) => Number.isFinite(boundary) && boundary > currentTime,
        );

        if (boundaries.length === 0) return;

        const nextBoundary = Math.min(...boundaries);
        const delay = Math.max(50, Math.min(nextBoundary - currentTime + 50, 2_147_000_000));
        const timer = window.setTimeout(() => setNowMs(Date.now()), delay);

        return () => window.clearTimeout(timer);
    }, [endTime, nowMs, startTime]);

    return nowMs;
}

const HybridCompetitionPanel = dynamic(() =>
    import('@/components/hybrid-competition-panel').then((mod) => mod.HybridCompetitionPanel),
);

const SelectedSubmissionsModal = dynamic(
    () =>
        import('@/components/selected-submissions-modal').then((mod) => ({
            default: mod.SelectedSubmissionsModal,
        })),
    { ssr: false },
);

const StatusPillClient = dynamic(() => Promise.resolve(StatusPillInner), { ssr: false });

const CompetitionDateDisplayClient = dynamic(
    () =>
        import('@/components/competition-date-display').then((mod) => ({
            default: mod.CompetitionDateDisplay,
        })),
    { ssr: false },
);

const CompetitionWaringDisplay = dynamic(
    () =>
        import('@/components/competition-warning-display').then((mod) => ({
            default: mod.CompetitionWarningDisplay,
        })),
    { ssr: false },
);

function HeaderActionsInner({
    competition,
    onLeaveSuccess,
    onJoinClick,
    onLeaveClick,
    onShareClick,
    onUpdateRequiredFieldsClick,
    isPreJoinedParticipant = false,
}: {
    competition: CompetitionUserResponse;
    onLeaveSuccess?: () => void;
    onJoinClick?: () => void;
    onLeaveClick?: () => void;
    onShareClick?: (method: string) => void;
    onUpdateRequiredFieldsClick?: () => void;
    /** Whether the user is a pre-joined participant - hides join button */
    isPreJoinedParticipant?: boolean;
}) {
    const t = useTranslations('competitions.details');
    const { status } = useSession();
    const tRequired = useTranslations('requiredFields');
    const router = useRouter();
    const { locale } = useLocale();
    const [showLeaveDialog, setShowLeaveDialog] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    const now = new Date();
    const start = new Date(competition.startTime);
    const end = new Date(competition.endTime);
    const canJoin = now < end;
    const isOngoing = start < now && now < end;
    const hasEnded = now > end;
    const hasStarted = now > start;
    const canLeave = !hasStarted && !hasEnded && !competition.validationRequired; // Can only leave before competition starts and if validation is not required
    const canUpdateRequiredFields =
        competition.requiredFields && competition.requiredFields.length > 0 && !hasStarted;
    const isAuthenticated = status === 'authenticated';

    const handleJoinClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        // Track competition join click
        onJoinClick?.();

        if (!isAuthenticated) {
            e.preventDefault();
            signIn('keycloak', {
                callbackUrl: `/${locale}/competitions/${competition.id}/join`,
            });
        }
    };

    const handleShare = async () => {
        const shareUrl = `${window.location.origin}/${locale}/competitions/${competition.id}`;
        const shareData = {
            title: competition.name,
            text: competition.description?.substring(0, 100) || competition.name,
            url: shareUrl,
        };

        // Try native share API first (mobile)
        if (navigator.share && navigator.canShare?.(shareData)) {
            try {
                await navigator.share(shareData);
                onShareClick?.('native');
                return;
            } catch (error) {
                // User cancelled or error - fall through to clipboard
                if ((error as Error).name !== 'AbortError') {
                    console.error('Share failed:', error);
                }
            }
        }

        // Fallback to clipboard
        try {
            await navigator.clipboard.writeText(shareUrl);
            toast.success(t('linkCopied'));
            onShareClick?.('clipboard');
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            toast.error(t('copyFailed'));
        }
    };

    const handleLeaveCompetition = async () => {
        setIsLeaving(true);
        try {
            const response = await fetchApi(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${competition.id}/leave`,
                {
                    method: 'POST',
                },
            );

            if (response.ok) {
                // Track competition leave
                onLeaveClick?.();

                toast.success(t('leaveSuccess'));
                setShowLeaveDialog(false);
                // Refresh the page to update the UI
                router.refresh();
                onLeaveSuccess?.();
            } else {
                toast.error(t('leaveFailed'));
            }
        } catch (error) {
            console.error('Failed to leave competition:', error);
            toast.error(t('leaveFailed'));
        } finally {
            setIsLeaving(false);
        }
    };

    return (
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {isOngoing && <CompetitionCountdown endTime={competition.endTime} />}

                {/* Share button */}
                <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] text-[var(--platform-ink)] shadow-none hover:border-[var(--platform-violet)] hover:bg-[var(--platform-paper-strong)] hover:text-[var(--platform-violet)]"
                    onClick={handleShare}
                    aria-label={t('shareCompetition')}
                >
                    <Share2 className="h-4 w-4" />
                </Button>

                {/* Requirements: 1.3, 4.3 - Hide join button for pre-joined participants */}
                {competition.joined || isPreJoinedParticipant ? (
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="outline"
                            className="min-h-11 rounded-none border-lime-600/35 bg-lime-300/45 px-3 text-sm font-semibold text-lime-950 shadow-none dark:border-lime-400/40 dark:bg-lime-400/20 dark:text-lime-100"
                        >
                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                            {t('joinedBadge')}
                        </Badge>

                        {(canLeave || canUpdateRequiredFields) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-11 w-11 rounded-none text-[var(--platform-ink-muted-strong)] hover:bg-[var(--platform-paper-strong)] hover:text-[var(--platform-violet)]"
                                        aria-label={t('competitionOptions')}
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {canUpdateRequiredFields && (
                                        <DropdownMenuItem
                                            className="cursor-pointer"
                                            onClick={onUpdateRequiredFieldsClick}
                                        >
                                            <UserCircle className="w-4 h-4 mr-2" />
                                            {tRequired('updateValues')}
                                        </DropdownMenuItem>
                                    )}
                                    {canLeave && (
                                        <DropdownMenuItem
                                            className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 cursor-pointer"
                                            onClick={() => setShowLeaveDialog(true)}
                                        >
                                            <LogOut className="w-4 h-4 mr-2" />
                                            {t('leaveCompetition')}
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                ) : (
                    canJoin &&
                    !competition.validationRequired && (
                        <Link
                            href={`/competitions/${competition.id}/join`}
                            onClick={handleJoinClick}
                            className="inline-flex min-h-11 items-center justify-center bg-[var(--platform-citron)] px-5 py-2 text-sm font-bold text-[var(--platform-on-accent)] shadow-[4px_4px_0_var(--platform-violet)] transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transition-none"
                        >
                            {t('join')}
                        </Link>
                    )
                )}
            </div>

            <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
                <AlertDialogContent className={competitionDialogClassName}>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                            {t('leaveDialogTitle')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('leaveDialogDescription')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLeaving} className="min-h-11 rounded-none">
                            {t('leaveDialogCancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleLeaveCompetition}
                            disabled={isLeaving}
                            className="min-h-11 rounded-none bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            {isLeaving ? t('leaveDialogLeaving') : t('leaveDialogConfirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

const HeaderActionsClient = dynamic(() => Promise.resolve(HeaderActionsInner), { ssr: false });

function TabsInner({
    competition: initialCompetition,
    leaderboard,
    onLeaderboardView,
    onEditorialView,
    setForceOpenSelectedSubmissions,
    showFinishConfirm,
    setShowFinishConfirm,
}: {
    competition: CompetitionUserResponse;
    leaderboard: {
        partialLeaderboard: GenericLeaderboardEntry[];
        completeLeaderboard: GenericLeaderboardEntry[] | null;
    };
    onLeaderboardView?: () => void;
    onEditorialView?: () => void;
    setForceOpenSelectedSubmissions: (val: boolean) => void;
    showFinishConfirm: boolean;
    setShowFinishConfirm: (val: boolean) => void;
}) {
    const t = useTranslations('competitions.details');
    const tCommon = useTranslations('common');
    const [competition, setCompetition] = useState(initialCompetition);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const problems = competition.problems;
    const { locale } = useLocale();
    const connection = useAntiCheatConnectionSafe();
    const nowMs = useCompetitionBoundaryTime(competition.startTime, competition.endTime);

    // Get translated competition content based on current locale
    const competitionContent = getCompetitionContent(
        competition as unknown as TranslatableCompetition,
        locale,
    );
    const renderedRules = useMemo(
        () =>
            normalizeAuthoredHtmlAnchorTargets(
                renderLatex(
                    competitionContent.rules.replace(/<(\/?)h1(\b[^>]*)>/gi, '<$1h2$2>'),
                    tCommon('clickToCopyFormula'),
                ),
            ),
        [competitionContent.rules, tCommon],
    );
    const renderedDescription = useMemo(
        () =>
            normalizeAuthoredHtmlAnchorTargets(
                renderLatex(
                    competitionContent.description.replace(/<(\/?)h1(\b[^>]*)>/gi, '<$1h2$2>'),
                    tCommon('clickToCopyFormula'),
                ),
            ),
        [competitionContent.description, tCommon],
    );
    const onLatexClick = useMemo(() => createLatexClickHandler(tCommon('latexCopied')), [tCommon]);
    const onLatexKeyDown = useMemo(
        () => createLatexKeyDownHandler(tCommon('latexCopied')),
        [tCommon],
    );

    const now = new Date(nowMs);
    const start = new Date(competition.startTime);
    const end = new Date(competition.endTime);
    const eightHoursAfterEnd = new Date(end.getTime() + 8 * 60 * 60 * 1000);
    const hasEnded = now > end;
    const isPastEightHoursAfterEnd = now > eightHoursAfterEnd;
    const isOngoing = start < now && now < end;

    const needsRefresh =
        isOngoing &&
        competition.joined &&
        (competition.anticheatSessionNotOk === true ||
            competition.missingRequiredFields === true ||
            competition.disabled === true);
    const showProblems =
        (isOngoing &&
            competition.joined &&
            !needsRefresh &&
            !connection?.isFinished &&
            !competition.disabled) ||
        hasEnded;
    const hasPartialLeaderboard =
        leaderboard.partialLeaderboard !== null && leaderboard.partialLeaderboard.length > 0;
    const hasFinalLeaderboard =
        leaderboard.completeLeaderboard !== null && leaderboard.completeLeaderboard.length > 0;
    const isHybrid = competition.competitionType === 'HYBRID';
    const requiresSubmissionSelection =
        !hasLiveFinalScores(competition.competitionType) &&
        (!isHybrid || problems.length > 0 || competition.submissionSelectionNotAcknowledged);

    // Disqualification status - show banner only during ongoing competition
    const isDisqualified = competition.disqualified === true;
    const showDisqualificationBanner = isDisqualified && isOngoing;

    const showFinishEarly =
        isOngoing &&
        competition.joined &&
        !competition.disabled &&
        !isDisqualified &&
        !connection?.isFinished;

    // Editorial is shown only when competition has ended AND hasEditorial is true
    // Requirements: 1.3, 1.4
    const showEditorial = hasEnded && competition.hasEditorial === true;

    // Editorial state
    const [editorial, setEditorial] = useState<EditorialResponse | null>(null);
    const [editorialLoading, setEditorialLoading] = useState(false);
    const [editorialError, setEditorialError] = useState<string | null>(null);
    const [isFinishingEarly, setIsFinishingEarly] = useState(false);
    const [isAcknowledging, setIsAcknowledging] = useState(false);
    const [showAcknowledgeConfirm, setShowAcknowledgeConfirm] = useState(false);
    const [acknowledgePassword, setAcknowledgePassword] = useState('');
    const [acknowledgeError, setAcknowledgeError] = useState<string | null>(null);

    // Recording link state
    const [recordingLink, setRecordingLink] = useState(competition.recordingLink || '');
    const [isSavingRecordingLink, setIsSavingRecordingLink] = useState(false);

    const showRecordingTab =
        competition.joined &&
        competition.requiredRecordingLink &&
        (recordingLink || hasEnded || competition.disabled) &&
        (!isPastEightHoursAfterEnd || !!recordingLink);

    const showDiplomas = !!competition.diplomaUrl;

    const isRecordingReadOnly = isPastEightHoursAfterEnd;

    // Track if leaderboard view has been tracked to avoid duplicate events
    const leaderboardTrackedRef = useRef(false);
    // Track if editorial view has been tracked to avoid duplicate events
    const editorialTrackedRef = useRef(false);
    const tabStripRef = useRef<HTMLDivElement>(null);
    const activeTabTriggerRef = useRef<HTMLButtonElement>(null);
    const hasPositionedInitialTabRef = useRef(false);

    const requiresEntryChecks = !!(
        competition.submissionSelectionNotAcknowledged || competition.sessionNotOk
    );
    const showProblemTab =
        (showProblems || needsRefresh) &&
        (!isHybrid || problems.length > 0 || (isOngoing && (needsRefresh || requiresEntryChecks)));
    const showHybridTab =
        isHybrid &&
        competition.joined &&
        !isDisqualified &&
        (hasEnded ||
            (isOngoing &&
                !needsRefresh &&
                !competition.sessionNotOk &&
                !(
                    competition.validationRequired && competition.submissionSelectionNotAcknowledged
                ) &&
                !connection?.isFinished));

    const { availableTabs, defaultTab } = useMemo(() => {
        const tabs: string[] = ['description', 'rules'];
        if (showHybridTab) tabs.push('hybrid');
        if (showProblemTab) tabs.push('problems');
        if (hasPartialLeaderboard) tabs.push('partial');
        if (hasFinalLeaderboard) tabs.push('final');
        if (showRecordingTab) tabs.push('recording');
        if (showDiplomas) tabs.push('diplomas');
        if (showEditorial) tabs.push('editorial');
        if (showFinishEarly) tabs.push('finish');
        return { availableTabs: tabs, defaultTab: 'description' as const };
    }, [
        showHybridTab,
        showProblemTab,
        hasPartialLeaderboard,
        hasFinalLeaderboard,
        showRecordingTab,
        showDiplomas,
        showEditorial,
        showFinishEarly,
    ]);

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const initialTabFromUrl = useMemo(() => {
        const urlTab = searchParams?.get('tab');
        if (urlTab && availableTabs.includes(urlTab)) return urlTab;
        return defaultTab;
    }, [searchParams, availableTabs, defaultTab]);

    const [activeTab, setActiveTab] = useState<string>(initialTabFromUrl);

    const handleSaveRecordingLink = async () => {
        if (isSavingRecordingLink) return;
        setIsSavingRecordingLink(true);
        try {
            await updateRecordingLink(competition.id, recordingLink);
            toast.success(t('recording.saveSuccess'));
        } catch (error) {
            console.error('Failed to save recording link:', error);
            toast.error(t('recording.saveError'));
        } finally {
            setIsSavingRecordingLink(false);
        }
    };

    const handleAcknowledge = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isAcknowledging) return;
        setIsAcknowledging(true);
        setAcknowledgeError(null);
        try {
            await acknowledgeSubmissionSelection(
                competition.id,
                competition.validationRequired ? acknowledgePassword : undefined,
            );
        } catch (error: any) {
            setIsAcknowledging(false);
            setAcknowledgeError(error.message);
            return;
        }

        try {
            const updatedCompetition = await refreshCompetitionProblems(competition.id);
            setCompetition({ ...competition, ...updatedCompetition });
            toast.success(t('problemsRefreshed'));
            setShowAcknowledgeConfirm(false);
            setAcknowledgePassword('');
        } catch (error: any) {
            console.error('Failed to acknowledge submission selection:', error);
            toast.error(t('refreshFailed'));
        } finally {
            setIsAcknowledging(false);
        }
    };

    const handleRefresh = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            const updatedCompetition = await refreshCompetitionProblems(competition.id);
            setCompetition({ ...competition, ...updatedCompetition });
            toast.success(t('problemsRefreshed'));
        } catch (error) {
            console.error('Failed to refresh competition problems:', error);
            toast.error(t('refreshFailed'));
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleFinishCompetitionEarly = async () => {
        setIsFinishingEarly(true);
        try {
            const response = await fetchApi(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${competition.id}/finish-and-disable`,
                {
                    method: 'POST',
                },
            );

            if (response.ok) {
                toast.success(t('finishEarly.success'));
                setShowFinishConfirm(false);

                // Update the competition status locally to reflect it's disabled
                setCompetition((prev) => ({ ...prev, disabled: true }));

                // Refresh the page to update the UI
                if (connection !== null) {
                    await connection.refresh();
                }
                await handleRefresh();
            } else {
                toast.error(t('finishEarly.error'));
            }
        } catch (error) {
            console.error('Failed to finish competition early:', error);
            toast.error(t('finishEarly.error'));
        } finally {
            setIsFinishingEarly(false);
        }
    };

    useEffect(() => {
        const urlTab = searchParams?.get('tab');
        const desired = urlTab && availableTabs.includes(urlTab) ? urlTab : defaultTab;
        setActiveTab((current) => (current === desired ? current : desired));
    }, [availableTabs, defaultTab, searchParams]);

    useEffect(() => {
        const tabStrip = tabStripRef.current;
        const activeTrigger = activeTabTriggerRef.current;
        if (!tabStrip || !activeTrigger) return;

        const frameId = window.requestAnimationFrame(() => {
            const prefersReducedMotion = window.matchMedia?.(
                '(prefers-reduced-motion: reduce)',
            ).matches;
            const behavior: ScrollBehavior =
                prefersReducedMotion || !hasPositionedInitialTabRef.current ? 'auto' : 'smooth';

            scrollActiveTabIntoView(tabStrip, activeTrigger, behavior);
            hasPositionedInitialTabRef.current = true;
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [activeTab]);

    // Track leaderboard view when switching to partial or final tab
    useEffect(() => {
        if ((activeTab === 'partial' || activeTab === 'final') && !leaderboardTrackedRef.current) {
            leaderboardTrackedRef.current = true;
            onLeaderboardView?.();
        }
    }, [activeTab, onLeaderboardView]);

    // Fetch editorial data when editorial tab is selected
    useEffect(() => {
        if (activeTab === 'editorial' && showEditorial && !editorial && !editorialLoading) {
            setEditorialLoading(true);
            setEditorialError(null);
            fetchEditorial(competition.id)
                .then((data) => {
                    setEditorial(data);
                })
                .catch((err) => {
                    console.error('Failed to fetch editorial:', err);
                    setEditorialError(err.message || 'Failed to load editorial');
                })
                .finally(() => {
                    setEditorialLoading(false);
                });
        }
    }, [activeTab, showEditorial, editorial, editorialLoading, competition.id]);

    const updateUrlTab = (value: string) => {
        const params = new URLSearchParams(searchParams?.toString());
        if (value === defaultTab) params.delete('tab');
        else params.set('tab', value);
        const query = params.toString();
        const next = query ? `${pathname}?${query}` : pathname;
        router.replace(next, { scroll: false });
    };

    const handleTabChange = (val: string) => {
        const value = availableTabs.includes(val) ? val : defaultTab;
        setActiveTab(value);
        updateUrlTab(value);

        // Track leaderboard view when switching to leaderboard tabs
        if ((value === 'partial' || value === 'final') && !leaderboardTrackedRef.current) {
            leaderboardTrackedRef.current = true;
            onLeaderboardView?.();
        }

        // Track editorial view when switching to editorial tab
        if (value === 'editorial' && !editorialTrackedRef.current) {
            editorialTrackedRef.current = true;
            onEditorialView?.();
        }
    };

    const problemsNotLoadedError = () => {
        if (connection?.isFinished || competition.disabled) {
            return t('competitionFinishedMessage');
        }

        if (competition.missingRequiredFields) {
            return t('missingRequiredFieldsMessage');
        }

        if (competition.anticheatSessionNotOk) {
            return t('anticheatSessionNotOkMessage');
        }
    };

    const tabTriggerClass =
        'min-h-12 w-auto min-w-max rounded-none border-b-[3px] border-transparent px-4 text-xs font-semibold text-[var(--platform-ink-muted)] shadow-none transition-colors duration-200 hover:bg-[var(--platform-paper-strong)] hover:text-[var(--platform-ink)] data-[state=active]:border-[var(--platform-violet)] data-[state=active]:bg-[var(--platform-paper-strong)] data-[state=active]:text-[var(--platform-violet)] data-[state=active]:shadow-none sm:px-5 sm:text-sm';

    return (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div
                ref={tabStripRef}
                className="platform-toolbar overflow-x-auto [scrollbar-width:thin]"
            >
                <TabsList className="flex h-auto w-max min-w-full flex-row justify-start rounded-none bg-transparent p-0">
                    <TabsTrigger
                        ref={activeTab === 'description' ? activeTabTriggerRef : undefined}
                        value="description"
                        className={tabTriggerClass}
                    >
                        {t('tabs.description')}
                    </TabsTrigger>
                    <TabsTrigger
                        ref={activeTab === 'rules' ? activeTabTriggerRef : undefined}
                        value="rules"
                        className={tabTriggerClass}
                    >
                        {t('tabs.rules')}
                    </TabsTrigger>
                    {showHybridTab && (
                        <TabsTrigger
                            ref={activeTab === 'hybrid' ? activeTabTriggerRef : undefined}
                            value="hybrid"
                            className={tabTriggerClass}
                        >
                            {t('tabs.hybrid')}
                        </TabsTrigger>
                    )}
                    {showProblemTab && (
                        <TabsTrigger
                            ref={activeTab === 'problems' ? activeTabTriggerRef : undefined}
                            value="problems"
                            className={tabTriggerClass}
                        >
                            {t('tabs.problems')}
                        </TabsTrigger>
                    )}
                    {hasPartialLeaderboard && (
                        <TabsTrigger
                            ref={activeTab === 'partial' ? activeTabTriggerRef : undefined}
                            value="partial"
                            className={tabTriggerClass}
                        >
                            {t('tabs.partial')}
                        </TabsTrigger>
                    )}
                    {hasFinalLeaderboard && (
                        <TabsTrigger
                            ref={activeTab === 'final' ? activeTabTriggerRef : undefined}
                            value="final"
                            className={tabTriggerClass}
                        >
                            {t('tabs.final')}
                        </TabsTrigger>
                    )}
                    {showRecordingTab && (
                        <TabsTrigger
                            ref={activeTab === 'recording' ? activeTabTriggerRef : undefined}
                            value="recording"
                            className={tabTriggerClass}
                        >
                            {t('tabs.recording')}
                        </TabsTrigger>
                    )}
                    {showDiplomas && (
                        <TabsTrigger
                            ref={activeTab === 'diplomas' ? activeTabTriggerRef : undefined}
                            value="diplomas"
                            className={tabTriggerClass}
                        >
                            {t('tabs.diplomas')}
                        </TabsTrigger>
                    )}
                    {showEditorial && (
                        <TabsTrigger
                            ref={activeTab === 'editorial' ? activeTabTriggerRef : undefined}
                            value="editorial"
                            className={tabTriggerClass}
                        >
                            {t('tabs.editorial')}
                        </TabsTrigger>
                    )}
                    {showFinishEarly && (
                        <TabsTrigger
                            ref={activeTab === 'finish' ? activeTabTriggerRef : undefined}
                            value="finish"
                            className={tabTriggerClass}
                        >
                            {t('tabs.finish')}
                        </TabsTrigger>
                    )}
                </TabsList>
            </div>

            {hasPartialLeaderboard && (
                <TabsContent value="partial" className="mt-6">
                    <LeaderboardView
                        leaderboard={leaderboard.partialLeaderboard || []}
                        problems={problems}
                        simple={true}
                        isLoading={false}
                        identitySurface={
                            competition.competitionType === 'CASUAL'
                                ? 'CASUAL_COMPETITION_LEADERBOARD'
                                : 'RESTRICTED_COMPETITION_LEADERBOARD'
                        }
                    />
                </TabsContent>
            )}
            {hasFinalLeaderboard && (
                <TabsContent value="final" className="mt-6">
                    <LeaderboardView
                        leaderboard={leaderboard.completeLeaderboard || []}
                        problems={problems}
                        showAwardRank={competition.showAwardRank}
                        simple={true}
                        isLoading={false}
                        identitySurface={
                            competition.competitionType === 'CASUAL'
                                ? 'CASUAL_COMPETITION_LEADERBOARD'
                                : 'RESTRICTED_COMPETITION_LEADERBOARD'
                        }
                    />
                </TabsContent>
            )}

            {showHybridTab && (
                <TabsContent
                    value="hybrid"
                    className="mt-6"
                    forceMount
                    hidden={activeTab !== 'hybrid'}
                >
                    <HybridCompetitionPanel
                        key={competition.id}
                        competitionId={competition.id}
                        readOnly={!isOngoing}
                        onEntryCheck={
                            competition.submissionSelectionNotAcknowledged && isOngoing
                                ? () => handleTabChange('problems')
                                : undefined
                        }
                    />
                </TabsContent>
            )}

            {showProblemTab && (
                <TabsContent value="problems" className="mt-6">
                    {showDisqualificationBanner && (
                        <DisqualificationBanner
                            reason={competition.disqualificationReason}
                            disqualifiedAt={competition.disqualifiedAt}
                        />
                    )}
                    {needsRefresh ? (
                        <div className="platform-empty-state space-y-4 border border-[var(--platform-line-strong)]">
                            <span className="platform-empty-icon">
                                <ShieldAlert className="h-6 w-6" aria-hidden="true" />
                            </span>
                            <div className="text-center">
                                <h3 className="text-lg font-semibold">
                                    {competition.disabled
                                        ? t('participantFinishedTitle')
                                        : t('problemsHiddenTitle')}
                                </h3>
                                <p className="text-sm text-[var(--platform-ink-muted)]">
                                    {problemsNotLoadedError()}
                                </p>
                            </div>
                            {!connection?.isFinished && !competition.disabled && (
                                <Button
                                    onClick={handleRefresh}
                                    disabled={isRefreshing}
                                    className="flex min-h-11 items-center gap-2 rounded-none bg-[var(--platform-violet)] text-[var(--platform-paper)] shadow-none hover:bg-[var(--platform-violet-strong)]"
                                >
                                    {isRefreshing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <RefreshCcw className="w-4 h-4" />
                                    )}
                                    {t('refreshProblems')}
                                </Button>
                            )}
                        </div>
                    ) : ((requiresSubmissionSelection &&
                          competition.submissionSelectionNotAcknowledged) ||
                          competition.sessionNotOk) &&
                      !hasEnded ? (
                        <div className="flex flex-col items-center justify-center space-y-4 border border-orange-600/35 bg-orange-400/10 p-8 text-center">
                            <span className="flex h-14 w-14 items-center justify-center bg-[var(--platform-coral)] text-[var(--platform-on-accent)] shadow-[4px_4px_0_var(--platform-violet)]">
                                <ShieldAlert className="h-6 w-6" aria-hidden="true" />
                            </span>
                            <div className="text-center">
                                <h3 className="text-lg font-semibold">
                                    {competition.disabled
                                        ? t('participantFinishedTitle')
                                        : t('problemsHiddenTitle')}
                                </h3>
                                <p className="max-w-md text-sm text-[var(--platform-ink-muted)]">
                                    {competition.sessionNotOk
                                        ? t('sessionNotOkMessage')
                                        : t('submissionSelection.alert', {
                                              count: competition.submissionSelectionRequiredCount,
                                          })}
                                </p>
                                <div className="flex flex-wrap justify-center gap-2 mt-4">
                                    {requiresSubmissionSelection &&
                                        !competition.sessionNotOk &&
                                        !connection?.isFinished &&
                                        !competition.disabled && (
                                            <Button
                                                onClick={() => setShowAcknowledgeConfirm(true)}
                                                size="sm"
                                                className="min-h-11 rounded-none bg-[var(--platform-violet)] text-[var(--platform-paper)] shadow-none hover:bg-[var(--platform-violet-strong)]"
                                            >
                                                {t('submissionSelection.acknowledge')}
                                            </Button>
                                        )}
                                </div>
                            </div>
                        </div>
                    ) : problems.length > 0 ? (
                        <ProblemList problems={problems} variant="ledger" />
                    ) : (
                        <div className="platform-empty-state">
                            <span className="platform-empty-icon">
                                <Trophy className="h-6 w-6" aria-hidden="true" />
                            </span>
                            <p className="text-sm text-[var(--platform-ink-muted)]">
                                {t('noProblems')}
                            </p>
                        </div>
                    )}
                </TabsContent>
            )}

            <TabsContent value="rules" className="mt-6">
                <div className="platform-panel p-5 sm:p-8">
                    <AntiCheatRulesSection
                        enabled={competition.antiCheatEnabled === true}
                        className="mb-6"
                    />
                    <SebDownloadSection
                        required={competition.sebRequired === true}
                        competitionId={competition.id}
                        className="mb-6"
                    />
                    <article
                        className="themed-html"
                        dangerouslySetInnerHTML={{ __html: renderedRules }}
                        onClick={onLatexClick}
                        onKeyDown={onLatexKeyDown}
                    />
                </div>
            </TabsContent>

            <TabsContent value="description" className="mt-6">
                <div className="platform-panel p-5 sm:p-8">
                    {showDisqualificationBanner && (
                        <DisqualificationBanner
                            reason={competition.disqualificationReason}
                            disqualifiedAt={competition.disqualifiedAt}
                        />
                    )}
                    <article
                        className="themed-html"
                        dangerouslySetInnerHTML={{ __html: renderedDescription }}
                        onClick={onLatexClick}
                        onKeyDown={onLatexKeyDown}
                    />
                </div>
            </TabsContent>

            {showRecordingTab && (
                <TabsContent value="recording" className="mt-6 space-y-6">
                    <div className="platform-panel space-y-6 p-5 sm:p-8">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold">{t('recording.title')}</h3>
                            <p className="text-[var(--platform-ink-muted)]">
                                {t('recording.description')}
                            </p>
                        </div>
                        <div className="space-y-4 max-w-2xl">
                            <div className="space-y-2">
                                <label
                                    htmlFor="recordingLink"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    {t('recording.linkLabel')}
                                </label>
                                <input
                                    id="recordingLink"
                                    type="url"
                                    placeholder="https://..."
                                    className="flex min-h-11 w-full rounded-none border border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-3 py-2 text-sm text-[var(--platform-ink)] placeholder:text-[var(--platform-ink-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                                    value={recordingLink}
                                    onChange={(e) => setRecordingLink(e.target.value)}
                                    disabled={isRecordingReadOnly}
                                />
                            </div>
                            {!isRecordingReadOnly && (
                                <Button
                                    onClick={handleSaveRecordingLink}
                                    disabled={isSavingRecordingLink}
                                    className="min-h-11 w-full rounded-none bg-[var(--platform-violet)] text-[var(--platform-paper)] shadow-none hover:bg-[var(--platform-violet-strong)] sm:w-auto"
                                >
                                    {isSavingRecordingLink && (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    )}
                                    {t('recording.saveButton')}
                                </Button>
                            )}
                        </div>
                    </div>
                </TabsContent>
            )}

            {showEditorial && (
                <TabsContent value="editorial" className="mt-6">
                    {editorialLoading && (
                        <div
                            className="platform-panel flex min-h-64 items-center justify-center py-12"
                            role="status"
                            aria-busy="true"
                        >
                            <span className="sr-only">{tCommon('loading')}</span>
                            <Loader2
                                className="h-8 w-8 animate-spin text-[var(--platform-violet)] motion-reduce:animate-none"
                                aria-hidden="true"
                            />
                        </div>
                    )}
                    {editorialError && (
                        <div className="platform-empty-state border border-red-500/35">
                            <AlertCircle className="mb-2 h-8 w-8 text-red-600 dark:text-red-400" />
                            <p className="text-sm text-[var(--platform-ink-muted)]">
                                {editorialError}
                            </p>
                        </div>
                    )}
                    {editorial && !editorialLoading && !editorialError && (
                        <EditorialTab editorial={editorial} />
                    )}
                </TabsContent>
            )}

            {showDiplomas && (
                <TabsContent value="diplomas" className="mt-6">
                    <div className="platform-panel p-5 sm:p-8">
                        <h3 className="text-xl font-bold tracking-[-0.03em] text-[var(--platform-ink)]">
                            {t('diplomas.title')}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--platform-ink-muted)]">
                            {t('diplomas.description')}
                        </p>
                        <div className="flex justify-start pt-6">
                            <Button
                                asChild
                                size="lg"
                                className="min-h-11 rounded-none bg-[var(--platform-citron)] font-bold text-[var(--platform-on-accent)] shadow-[4px_4px_0_var(--platform-violet)] hover:bg-[var(--platform-citron)]"
                            >
                                <a
                                    href={competition.diplomaUrl!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2"
                                >
                                    <FileDown className="w-5 h-5" />
                                    {t('diplomas.downloadButton')}
                                </a>
                            </Button>
                        </div>
                    </div>
                </TabsContent>
            )}

            {showFinishEarly && (
                <TabsContent value="finish" className="mt-6 space-y-6">
                    {(!isHybrid || problems.length > 0) && (
                        <DismissibleAlert message={t('finishTabAlert')} dismissible={false} />
                    )}

                    <div className="platform-panel flex flex-col items-center space-y-6 p-6 text-center sm:p-8">
                        <div className="flex h-14 w-14 items-center justify-center bg-[var(--platform-coral)] text-[var(--platform-on-accent)] shadow-[4px_4px_0_var(--platform-violet)]">
                            <ShieldAlert className="h-7 w-7" aria-hidden="true" />
                        </div>
                        <div className="max-w-xl space-y-2">
                            <h3 className="text-xl font-bold">{t('finishEarly.title')}</h3>
                            <p className="text-[var(--platform-ink-muted)]">
                                {t(
                                    isHybrid
                                        ? 'finishEarly.hybridDescription'
                                        : 'finishEarly.description',
                                )}
                            </p>
                        </div>
                        <Button
                            size="lg"
                            variant="default"
                            className="h-12 rounded-none bg-[var(--platform-violet)] px-8 font-semibold text-[var(--platform-paper)] shadow-none hover:bg-[var(--platform-violet-strong)]"
                            onClick={() => {
                                if (requiresSubmissionSelection) {
                                    setForceOpenSelectedSubmissions(true);
                                } else {
                                    setShowFinishConfirm(true);
                                }
                            }}
                        >
                            {t('finishEarly.button')}
                        </Button>
                    </div>

                    <AlertDialog open={showFinishConfirm} onOpenChange={setShowFinishConfirm}>
                        <AlertDialogContent className={competitionDialogClassName}>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-amber-500" />
                                    {t('finishEarly.confirmTitle')}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t(
                                        isHybrid
                                            ? 'finishEarly.hybridConfirm'
                                            : 'finishEarly.confirmDescription',
                                    )}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel
                                    disabled={isFinishingEarly}
                                    className="min-h-11 rounded-none"
                                >
                                    {tCommon('cancel')}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleFinishCompetitionEarly}
                                    disabled={isFinishingEarly}
                                    className="min-h-11 rounded-none bg-primary hover:bg-primary/90"
                                >
                                    {isFinishingEarly ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : null}
                                    {t('finishEarly.confirmButton')}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </TabsContent>
            )}

            {requiresSubmissionSelection && (
                <AlertDialog
                    open={showAcknowledgeConfirm}
                    onOpenChange={(open) => {
                        setShowAcknowledgeConfirm(open);
                        if (open) setAcknowledgeError(null);
                    }}
                >
                    <AlertDialogContent className={competitionDialogClassName}>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-amber-500" />
                                {t('submissionSelection.confirmTitle')}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {t('submissionSelection.confirmDescription')}
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        <div className="space-y-4 py-4">
                            {acknowledgeError && (
                                <div className="flex items-start gap-2 border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span>{acknowledgeError}</span>
                                </div>
                            )}
                            {competition.validationRequired && (
                                <div className="space-y-2">
                                    <Label htmlFor="acknowledge-password">
                                        {t('submissionSelection.password')}
                                    </Label>
                                    <Input
                                        id="acknowledge-password"
                                        type="password"
                                        value={acknowledgePassword}
                                        onChange={(e) => setAcknowledgePassword(e.target.value)}
                                        placeholder={t('submissionSelection.passwordPlaceholder')}
                                        autoComplete="current-password"
                                        className="min-h-11 rounded-none"
                                    />
                                </div>
                            )}
                        </div>

                        <AlertDialogFooter>
                            <AlertDialogCancel
                                disabled={isAcknowledging}
                                className="min-h-11 rounded-none"
                            >
                                {t('submissionSelection.cancelButton')}
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleAcknowledge}
                                disabled={
                                    isAcknowledging ||
                                    (competition.validationRequired && !acknowledgePassword)
                                }
                                className="min-h-11 rounded-none bg-amber-600 text-white hover:bg-amber-700"
                            >
                                {isAcknowledging ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : null}
                                {t('submissionSelection.confirmButton')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </Tabs>
    );
}

export interface CompetitionDetailsProps {
    competition: CompetitionUserResponse;
    leaderboard: {
        partialLeaderboard: GenericLeaderboardEntry[];
        completeLeaderboard: GenericLeaderboardEntry[] | null;
    };
    /** Whether the user is a pre-joined participant (added by admin) - hides join button */
    isPreJoinedParticipant?: boolean;
    onRequiredFieldsDialogOpenChange?: (open: boolean) => void;
    setupNotice?: ReactNode;
    leaderboardUnavailable?: boolean;
    organizerDataConsent?: CompetitionOrganizerDataConsent | null;
}

export function CompetitionDetails({
    competition,
    leaderboard,
    isPreJoinedParticipant = false,
    onRequiredFieldsDialogOpenChange,
    setupNotice,
    leaderboardUnavailable = false,
    organizerDataConsent = null,
}: CompetitionDetailsProps) {
    const t = useTranslations('competitions.details');
    const tList = useTranslations('competitions.list');
    const tSeries = useTranslations('competitionSeries.childBanner');
    const { trackCompetition } = useGTMTracker();
    const { locale } = useLocale();
    const { addDisqualifiedCompetition } = useDisqualificationNotifications();
    const nowMs = useCompetitionBoundaryTime(competition.startTime, competition.endTime);
    const router = useRouter();

    // Register disqualification status from server response
    useEffect(() => {
        if (competition.disqualified === true) {
            addDisqualifiedCompetition(competition.id);
        }
    }, [competition.id, competition.disqualified, addDisqualifiedCompetition]);

    // Get translated competition content based on current locale
    const competitionContent = getCompetitionContent(
        competition as unknown as TranslatableCompetition,
        locale,
    );

    // Compute competition status
    const getCompetitionStatus = useCallback(() => {
        const now = new Date();
        const start = new Date(competition.startTime);
        const end = new Date(competition.endTime);
        if (now < start) return 'UPCOMING';
        if (now > end) return 'ENDED';
        return 'ACTIVE';
    }, [competition.startTime, competition.endTime]);

    // Track competition view on mount
    useEffect(() => {
        trackCompetition('view', String(competition.id), {
            competitionName: competition.name,
            competitionStatus: getCompetitionStatus(),
        });
    }, [competition.id, competition.name, getCompetitionStatus, trackCompetition]);

    // Handler for join button click
    const handleJoinClick = useCallback(() => {
        trackCompetition('join', String(competition.id), {
            competitionName: competition.name,
            competitionStatus: getCompetitionStatus(),
        });
    }, [competition.id, competition.name, getCompetitionStatus, trackCompetition]);

    // Handler for leave button click
    const handleLeaveClick = useCallback(() => {
        trackCompetition('leave', String(competition.id), {
            competitionName: competition.name,
            competitionStatus: getCompetitionStatus(),
        });
    }, [competition.id, competition.name, getCompetitionStatus, trackCompetition]);

    // Handler for leaderboard view
    const handleLeaderboardView = useCallback(() => {
        trackCompetition('leaderboard_view', String(competition.id), {
            competitionName: competition.name,
            competitionStatus: getCompetitionStatus(),
        });
    }, [competition.id, competition.name, getCompetitionStatus, trackCompetition]);

    // Handler for share click
    const handleShareClick = useCallback(
        (method: string) => {
            trackCompetition('share', String(competition.id), {
                competitionName: competition.name,
                competitionStatus: getCompetitionStatus(),
                shareMethod: method,
            });
        },
        [competition.id, competition.name, getCompetitionStatus, trackCompetition],
    );

    // Handler for editorial view
    const handleEditorialView = useCallback(() => {
        // Track editorial view using the problem tracker since editorial is problem-related
        // We use a generic problem ID since editorial is at competition level
        try {
            if (typeof window !== 'undefined' && window.dataLayer) {
                window.dataLayer.push({
                    event: AnalyticsEvents.EDITORIAL_VIEW,
                    category: 'problem',
                    competitionId: String(competition.id),
                    competitionName: competition.name,
                    timestamp: new Date().toISOString(),
                    pagePath: window.location.pathname,
                });
            }
        } catch (error) {
            console.error('[Analytics] Failed to track editorial view:', error);
        }
    }, [competition.id, competition.name]);

    // Determine if anti-cheat monitoring is needed (competition is ongoing and has anti-cheat enabled)
    const now = new Date(nowMs);
    const start = new Date(competition.startTime);
    const end = new Date(competition.endTime);
    const isOngoing = start < now && now < end;
    const needsAntiCheatMonitoring =
        isOngoing && competition.antiCheatEnabled === true && competition.joined;

    // Show DNS blocking info banner when:
    // - DNS blocking is enabled for the competition
    // - User is joined/participating
    // - Competition is ongoing
    const showDnsBlockingBanner =
        isOngoing && competition.dnsBlockingEnabled === true && competition.joined;

    // Wrap content with anti-cheat provider if needed
    const [forceOpenSelectedSubmissions, setForceOpenSelectedSubmissions] = useState(false);
    const [showFinishConfirm, setShowFinishConfirm] = useState(false);

    const tabsContent = (
        <TabsInner
            competition={competition}
            leaderboard={leaderboard}
            onLeaderboardView={handleLeaderboardView}
            onEditorialView={handleEditorialView}
            setForceOpenSelectedSubmissions={setForceOpenSelectedSubmissions}
            showFinishConfirm={showFinishConfirm}
            setShowFinishConfirm={setShowFinishConfirm}
        />
    );

    return (
        <PlatformPageShell>
            {isOngoing && competition.joined && (
                <CompetitionWaringDisplay
                    endTime={competition.endTime}
                    hybrid={competition.competitionType === 'HYBRID'}
                    storageKey={`dismissed_countdown_${competition.id}`}
                />
            )}
            {competition.parentSeries ? (
                <Link
                    href={`/competition-series/${competition.parentSeries.id}`}
                    className="group mb-6 flex min-h-14 items-center gap-3 border border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] px-4 py-3 text-[var(--platform-ink)] outline-none transition-colors hover:border-[var(--platform-violet)] focus-visible:border-[var(--platform-violet)] sm:px-5"
                >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--platform-violet)] text-[var(--platform-paper)]">
                        <Layers3 className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                            {tSeries(
                                competition.parentSeries.mode === 'DIVISIONS'
                                    ? 'division'
                                    : 'round',
                                { number: (competition.seriesPosition ?? 0) + 1 },
                            )}
                        </span>
                        <span className="mt-0.5 block truncate text-sm font-semibold group-hover:text-[var(--platform-violet)]">
                            {tSeries('backToSeries', { name: competition.parentSeries.name })}
                        </span>
                    </span>
                    <ArrowUpRight
                        className="h-5 w-5 shrink-0 text-[var(--platform-violet)] rtl:-rotate-90"
                        aria-hidden="true"
                    />
                </Link>
            ) : null}
            {setupNotice}
            <div className="space-y-8">
                <div>
                    <header className="platform-page-header">
                        <div className="min-w-0">
                            <p className="platform-page-eyebrow">
                                <Trophy className="h-4 w-4" aria-hidden="true" />
                                <span>{tList('title')}</span>
                            </p>
                            <h1 className="platform-page-title">{competitionContent.name}</h1>
                            <div className="mt-5 flex flex-wrap items-center gap-2">
                                <StatusPillClient
                                    startIso={competition.startTime}
                                    endIso={competition.endTime}
                                />
                                <CompetitionScoringBadge
                                    competitionType={competition.competitionType}
                                    size="md"
                                />
                                <AntiCheatBadge
                                    enabled={competition.antiCheatEnabled === true}
                                    size="md"
                                />
                                <SebRequiredBadge
                                    required={competition.sebRequired === true}
                                    size="md"
                                />
                            </div>
                            <div className="mt-6 max-w-xl border-t border-[var(--platform-line)] pt-4">
                                <CompetitionDateDisplayClient
                                    startTime={competition.startTime}
                                    endTime={competition.endTime}
                                    variant="detailed"
                                />
                            </div>
                        </div>
                        <div className="platform-page-aside lg:justify-end">
                            <HeaderActionsClient
                                competition={competition}
                                onJoinClick={handleJoinClick}
                                onLeaveClick={handleLeaveClick}
                                onShareClick={handleShareClick}
                                onUpdateRequiredFieldsClick={() =>
                                    onRequiredFieldsDialogOpenChange?.(true)
                                }
                                isPreJoinedParticipant={isPreJoinedParticipant}
                            />
                        </div>
                    </header>
                    {leaderboardUnavailable ? (
                        <aside
                            className="mt-6 flex flex-col gap-4 border border-amber-700/35 bg-amber-400/10 p-4 sm:flex-row sm:items-center sm:justify-between"
                            role="status"
                        >
                            <div className="flex items-start gap-3">
                                <AlertCircle
                                    className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
                                    aria-hidden="true"
                                />
                                <div>
                                    <h2 className="font-bold text-[var(--platform-ink)]">
                                        {tList('error')}
                                    </h2>
                                    <p className="mt-1 text-sm text-[var(--platform-ink-muted)]">
                                        {t('refreshFailed')}
                                    </p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.refresh()}
                                className="min-h-11 shrink-0 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)]"
                            >
                                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                                {t('refreshProblems')}
                            </Button>
                        </aside>
                    ) : null}
                    {competition.joined &&
                        competition.appealDeadline &&
                        new Date() > new Date(competition.endTime) &&
                        competition.problems?.some((p) => p.lastAttemptedScore !== null) && (
                            <AppealSection competition={competition} />
                        )}
                </div>

                {organizerDataConsent ? (
                    <OrganizerDataConsentSettings
                        competitionId={competition.id}
                        initialConsent={organizerDataConsent}
                    />
                ) : null}

                {/* DNS Blocking Info Banner - shown when DNS blocking is active */}
                {showDnsBlockingBanner && (
                    <aside className="border border-sky-600/35 bg-sky-400/10 p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-sky-600 text-white dark:bg-sky-400 dark:text-sky-950">
                                <Wifi className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <div className="flex-1">
                                <h2 className="mb-1 font-semibold text-sky-800 dark:text-sky-200">
                                    {t('dnsBlocking.title')}
                                </h2>
                                <p className="mb-3 text-sm leading-6 text-sky-800/80 dark:text-sky-200/80">
                                    {t('dnsBlocking.description')}
                                </p>
                                <div className="border border-sky-600/25 bg-sky-500/10 p-3">
                                    <p className="mb-1 text-sm font-semibold text-sky-900 dark:text-sky-100">
                                        {t('dnsBlocking.recoveryTitle')}
                                    </p>
                                    <p className="text-sm leading-6 text-sky-800 dark:text-sky-200">
                                        {t('dnsBlocking.recoveryDescription')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </aside>
                )}

                <div className="space-y-6">
                    {needsAntiCheatMonitoring ? (
                        <AntiCheatConnectionProvider competitionId={competition.id}>
                            {tabsContent}
                        </AntiCheatConnectionProvider>
                    ) : (
                        tabsContent
                    )}
                </div>
            </div>
            {!hasLiveFinalScores(competition.competitionType) &&
                (competition.competitionType !== 'HYBRID' ||
                    competition.problems.length > 0 ||
                    forceOpenSelectedSubmissions) && (
                    <SelectedSubmissionsModal
                        competitionId={competition.id}
                        competitionStartTime={competition.startTime}
                        competitionEndTime={competition.endTime}
                        forceOpen={forceOpenSelectedSubmissions}
                        onClose={() => {
                            setForceOpenSelectedSubmissions(false);
                        }}
                        onContinue={() => {
                            setForceOpenSelectedSubmissions(false);
                            setShowFinishConfirm(true);
                        }}
                    />
                )}
        </PlatformPageShell>
    );
}
