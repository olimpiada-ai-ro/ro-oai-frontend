'use client';

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
    BarChartIcon,
    DownloadIcon,
    FileTextIcon,
    HistoryIcon,
    TrophyIcon,
    UploadIcon,
    UsersIcon,
    CheckCircle2Icon,
    XCircleIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ArrowLeftIcon,
    FileArchiveIcon,
    Loader2Icon,
    RotateCcwIcon,
} from 'lucide-react';
import type {
    GenericLeaderboardEntry,
    Locale,
    Page,
    Problem,
    SimpleLeaderboardEntry,
    Submission,
} from '@/lib/types';
import { SubmissionStatus } from '@/components/submission-status';
import { SubmissionDetails } from '@/components/submission-details';
import { fetchApi, getSubmissions } from '@/lib/api';
import { LeaderboardView } from '@/components/leaderboard-view';
import { useSession, signIn } from 'next-auth/react';
import { InlineLoadingIndicator } from '@/components/loading';
import { Link } from '@/i18n/routing';
import dynamic from 'next/dynamic';

const SelectedSubmissionsModal = dynamic(
    () =>
        import('@/components/selected-submissions-modal').then((mod) => ({
            default: mod.SelectedSubmissionsModal,
        })),
    { ssr: false },
);
import { Checkbox } from '@/components/ui/checkbox';
import { useTableScroll } from '@/hooks/use-table-scroll';
import { useSubmissionNotifications } from '@/components/submission-notification-provider';
import { CommentsSection } from '@/components/comments-section';
import { CommentsErrorBoundary } from '@/components/comments-error-boundary';
import { useLocale, useTranslations } from 'next-intl';
import { formatShortDate, formatTime } from '@/lib/i18n-formatting';
import { analytics, AnalyticsEvents } from '@/lib/analytics';
import { mapSimpleLeaderboardEntry } from '@/lib/mappers';
import { getProblemContent } from '@/lib/problem-translations';
import { renderLatex } from '@/lib/render-latex';
import { renderCodeBlocks } from '@/lib/render-code-blocks';
import { createLatexClickHandler, createLatexKeyDownHandler } from '@/components/latex-content';
import { createCodeCopyHandler } from '@/components/code-block-copy';
import { useGTMTracker } from '@/hooks/use-gtm-tracker';
import { toast } from 'sonner';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    PlatformEmptyState,
    PlatformPageHeader,
    PlatformPageShell,
} from '@/components/platform-page-shell';
import { platformSans } from '@/lib/platform-fonts';
import { cn } from '@/lib/utils';
import { normalizeAuthoredHtmlAnchorTargets } from '@/lib/normalize-authored-html';
import {
    SOURCE_FILE_ACCEPT,
    SUBMISSION_FILE_ACCEPT,
    formatProblemUploadSize,
    validateProblemUploadFiles,
    type ProblemUploadValidationError,
} from '@/lib/problem-upload';
import { ProblemArticlesSection } from '@/components/articles/problem-articles-section';
import type { ArticleSummary } from '@/lib/articles';
import { ProblemAuthors } from '@/components/problem-authors';
import { getProblemAuthors } from '@/lib/problem-authors';
import { ProblemPreviewImage } from '@/components/problem-preview-image';
import { hasLiveFinalScores } from '@/lib/competition-utils';
import { ProblemColabWorkspaceCard } from '@/components/problem-colab-workspace-card';

const DismissibleAlert = dynamic(
    () =>
        import('@/components/dismissible-alert').then((mod) => ({
            default: mod.DismissibleAlert,
        })),
    { ssr: false },
);

// Client-only countdown (no SSR)
const CompetitionCountdownClient = dynamic(
    () =>
        import('@/components/competition-countdown').then((mod) => ({
            default: mod.CompetitionCountdown,
        })),
    { ssr: false },
);

const SubmissionPillCounter = ({
    submissionsSent,
    submissionsMax,
}: {
    submissionsSent: number;
    submissionsMax: number;
}) => {
    const t = useTranslations('problems');
    const text = t('submitSolutionsRemaining', {
        submissionsRemaining: submissionsMax - submissionsSent,
        submissionsMax,
    });
    if (submissionsSent < submissionsMax * 0.9) {
        return (
            <Badge
                variant="outline"
                className="rounded-none border-emerald-700/30 bg-emerald-500/10 text-xs font-semibold text-emerald-800 dark:text-emerald-200"
                aria-label={text}
            >
                {text}
            </Badge>
        );
    } else if (submissionsSent < submissionsMax) {
        return (
            <Badge
                variant="outline"
                className="rounded-none border-amber-700/30 bg-amber-500/10 text-xs font-semibold text-amber-800 dark:text-amber-200"
                aria-label={text}
            >
                {text}
            </Badge>
        );
    } else {
        return (
            <Badge
                variant="outline"
                className="rounded-none border-red-700/30 bg-red-500/10 text-xs font-semibold text-red-800 dark:text-red-200"
                aria-label={text}
            >
                {text}
            </Badge>
        );
    }
};

const dialogSurfaceClass = cn(
    platformSans.className,
    'rounded-none border-2 border-[oklch(0.62_0.06_287)] bg-[oklch(0.978_0.014_292)] p-0 text-[oklch(0.22_0.055_282)] shadow-[8px_8px_0_oklch(0.43_0.235_291/0.24)] dark:border-[oklch(0.5_0.07_287)] dark:bg-[oklch(0.18_0.038_286)] dark:text-[oklch(0.94_0.016_292)] [&>button]:grid [&>button]:h-11 [&>button]:w-11 [&>button]:place-items-center [&>button]:rounded-none',
);

type ProblemDetailsProps = {
    problem: Problem;
    submissions: Page<Submission> | null;
    submissionsLoadFailed?: boolean;
    relatedArticles?: ArticleSummary[];
    relatedArticleCount?: number;
};

export function ProblemDetails({
    problem,
    submissions,
    submissionsLoadFailed = false,
    relatedArticles = [],
    relatedArticleCount = relatedArticles.length,
}: ProblemDetailsProps) {
    const scrollRef = useTableScroll();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const requestedTab = searchParams.get('tab');
    const initialTab =
        requestedTab === 'leaderboard' ||
        (requestedTab === 'submissions' && (submissions !== null || submissionsLoadFailed)) ||
        requestedTab === 'description'
            ? requestedTab
            : 'description';
    const [file, setFile] = useState<File | null>(null);
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [showSubmissionStatus, setShowSubmissionStatus] = useState(false);
    const [showSubmissionDetails, setShowSubmissionDetails] = useState(false);
    const [currentSubmissionId, setCurrentSubmissionId] = useState<number | null>(null);
    const [submittedSubmission, setSubmittedSubmission] = useState<Submission | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [fileValidationError, setFileValidationError] = useState<string | null>(null);
    // Local list so we can append newly created submissions without a full page reload
    const [submissionPage, setSubmissionPage] = useState<Page<Submission> | null>(submissions);
    const [submissionsLoading, setSubmissionsLoading] = useState(false);
    const [submissionsError, setSubmissionsError] = useState<string | null>(
        submissionsLoadFailed ? 'initial-load-failed' : null,
    );
    const [failedSubmissionPage, setFailedSubmissionPage] = useState(0);
    // Leaderboard state for this problem
    const [leaderboard, setLeaderboard] = useState<GenericLeaderboardEntry[] | null>(null);
    const [leaderboardLoading, setLeaderboardLoading] = useState<boolean>(false);
    const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isSourceDragging, setIsSourceDragging] = useState(false);
    const [activeTab, setActiveTab] = useState(initialTab);
    // Competition selection state
    const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<number[]>(
        problem.selectedSubmissionIds,
    );
    const [savingSelection, setSavingSelection] = useState<boolean>(false);
    const [savedSelection, setSavedSelection] = useState<boolean>(true);
    const [showSelectionError, setShowSelectionError] = useState<boolean>(false);
    const [dismissedSubmissionCount, setDismissedSubmissionCount] = useState<number | null>(null);

    const { status } = useSession();
    const { notifications } = useSubmissionNotifications();
    const locale = useLocale() as Locale;
    const { trackProblem } = useGTMTracker();

    const t = useTranslations('problems');
    const tCommon = useTranslations('common');
    const tError = useTranslations('errorBoundary');
    const tDifficulty = useTranslations('difficulty');
    const tSubmissionStatus = useTranslations('submissionStatus');
    const tMyQuestions = useTranslations('myQuestions');
    const canViewSubmissions =
        submissionPage !== null || submissionsLoadFailed || status === 'authenticated';

    // Get translated problem content based on current locale
    const problemContent = getProblemContent(problem, locale);
    const problemAuthors = getProblemAuthors(problem);
    const renderedDescription = useMemo(() => {
        const withCode = renderCodeBlocks(problemContent.longDescription, {
            copy: tCommon('copyCode'),
            copied: tCommon('codeCopied'),
        });
        const withLatex = renderLatex(withCode, tCommon('clickToCopyFormula'));

        // The page header owns the single h1. Problem-authored HTML starts at h2.
        const normalizedHeadings = withLatex
            .replace(/<h1(?=\s|>)/gi, '<h2')
            .replace(/<\/h1\s*>/gi, '</h2>');

        return normalizeAuthoredHtmlAnchorTargets(normalizedHeadings);
    }, [problemContent.longDescription, tCommon]);
    const onLatexClick = useMemo(() => createLatexClickHandler(tCommon('latexCopied')), [tCommon]);
    const onLatexKeyDown = useMemo(
        () => createLatexKeyDownHandler(tCommon('latexCopied')),
        [tCommon],
    );
    const onCodeCopy = useMemo(() => createCodeCopyHandler(tCommon('codeCopied')), [tCommon]);
    const onContentClick = useMemo(
        () => (e: React.MouseEvent) => {
            onCodeCopy(e);
            onLatexClick(e);
        },
        [onCodeCopy, onLatexClick],
    );

    const selectionLimit = problem.selectionLimit ?? 0;
    const requiresSubmissionSelection = !hasLiveFinalScores(problem.competitionType);
    const hasReachedLimit =
        requiresSubmissionSelection &&
        problem.isInOngoingCompetition &&
        selectedSubmissionIds.length >= selectionLimit;
    const now = new Date();
    const end = problem.competitionEndTime ? new Date(problem.competitionEndTime) : null;
    const hasEnded = end ? now > end : false;

    const handleTabChange = (nextTab: string) => {
        if (!['description', 'leaderboard', 'submissions'].includes(nextTab)) return;

        setActiveTab(nextTab);
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.set('tab', nextTab);
        router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
    };

    useEffect(() => {
        const requestedNextTab = searchParams.get('tab');
        const nextTab =
            requestedNextTab === 'leaderboard' ||
            (requestedNextTab === 'submissions' && canViewSubmissions)
                ? requestedNextTab
                : 'description';

        setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
    }, [canViewSubmissions, searchParams]);

    const toggleSubmissionSelection = (id: number) => {
        setSelectedSubmissionIds((prev) => {
            if (prev.includes(id)) {
                return prev.filter((x) => x !== id);
            }
            return [...prev, id];
        });
        setSavedSelection(false);
    };

    const saveLeaderboardSelection = async () => {
        setSavingSelection(true);
        try {
            const response = await fetchApi(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/problems/${encodeURIComponent(
                    problem.id,
                )}/leaderboard-selection`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ submissionIds: selectedSubmissionIds }),
                },
            );

            if (!response.ok) {
                throw new Error(`Failed with status ${response.status}`);
            }
            toast.success(t('savedSelection'));
            setSavedSelection(true);
        } catch (err) {
            console.error('Failed to save leaderboard selection', err);
            setShowSelectionError(true);
        } finally {
            setSavingSelection(false);
        }
    };

    // Track problem view using GTM tracker
    useEffect(() => {
        try {
            // Track via GTM tracker with full context
            trackProblem('view', String(problem.id), {
                problemTitle: problem.title,
                problemDifficulty: problem.difficulty,
                competitionId: problem.competitionId ? String(problem.competitionId) : undefined,
            });

            // Also track via legacy analytics for backward compatibility
            analytics.trackEvent({
                name: AnalyticsEvents.PROBLEM_VIEW,
                properties: {
                    problemId: problem.id,
                    problemTitle: problem.title,
                    difficulty: problem.difficulty,
                    timestamp: new Date().toISOString(),
                },
            });
        } catch (error) {
            console.error('[Analytics] Failed to track problem view:', error);
        }
    }, [problem.id, problem.title, problem.difficulty, problem.competitionId, trackProblem]);

    // Update local submission list when notifications indicate status has finalized
    // Replace any matching submissions for this problem that are no longer in processing
    useEffect(() => {
        if (!submissionPage || !notifications || notifications.length === 0) return;

        // Build a lookup of finalized notifications for the current problem
        const finalizedUpdates = new Map<number, Submission>();
        for (const n of notifications) {
            if (n.problemId !== problem.id) continue;
            if (n.status === 'PROCESSING') continue; // only care about final states

            finalizedUpdates.set(n.id, {
                ...n,
                // Normalize submittedAt to Date
                submittedAt:
                    n.submittedAt instanceof Date ? n.submittedAt : new Date(n.submittedAt as any),
            });
        }

        if (finalizedUpdates.size === 0) return;

        let changed = false;
        const updated = submissionPage.content.map((s) => {
            const upd = finalizedUpdates.get(s.id);
            if (!upd) return s;
            if (
                s.status === 'PROCESSING' &&
                (upd.status === 'EVALUATED' || upd.status === 'ERROR')
            ) {
                changed = true;
                return upd;
            }
            return s;
        });

        if (changed) {
            setSubmissionPage({
                ...submissionPage,
                content: updated,
            });
        }
    }, [notifications, problem.id, setSubmissionPage]);

    const getFileValidationMessage = (error: ProblemUploadValidationError) => {
        if (error.code === 'empty') {
            return `${tSubmissionStatus('uploadError')} (${error.fileName}: 0 B)`;
        }

        if (error.code === 'too-large') {
            return `${tSubmissionStatus('uploadError')} ${error.fileName}: ${t('uploadSizeLimit')}`;
        }

        return `${tSubmissionStatus('uploadError')} ${error.fileName}: ${t('fileTypes')}; ${t('sourceFileTypes')}`;
    };

    const selectSubmissionFile = (candidate: File) => {
        const validationError = validateProblemUploadFiles(candidate, sourceFile);
        if (validationError) {
            setFileValidationError(getFileValidationMessage(validationError));
            return false;
        }

        setFile(candidate);
        setFileValidationError(null);

        // Selecting a valid artifact is the first strong signal that work has started.
        try {
            trackProblem('start', String(problem.id), {
                problemTitle: problem.title,
                problemDifficulty: problem.difficulty,
                competitionId: problem.competitionId ? String(problem.competitionId) : undefined,
            });
        } catch (error) {
            console.error('[Analytics] Failed to track problem start:', error);
        }

        return true;
    };

    const selectSourceFile = (candidate: File) => {
        const validationError = validateProblemUploadFiles(file, candidate);
        if (validationError) {
            setFileValidationError(getFileValidationMessage(validationError));
            return false;
        }

        setSourceFile(candidate);
        setFileValidationError(null);
        return true;
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const candidate = event.currentTarget.files?.[0];
        if (candidate && !selectSubmissionFile(candidate)) event.currentTarget.value = '';
    };

    const handleSourceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const candidate = event.currentTarget.files?.[0];
        if (candidate && !selectSourceFile(candidate)) event.currentTarget.value = '';
    };

    const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsDragging(false);
        const candidate = event.dataTransfer.files?.[0];
        if (candidate) selectSubmissionFile(candidate);
    };

    const handleSourceDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsSourceDragging(true);
    };

    const handleSourceDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsSourceDragging(false);
    };

    const handleSourceDrop = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsSourceDragging(false);
        const candidate = event.dataTransfer.files?.[0];
        if (candidate) selectSourceFile(candidate);
    };

    const handleUpload = async () => {
        if (!file || (problem.isInOngoingCompetition && !sourceFile)) return;

        const validationError = validateProblemUploadFiles(file, sourceFile);
        if (validationError) {
            setFileValidationError(getFileValidationMessage(validationError));
            return;
        }

        try {
            setUploading(true);
            setUploadError(null);
            setFileValidationError(null);
            setSubmittedSubmission(null);

            // Track solution submit event using GTM tracker
            try {
                trackProblem('submit', String(problem.id), {
                    problemTitle: problem.title,
                    problemDifficulty: problem.difficulty,
                    competitionId: problem.competitionId
                        ? String(problem.competitionId)
                        : undefined,
                    hasSourceFile: !!sourceFile,
                });

                // Also track via legacy analytics for backward compatibility
                analytics.trackEvent({
                    name: AnalyticsEvents.SOLUTION_SUBMIT,
                    properties: {
                        problemId: problem.id,
                        problemTitle: problem.title,
                        difficulty: problem.difficulty,
                        hasSourceFile: !!sourceFile,
                        timestamp: new Date().toISOString(),
                    },
                });

                // Track competition submission if this is during an ongoing competition
                if (problem.isInOngoingCompetition && problem.competitionId) {
                    analytics.trackEvent({
                        name: AnalyticsEvents.COMPETITION_SUBMISSION,
                        properties: {
                            competitionId: String(problem.competitionId),
                            competitionName: problem.competitionName,
                            problemId: problem.id,
                            problemTitle: problem.title,
                            timestamp: new Date().toISOString(),
                        },
                    });
                }
            } catch (error) {
                console.error('[Analytics] Failed to track solution submit:', error);
            }

            // Build multipart/form-data
            const formData = new FormData();
            formData.append('file', file, file.name);
            if (sourceFile) {
                // Attach source code file under a separate field
                formData.append('source', sourceFile, sourceFile.name);
            } else if (problem.isInOngoingCompetition) {
                setUploadError(t('sourceFileRequired'));
                setShowSubmissionStatus(true);
                setUploading(false);
                return;
            }

            // Construct URL using problem id
            const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/problems/${encodeURIComponent(problem.id)}/submissions`;

            const resp = await fetchApi(url, {
                method: 'POST',
                body: formData,
            });

            if (!resp.ok) {
                setCurrentSubmissionId(null);
                const errorData = await resp.json().catch(() => null);

                // Handle SEB-specific errors with translated messages
                if (errorData?.error === 'SEB_REQUIRED') {
                    setUploadError(tSubmissionStatus('sebRequired'));
                } else if (errorData?.error === 'SEB_VERIFICATION_FAILED') {
                    setUploadError(tSubmissionStatus('sebVerificationFailed'));
                } else if (errorData?.publicErrorMessage) {
                    setUploadError(errorData.publicErrorMessage);
                } else {
                    setUploadError(tSubmissionStatus('uploadError'));
                }

                setShowSubmissionStatus(true);
                return;
            }

            // Build a new submission object with safe fallbacks
            const response = (await resp.json()) as Submission;
            const newSubmission: Submission = {
                ...response,
                submittedAt: new Date(response.submittedAt),
            };

            // The upload response is authoritative. Show success immediately even if the
            // best-effort history refresh is delayed or unavailable.
            setSubmittedSubmission(newSubmission);
            setCurrentSubmissionId(newSubmission.id);
            setShowSubmissionStatus(true);
            void loadSubmissions(submissionPage?.page.number || 0);

            // Clear file selections and reset inputs
            setFile(null);
            setSourceFile(null);
            const fileInput = document.getElementById('dropzone-file') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
            const srcInput = document.getElementById('source-file') as HTMLInputElement;
            if (srcInput) srcInput.value = '';
        } catch (e: any) {
            console.error('Upload error:', e);
            setCurrentSubmissionId(null);
            setUploadError(tSubmissionStatus('uploadError'));
            setShowSubmissionStatus(true);
        } finally {
            setUploading(false);
        }
    };

    const handleViewSubmissionDetails = (submissionId: number) => {
        setCurrentSubmissionId(submissionId);
        setShowSubmissionDetails(true);
    };

    const handleCloseSubmissionStatus = () => {
        setShowSubmissionStatus(false);
        setCurrentSubmissionId(null);
        setUploadError(null);
    };

    const handleCloseSubmissionDetails = () => {
        setShowSubmissionDetails(false);
        setCurrentSubmissionId(null);
    };

    const getDifficultyBadge = (difficulty: string) => {
        switch (difficulty.toLowerCase()) {
            case 'easy':
                return 'border-emerald-700/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200';
            case 'medium':
                return 'border-amber-700/35 bg-amber-500/10 text-amber-800 dark:text-amber-200';
            case 'hard':
                return 'border-red-700/35 bg-red-500/10 text-red-800 dark:text-red-200';
            default:
                return 'border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] text-[var(--platform-ink)]';
        }
    };

    const loadLeaderboard = useCallback(async () => {
        try {
            setLeaderboardLoading(true);
            setLeaderboardError(null);
            const base = process.env.NEXT_PUBLIC_API_BASE_URL;
            if (!base) throw new Error('Missing API base URL');

            const response = await fetchApi(
                `${base}/problems/${encodeURIComponent(problem.id)}/leaderboard`,
            );
            if (!response.ok) {
                throw new Error(`Problem leaderboard request failed with ${response.status}`);
            }

            const data = (await response.json()) as Array<SimpleLeaderboardEntry>;
            setLeaderboard(data.map(mapSimpleLeaderboardEntry));
        } catch (e) {
            console.error('Failed to load problem leaderboard', e);
            setLeaderboard(null);
            setLeaderboardError(t('errorLoadingProblem'));
        } finally {
            setLeaderboardLoading(false);
        }
    }, [problem.id, t]);

    // The leaderboard is optional and can be large, so fetch it only when requested.
    useEffect(() => {
        if (
            activeTab === 'leaderboard' &&
            leaderboard === null &&
            !leaderboardLoading &&
            !leaderboardError
        ) {
            void loadLeaderboard();
        }
    }, [activeTab, leaderboard, leaderboardError, leaderboardLoading, loadLeaderboard]);

    const loadSubmissions = useCallback(
        async (page: number) => {
            try {
                setSubmissionsLoading(true);
                setSubmissionsError(null);
                setFailedSubmissionPage(page);
                const data = await getSubmissions(problem.id, page);
                setSubmissionPage(data);
            } catch (e) {
                console.error('Failed to load submissions:', e);
                setSubmissionsError(t('errorLoadingProblem'));
            } finally {
                setSubmissionsLoading(false);
            }
        },
        [problem.id, t],
    );

    useEffect(() => {
        if (
            activeTab === 'submissions' &&
            status === 'authenticated' &&
            submissionPage === null &&
            !submissionsLoading &&
            !submissionsError
        ) {
            void loadSubmissions(0);
        }
    }, [activeTab, loadSubmissions, status, submissionPage, submissionsError, submissionsLoading]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 0 && newPage < (submissionPage?.page.totalPages || 0)) {
            void loadSubmissions(newPage);
        }
    };

    const currentSubmission =
        submittedSubmission?.id === currentSubmissionId
            ? submittedSubmission
            : submissionPage?.content?.find((submission) => submission.id === currentSubmissionId);

    return (
        <>
            <PlatformPageShell contentClassName="!pt-6 sm:!pt-8">
                <div className="space-y-7">
                    <nav aria-label={t('title')}>
                        <Link
                            href="/problems"
                            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--platform-violet)] underline-offset-4 hover:underline"
                        >
                            <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                            {t('viewAll')}
                        </Link>
                    </nav>
                    {!!problem.competitionId && (
                        <div className="flex flex-col gap-3 border-y border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <Link
                                href={`/competitions/${problem.competitionId}?tab=problems`}
                                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--platform-violet)] underline-offset-4 hover:underline"
                                aria-label={t('backToCompetition', {
                                    competitionName: problem.competitionName as string,
                                })}
                            >
                                <ArrowLeftIcon
                                    className="h-4 w-4 rtl:rotate-180"
                                    aria-hidden="true"
                                />
                                <span>
                                    {t('backToCompetition', {
                                        competitionName: problem.competitionName as string,
                                    })}
                                </span>
                            </Link>
                            <div className="flex flex-wrap items-center gap-2">
                                {hasEnded && (
                                    <>
                                        <Badge
                                            variant="outline"
                                            className="rounded-none border-red-700/35 bg-red-500/10 text-xs font-semibold text-red-800 dark:text-red-200"
                                            aria-label={t('competitionEnded')}
                                        >
                                            {t('competitionEnded')}
                                        </Badge>
                                        <Badge
                                            variant="outline"
                                            className="rounded-none border-[var(--platform-violet)]/35 bg-[var(--platform-violet)]/10 text-xs font-semibold text-[var(--platform-violet)]"
                                            aria-label={t('archiveProblem')}
                                        >
                                            {t('archiveProblem')}
                                        </Badge>
                                    </>
                                )}
                                {!!problem.competitionName && (
                                    <Badge
                                        variant="outline"
                                        className="rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] text-xs font-semibold text-[var(--platform-ink)]"
                                        aria-label={t('competition', {
                                            competitionName: problem.competitionName,
                                        })}
                                    >
                                        {t('competition', {
                                            competitionName: problem.competitionName,
                                        })}
                                    </Badge>
                                )}
                                {problem.isInOngoingCompetition && (
                                    <CompetitionCountdownClient
                                        endTime={problem.competitionEndTime as string}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                    <PlatformPageHeader
                        eyebrow={`${t('problem')} #${problem.id}`}
                        icon={FileTextIcon}
                        title={<span dir="auto">{problemContent.title}</span>}
                        description={
                            <ProblemAuthors
                                problem={problem}
                                label={problemAuthors.length > 1 ? t('authors') : t('author')}
                            />
                        }
                        aside={
                            <div className="grid grid-cols-2 border border-[var(--platform-line-strong)] bg-[var(--platform-paper)] shadow-[5px_5px_0_var(--platform-line)]">
                                <div className="min-w-32 border-e border-[var(--platform-line)] p-3">
                                    <p className="mb-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--platform-ink-muted)]">
                                        {t('difficulty')}
                                    </p>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            'rounded-none px-2.5 py-1 text-xs font-bold',
                                            getDifficultyBadge(problem.difficulty),
                                        )}
                                    >
                                        {tDifficulty(problem.difficulty.toLowerCase())}
                                    </Badge>
                                </div>
                                <div className="min-w-32 p-3">
                                    <p className="mb-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--platform-ink-muted)]">
                                        {t('yourBest')}
                                    </p>
                                    <p className="flex items-center gap-2 font-mono text-xl font-bold tabular-nums text-[var(--platform-violet)]">
                                        <TrophyIcon
                                            className="h-4 w-4 text-[var(--platform-coral)]"
                                            aria-hidden="true"
                                        />
                                        {problem.lastAttemptedScore !== null &&
                                        problem.lastAttemptedScore !== undefined
                                            ? `${problem.lastAttemptedScore}%`
                                            : tCommon('na')}
                                    </p>
                                </div>
                            </div>
                        }
                    />

                    <ProblemPreviewImage
                        problemId={problem.id}
                        title={problemContent.title}
                        difficulty={problem.difficulty}
                        previewImage={problem.previewImage}
                        priority
                        className="mx-auto my-6 max-w-5xl border border-[var(--platform-line-strong)] shadow-[6px_6px_0_var(--platform-line)] sm:my-8"
                    />

                    <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_23rem]">
                        <div className="min-w-0">
                            <Tabs
                                defaultValue="description"
                                value={activeTab}
                                onValueChange={handleTabChange}
                            >
                                <TabsList className="grid h-auto min-h-12 w-full grid-cols-3 rounded-none border border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] p-1 text-xs sm:text-sm">
                                    <TabsTrigger
                                        value="description"
                                        aria-label={t('description')}
                                        className="min-h-11 gap-1.5 rounded-none text-[var(--platform-ink-muted-strong)] transition-colors data-[state=active]:bg-[var(--platform-violet)] data-[state=active]:text-white data-[state=active]:shadow-none dark:data-[state=active]:text-[var(--platform-on-accent)]"
                                    >
                                        <FileTextIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                                        <span className="hidden sm:inline font-medium">
                                            {t('description')}
                                        </span>
                                        <span className="sm:hidden font-medium">{t('info')}</span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="leaderboard"
                                        aria-label={t('leaderboardTab')}
                                        className="min-h-11 gap-1.5 rounded-none text-[var(--platform-ink-muted-strong)] transition-colors data-[state=active]:bg-[var(--platform-violet)] data-[state=active]:text-white data-[state=active]:shadow-none dark:data-[state=active]:text-[var(--platform-on-accent)]"
                                    >
                                        <BarChartIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                                        <span className="hidden sm:inline font-medium">
                                            {t('leaderboardTab')}
                                        </span>
                                        <span className="sm:hidden font-medium">{t('top')}</span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="submissions"
                                        aria-label={t('mySubmissions')}
                                        className="min-h-11 gap-1.5 rounded-none text-[var(--platform-ink-muted-strong)] transition-colors data-[state=active]:bg-[var(--platform-violet)] data-[state=active]:text-white data-[state=active]:shadow-none dark:data-[state=active]:text-[var(--platform-on-accent)]"
                                        disabled={!canViewSubmissions}
                                    >
                                        <HistoryIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                                        <span className="hidden sm:inline font-medium">
                                            {t('mySubmissions')}
                                        </span>
                                        <span className="sm:hidden font-medium">
                                            {t('mySubmissions')}
                                        </span>
                                    </TabsTrigger>
                                </TabsList>
                                {(() => {
                                    const submissionCount = submissionPage?.page.totalElements ?? 0;
                                    const maxSubmissions =
                                        problem.maxSubmissionsPerCompetition ?? 0;
                                    const shouldShowAlert =
                                        problem.isInOngoingCompetition &&
                                        submissionCount > 0 &&
                                        dismissedSubmissionCount !== submissionCount &&
                                        (submissionCount === 1 ||
                                            submissionCount % 3 === 0 ||
                                            submissionCount === maxSubmissions);

                                    if (!shouldShowAlert) return null;

                                    return (
                                        <DismissibleAlert
                                            message={t('competitionSubmissionAlert')}
                                            storageKey={`dismissed_alert_${problem.id}`}
                                            storageValue={submissionCount.toString()}
                                            onDismiss={() =>
                                                setDismissedSubmissionCount(submissionCount)
                                            }
                                            onLoad={(saved) => {
                                                setDismissedSubmissionCount(
                                                    Number.parseInt(saved, 10),
                                                );
                                            }}
                                            className="mt-5"
                                        />
                                    );
                                })()}

                                <>
                                    <TabsContent
                                        value="description"
                                        className="mt-5 focus-visible:outline-none"
                                    >
                                        {activeTab === 'description' && (
                                            <div>
                                                <Card className="rounded-none border border-[var(--platform-line-strong)] bg-[var(--platform-paper)] shadow-[6px_6px_0_var(--platform-line)]">
                                                    <CardHeader className="border-b border-[var(--platform-line)] bg-[var(--platform-paper-strong)] px-5 py-4 sm:px-7">
                                                        <CardTitle className="text-xl sm:text-2xl font-bold">
                                                            {t('problemDescription')}
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent
                                                        className="themed-html max-w-none px-5 py-6 text-sm leading-relaxed text-[var(--platform-ink)] sm:px-7 sm:py-8 sm:text-base [&_p]:max-w-[72ch]"
                                                        dangerouslySetInnerHTML={{
                                                            __html: renderedDescription,
                                                        }}
                                                        onClick={onContentClick}
                                                        onKeyDown={onLatexKeyDown}
                                                    />
                                                </Card>
                                                <ProblemArticlesSection
                                                    articles={relatedArticles}
                                                    totalCount={relatedArticleCount}
                                                    problemId={problem.id}
                                                />
                                            </div>
                                        )}
                                    </TabsContent>
                                    <TabsContent
                                        value="leaderboard"
                                        className="mt-5 focus-visible:outline-none"
                                    >
                                        {activeTab === 'leaderboard' && (
                                            <div>
                                                <Card className="rounded-none border border-[var(--platform-line-strong)] bg-[var(--platform-paper)] shadow-[6px_6px_0_var(--platform-line)]">
                                                    <CardHeader className="border-b border-[var(--platform-line)] bg-[var(--platform-paper-strong)] px-5 py-4 sm:px-7">
                                                        <CardTitle className="text-xl sm:text-2xl font-bold">
                                                            {t('leaderboardTitle')}
                                                        </CardTitle>
                                                        <CardDescription className="text-sm leading-6 text-[var(--platform-ink-muted)]">
                                                            {t('leaderboardDesc')}
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="px-4 py-5 sm:px-6">
                                                        {leaderboardLoading && (
                                                            <div className="text-center py-8">
                                                                <InlineLoadingIndicator
                                                                    message={t(
                                                                        'loadingLeaderboard',
                                                                    )}
                                                                    size="lg"
                                                                    className="justify-center"
                                                                />
                                                            </div>
                                                        )}
                                                        {!leaderboardLoading &&
                                                            leaderboardError && (
                                                                <div
                                                                    className="flex flex-col items-center gap-4 border-y border-red-700/30 bg-red-500/10 px-4 py-8 text-center text-sm text-red-800 dark:text-red-200"
                                                                    role="alert"
                                                                >
                                                                    <p>{leaderboardError}</p>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        onClick={() =>
                                                                            void loadLeaderboard()
                                                                        }
                                                                        className="min-h-11 rounded-none border-red-700/40 bg-[var(--platform-paper)] px-4 text-[var(--platform-ink)] hover:bg-red-500/10"
                                                                    >
                                                                        <RotateCcwIcon
                                                                            className="me-2 h-4 w-4"
                                                                            aria-hidden="true"
                                                                        />
                                                                        {tCommon('retry')}
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        {!leaderboardLoading &&
                                                            !leaderboardError &&
                                                            leaderboard &&
                                                            leaderboard.length === 0 && (
                                                                <PlatformEmptyState
                                                                    icon={UsersIcon}
                                                                    title={t('noSubmissionsYet')}
                                                                />
                                                            )}
                                                        {!leaderboardLoading &&
                                                            !leaderboardError &&
                                                            leaderboard &&
                                                            leaderboard.length > 0 && (
                                                                <LeaderboardView
                                                                    leaderboard={leaderboard}
                                                                    simple
                                                                    identitySurface={
                                                                        problem.competitionType ===
                                                                            'CLASSIC' ||
                                                                        problem.competitionType ===
                                                                            'HYBRID'
                                                                            ? 'RESTRICTED_COMPETITION_LEADERBOARD'
                                                                            : problem.competitionType ===
                                                                                'CASUAL'
                                                                              ? 'CASUAL_COMPETITION_LEADERBOARD'
                                                                              : 'PROBLEM_LEADERBOARD'
                                                                    }
                                                                    showMetric={
                                                                        problem.metricPreference !==
                                                                        'FASTER_SUBMISSION_IS_BETTER'
                                                                    }
                                                                    showAttainedAt={
                                                                        problem.metricPreference ===
                                                                        'FASTER_SUBMISSION_IS_BETTER'
                                                                    }
                                                                />
                                                            )}
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        )}
                                    </TabsContent>
                                    <TabsContent
                                        value="submissions"
                                        className="mt-5 focus-visible:outline-none"
                                    >
                                        {activeTab === 'submissions' && (
                                            <div>
                                                <Card className="rounded-none border border-[var(--platform-line-strong)] bg-[var(--platform-paper)] shadow-[6px_6px_0_var(--platform-line)]">
                                                    <CardHeader className="border-b border-[var(--platform-line)] bg-[var(--platform-paper-strong)] px-5 py-4 sm:px-7">
                                                        <CardTitle className="text-xl sm:text-2xl font-bold">
                                                            {t('mySubmissionsTitle')}
                                                        </CardTitle>
                                                        <CardDescription className="text-sm leading-6 text-[var(--platform-ink-muted)]">
                                                            {t('mySubmissionsDesc')}
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="px-0 pb-5 pt-0">
                                                        {problem.isInOngoingCompetition &&
                                                            requiresSubmissionSelection && (
                                                                <>
                                                                    <div className="flex flex-col gap-3 border-b border-[var(--platform-line)] bg-[color-mix(in_oklch,var(--platform-citron)_16%,var(--platform-paper))] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                                                                        <div className="text-sm leading-6 text-[var(--platform-ink-muted-strong)]">
                                                                            {t('selectionDetails', {
                                                                                selectionLimit,
                                                                                selectedSubmissions:
                                                                                    selectedSubmissionIds.length,
                                                                            })}
                                                                        </div>
                                                                        <Button
                                                                            variant="default"
                                                                            size="sm"
                                                                            onClick={
                                                                                saveLeaderboardSelection
                                                                            }
                                                                            disabled={
                                                                                savingSelection ||
                                                                                selectedSubmissionIds.length ===
                                                                                    0
                                                                            }
                                                                            className="min-h-11 rounded-none bg-[var(--platform-violet)] px-4 text-white hover:bg-[var(--platform-violet-strong)] dark:text-[var(--platform-on-accent)]"
                                                                        >
                                                                            {savingSelection
                                                                                ? t(
                                                                                      'savingSelection',
                                                                                  )
                                                                                : savedSelection
                                                                                  ? t(
                                                                                        'savedSelection',
                                                                                    )
                                                                                  : t(
                                                                                        'saveSelection',
                                                                                    )}
                                                                        </Button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        {submissionsError && (
                                                            <div
                                                                className="flex flex-col items-start justify-between gap-3 border-b border-red-700/30 bg-red-500/10 px-5 py-4 text-sm text-red-800 sm:flex-row sm:items-center sm:px-7 dark:text-red-200"
                                                                role="alert"
                                                            >
                                                                <p>{t('errorLoadingProblem')}</p>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        void loadSubmissions(
                                                                            failedSubmissionPage,
                                                                        )
                                                                    }
                                                                    disabled={submissionsLoading}
                                                                    className="min-h-11 shrink-0 rounded-none border-red-700/40 bg-[var(--platform-paper)] px-4 text-[var(--platform-ink)] hover:bg-red-500/10"
                                                                >
                                                                    <RotateCcwIcon
                                                                        className="me-2 h-4 w-4"
                                                                        aria-hidden="true"
                                                                    />
                                                                    {tCommon('retry')}
                                                                </Button>
                                                            </div>
                                                        )}
                                                        {submissionPage && (
                                                            <div
                                                                ref={scrollRef}
                                                                className="table-scroll-container scrollbar-thin overflow-x-auto"
                                                            >
                                                                <Table className="min-w-[760px]">
                                                                    <TableHeader>
                                                                        <TableRow className="border-b border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] hover:bg-[var(--platform-paper-strong)]">
                                                                            {requiresSubmissionSelection &&
                                                                                (problem.isInOngoingCompetition ||
                                                                                    selectedSubmissionIds.length >
                                                                                        0) && (
                                                                                    <TableHead className="w-[52px]">
                                                                                        <span className="sr-only">
                                                                                            {t(
                                                                                                'saveSelection',
                                                                                            )}
                                                                                        </span>
                                                                                    </TableHead>
                                                                                )}
                                                                            <TableHead className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                                                                                {t('submissionId')}
                                                                            </TableHead>
                                                                            <TableHead className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                                                                                {t('submitted')}
                                                                            </TableHead>
                                                                            <TableHead className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                                                                                {t('score')}
                                                                            </TableHead>
                                                                            <TableHead className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                                                                                {t('finalScore')}
                                                                            </TableHead>
                                                                            <TableHead className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                                                                                {t('status')}
                                                                            </TableHead>
                                                                            <TableHead className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                                                                                {t('actions')}
                                                                            </TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {submissionPage &&
                                                                            submissionPage.content.map(
                                                                                (sub) => (
                                                                                    <TableRow
                                                                                        key={sub.id}
                                                                                        className="group border-b border-[var(--platform-line)] transition-colors hover:bg-[var(--platform-paper-strong)]"
                                                                                    >
                                                                                        {requiresSubmissionSelection &&
                                                                                            (problem.isInOngoingCompetition ||
                                                                                                selectedSubmissionIds.length >
                                                                                                    0) && (
                                                                                                <TableCell className="align-middle">
                                                                                                    <Checkbox
                                                                                                        checked={selectedSubmissionIds.includes(
                                                                                                            sub.id,
                                                                                                        )}
                                                                                                        onCheckedChange={() =>
                                                                                                            toggleSubmissionSelection(
                                                                                                                sub.id,
                                                                                                            )
                                                                                                        }
                                                                                                        disabled={
                                                                                                            savingSelection ||
                                                                                                            (!selectedSubmissionIds.includes(
                                                                                                                sub.id,
                                                                                                            ) &&
                                                                                                                hasReachedLimit) ||
                                                                                                            !problem.isInOngoingCompetition
                                                                                                        }
                                                                                                        aria-label={
                                                                                                            t(
                                                                                                                'saveSelection',
                                                                                                            ) +
                                                                                                            ' #' +
                                                                                                            sub.id
                                                                                                        }
                                                                                                    />
                                                                                                </TableCell>
                                                                                            )}
                                                                                        <TableCell className="font-mono text-xs sm:text-sm">
                                                                                            <span className="inline-block border border-[var(--platform-line)] bg-[var(--platform-paper-strong)] px-2 py-1 tabular-nums transition-colors group-hover:bg-[var(--platform-paper)]">
                                                                                                {
                                                                                                    sub.id
                                                                                                }
                                                                                            </span>
                                                                                        </TableCell>
                                                                                        <TableCell className="text-xs sm:text-sm">
                                                                                            <div className="flex flex-col">
                                                                                                <span className="font-medium">
                                                                                                    {formatShortDate(
                                                                                                        sub.submittedAt,
                                                                                                        locale,
                                                                                                    )}
                                                                                                </span>
                                                                                                <span className="text-xs text-[var(--platform-ink-muted)]">
                                                                                                    {formatTime(
                                                                                                        sub.submittedAt,
                                                                                                        locale,
                                                                                                    )}
                                                                                                </span>
                                                                                            </div>
                                                                                        </TableCell>
                                                                                        <TableCell className="font-bold text-sm sm:text-base">
                                                                                            {sub.score !==
                                                                                                null &&
                                                                                            sub.score !==
                                                                                                undefined ? (
                                                                                                <span
                                                                                                    className={`${
                                                                                                        sub.score >=
                                                                                                        90
                                                                                                            ? 'text-emerald-700 dark:text-emerald-300'
                                                                                                            : sub.score >=
                                                                                                                70
                                                                                                              ? 'text-amber-700 dark:text-amber-300'
                                                                                                              : 'text-red-700 dark:text-red-300'
                                                                                                    }`}
                                                                                                >
                                                                                                    {sub.score.toFixed(
                                                                                                        2,
                                                                                                    )}
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="text-muted-foreground">
                                                                                                    {tCommon(
                                                                                                        'na',
                                                                                                    )}
                                                                                                </span>
                                                                                            )}
                                                                                        </TableCell>
                                                                                        <TableCell className="font-bold text-sm sm:text-base">
                                                                                            {sub.finalScore !==
                                                                                                null &&
                                                                                            sub.finalScore !==
                                                                                                undefined ? (
                                                                                                <span
                                                                                                    className={`${
                                                                                                        sub.finalScore >=
                                                                                                        90
                                                                                                            ? 'text-emerald-700 dark:text-emerald-300'
                                                                                                            : sub.finalScore >=
                                                                                                                70
                                                                                                              ? 'text-amber-700 dark:text-amber-300'
                                                                                                              : 'text-red-700 dark:text-red-300'
                                                                                                    }`}
                                                                                                >
                                                                                                    {sub.finalScore.toFixed(
                                                                                                        2,
                                                                                                    )}
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="text-muted-foreground">
                                                                                                    {tCommon(
                                                                                                        'na',
                                                                                                    )}
                                                                                                </span>
                                                                                            )}
                                                                                        </TableCell>
                                                                                        <TableCell>
                                                                                            <div>
                                                                                                {sub.status ===
                                                                                                'EVALUATED' ? (
                                                                                                    <Badge
                                                                                                        variant="default"
                                                                                                        className="rounded-none border border-emerald-700/35 bg-emerald-500/10 text-xs text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-200"
                                                                                                    >
                                                                                                        <CheckCircle2Icon className="h-3 w-3 mr-1" />
                                                                                                        {
                                                                                                            sub.status
                                                                                                        }
                                                                                                    </Badge>
                                                                                                ) : sub.status ===
                                                                                                  'PROCESSING' ? (
                                                                                                    <Badge
                                                                                                        variant="secondary"
                                                                                                        className="rounded-none border border-amber-700/35 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-200"
                                                                                                    >
                                                                                                        <Loader2Icon className="me-1 h-3 w-3 animate-spin" />
                                                                                                        {
                                                                                                            sub.status
                                                                                                        }
                                                                                                    </Badge>
                                                                                                ) : sub.status ===
                                                                                                  'ERROR' ? (
                                                                                                    <Badge
                                                                                                        variant="destructive"
                                                                                                        className="rounded-none text-xs"
                                                                                                    >
                                                                                                        <XCircleIcon className="h-3 w-3 mr-1" />
                                                                                                        {
                                                                                                            sub.status
                                                                                                        }
                                                                                                    </Badge>
                                                                                                ) : (
                                                                                                    <Badge
                                                                                                        variant="secondary"
                                                                                                        className="rounded-none text-xs"
                                                                                                    >
                                                                                                        {
                                                                                                            sub.status
                                                                                                        }
                                                                                                    </Badge>
                                                                                                )}
                                                                                            </div>
                                                                                        </TableCell>
                                                                                        <TableCell>
                                                                                            {(sub.status ===
                                                                                                'EVALUATED' ||
                                                                                                sub.status ===
                                                                                                    'ERROR') && (
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    variant="outline"
                                                                                                    onClick={() =>
                                                                                                        handleViewSubmissionDetails(
                                                                                                            sub.id,
                                                                                                        )
                                                                                                    }
                                                                                                    className="min-h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-3 text-xs text-[var(--platform-ink)] hover:bg-[var(--platform-violet)] hover:text-white dark:hover:text-[var(--platform-on-accent)]"
                                                                                                >
                                                                                                    {t(
                                                                                                        'details',
                                                                                                    )}
                                                                                                </Button>
                                                                                            )}
                                                                                            {sub.status ===
                                                                                                'PROCESSING' && (
                                                                                                <span className="text-xs text-muted-foreground italic">
                                                                                                    {t(
                                                                                                        'evaluating',
                                                                                                    )}
                                                                                                </span>
                                                                                            )}
                                                                                        </TableCell>
                                                                                    </TableRow>
                                                                                ),
                                                                            )}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        )}
                                                        {!submissionsLoading &&
                                                            submissionPage?.content.length ===
                                                                0 && (
                                                                <PlatformEmptyState
                                                                    icon={FileArchiveIcon}
                                                                    title={t('noSubmissionsYet')}
                                                                />
                                                            )}
                                                        {!submissionsLoading &&
                                                            (submissionPage?.page.totalPages || 0) >
                                                                1 && (
                                                                <div className="flex flex-col items-center justify-between gap-4 border-t border-[var(--platform-line)] px-5 pt-5 sm:flex-row sm:px-7">
                                                                    <div className="order-2 text-sm text-[var(--platform-ink-muted)] sm:order-1">
                                                                        {t('page')}{' '}
                                                                        {(submissionPage?.page
                                                                            .number || 0) + 1}{' '}
                                                                        {t('of')}{' '}
                                                                        {submissionPage?.page
                                                                            .totalPages || 0}
                                                                    </div>
                                                                    <div className="order-1 flex items-center gap-2 sm:order-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                handlePageChange(
                                                                                    (submissionPage
                                                                                        ?.page
                                                                                        .number ||
                                                                                        0) - 1,
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                submissionsLoading ||
                                                                                (submissionPage
                                                                                    ?.page.number ||
                                                                                    0) === 0
                                                                            }
                                                                            className="h-11 w-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] p-0 hover:bg-[var(--platform-violet)] hover:text-white dark:hover:text-[var(--platform-on-accent)]"
                                                                        >
                                                                            <ChevronLeftIcon className="h-4 w-4 rtl:rotate-180" />
                                                                            <span className="sr-only">
                                                                                {t('previousPage')}
                                                                            </span>
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                handlePageChange(
                                                                                    (submissionPage
                                                                                        ?.page
                                                                                        .number ||
                                                                                        0) + 1,
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                submissionsLoading ||
                                                                                (submissionPage
                                                                                    ?.page.number ||
                                                                                    0) >=
                                                                                    (submissionPage
                                                                                        ?.page
                                                                                        .totalPages ||
                                                                                        0) -
                                                                                        1
                                                                            }
                                                                            className="h-11 w-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] p-0 hover:bg-[var(--platform-violet)] hover:text-white dark:hover:text-[var(--platform-on-accent)]"
                                                                        >
                                                                            <ChevronRightIcon className="h-4 w-4 rtl:rotate-180" />
                                                                            <span className="sr-only">
                                                                                {t('nextPage')}
                                                                            </span>
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        {submissionsLoading && (
                                                            <div className="flex justify-center py-8">
                                                                <InlineLoadingIndicator />
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        )}
                                    </TabsContent>
                                </>
                            </Tabs>
                        </div>

                        <aside className="space-y-5 xl:sticky xl:top-24">
                            <Card className="rounded-none border border-[var(--platform-line-strong)] bg-[var(--platform-paper)] shadow-[5px_5px_0_var(--platform-line)]">
                                <CardHeader className="border-b border-[var(--platform-line)] bg-[var(--platform-paper-strong)] px-5 py-4">
                                    <CardTitle className="text-base sm:text-lg">
                                        {t('files')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-5">
                                    <Button
                                        asChild
                                        variant="outline"
                                        className="min-h-11 w-full rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] text-sm text-[var(--platform-ink)] hover:bg-[var(--platform-citron)] hover:text-[var(--platform-on-accent)]"
                                    >
                                        <a
                                            target="_blank"
                                            href={problem.datasetUrl}
                                            rel="noopener noreferrer"
                                            download
                                        >
                                            <DownloadIcon className="me-2 h-4 w-4" />
                                            {t('downloadFiles')}
                                        </a>
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className="rounded-none border border-[var(--platform-line-strong)] bg-[var(--platform-paper)] shadow-[6px_6px_0_var(--platform-violet)]">
                                <CardHeader className="border-b border-[var(--platform-line)] bg-[var(--platform-paper-strong)] px-5 py-4">
                                    <CardTitle className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <span className="text-base sm:text-lg font-bold">
                                            {t('submitSolution')}
                                        </span>
                                        {problem.isInOngoingCompetition &&
                                            !!problem.maxSubmissionsPerCompetition && (
                                                <SubmissionPillCounter
                                                    submissionsMax={
                                                        problem.maxSubmissionsPerCompetition
                                                    }
                                                    submissionsSent={
                                                        submissionPage?.page.totalElements || 0
                                                    }
                                                />
                                            )}
                                    </CardTitle>
                                    <CardDescription className="text-xs leading-5 text-[var(--platform-ink-muted)] sm:text-sm">
                                        <span className="block">
                                            {problem.isInOngoingCompetition
                                                ? t('submitSolutionAndSourceCodeDesc')
                                                : t('submitSolutionDesc')}
                                        </span>
                                        <span
                                            id="problem-upload-size-limit"
                                            className="mt-1 block font-semibold text-[var(--platform-ink-muted-strong)]"
                                        >
                                            {t('uploadSizeLimit')}
                                        </span>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 p-5">
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--platform-ink)]">
                                                {t('submissionFile')}
                                                {file && (
                                                    <CheckCircle2Icon className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                                                )}
                                            </h4>
                                            <div className="flex items-center justify-center w-full">
                                                <label
                                                    htmlFor="dropzone-file"
                                                    onDragOver={handleDragOver}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={handleDrop}
                                                    className={cn(
                                                        'flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-none border border-dashed transition-[background-color,border-color,transform] duration-200 focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[var(--platform-coral)]',
                                                        isDragging
                                                            ? 'border-[var(--platform-violet)] bg-[var(--platform-paper-strong)] translate-y-px'
                                                            : file
                                                              ? 'border-emerald-700/50 bg-emerald-500/10'
                                                              : 'border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] hover:border-[var(--platform-violet)] hover:bg-[var(--platform-paper)]',
                                                    )}
                                                >
                                                    <div className="flex flex-col items-center justify-center pt-3 pb-3 sm:pt-5 sm:pb-6">
                                                        {file ? (
                                                            <CheckCircle2Icon className="mb-2 h-8 w-8 text-emerald-700 dark:text-emerald-300" />
                                                        ) : (
                                                            <UploadIcon
                                                                className={cn(
                                                                    'mb-2 h-7 w-7 transition-colors',
                                                                    isDragging
                                                                        ? 'text-[var(--platform-violet)]'
                                                                        : 'text-[var(--platform-ink-muted)]',
                                                                )}
                                                            />
                                                        )}
                                                        <p className="mb-1 text-xs sm:text-sm text-center px-2">
                                                            <span
                                                                className={cn(
                                                                    'font-semibold',
                                                                    file
                                                                        ? 'text-emerald-700 dark:text-emerald-300'
                                                                        : isDragging
                                                                          ? 'text-[var(--platform-violet)]'
                                                                          : 'text-[var(--platform-ink)]',
                                                                )}
                                                            >
                                                                {file
                                                                    ? t('fileSelected')
                                                                    : t('clickToUpload')}
                                                            </span>
                                                            {!file && (
                                                                <span className="hidden text-[var(--platform-ink-muted-strong)] sm:inline">
                                                                    {' '}
                                                                    {t('dragAndDrop')}
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p
                                                            id="submission-file-constraints"
                                                            className={cn(
                                                                'px-2 text-center text-xs',
                                                                file
                                                                    ? 'font-medium text-emerald-700 dark:text-emerald-300'
                                                                    : 'text-[var(--platform-ink-muted)]',
                                                            )}
                                                        >
                                                            {file
                                                                ? `${file.name} · ${formatProblemUploadSize(file.size, locale)}`
                                                                : t('fileTypes')}
                                                        </p>
                                                    </div>
                                                    <input
                                                        id="dropzone-file"
                                                        type="file"
                                                        accept={SUBMISSION_FILE_ACCEPT}
                                                        className="sr-only"
                                                        onChange={handleFileChange}
                                                        aria-describedby="submission-file-constraints problem-upload-size-limit"
                                                        aria-invalid={
                                                            fileValidationError ? true : undefined
                                                        }
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--platform-ink)]">
                                                {problem.isInOngoingCompetition
                                                    ? t('sourceFileRequired')
                                                    : t('sourceFile')}
                                                {sourceFile && (
                                                    <CheckCircle2Icon className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                                                )}
                                            </h4>
                                            <div className="flex items-center justify-center w-full">
                                                <label
                                                    htmlFor="source-file"
                                                    onDragOver={handleSourceDragOver}
                                                    onDragLeave={handleSourceDragLeave}
                                                    onDrop={handleSourceDrop}
                                                    className={cn(
                                                        'flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-none border border-dashed transition-[background-color,border-color,transform] duration-200 focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[var(--platform-coral)]',
                                                        isSourceDragging
                                                            ? 'border-[var(--platform-violet)] bg-[var(--platform-paper-strong)] translate-y-px'
                                                            : sourceFile
                                                              ? 'border-emerald-700/50 bg-emerald-500/10'
                                                              : 'border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] hover:border-[var(--platform-violet)] hover:bg-[var(--platform-paper)]',
                                                    )}
                                                >
                                                    <div className="flex flex-col items-center justify-center pt-3 pb-3 sm:pt-5 sm:pb-6">
                                                        {sourceFile ? (
                                                            <CheckCircle2Icon className="mb-2 h-8 w-8 text-emerald-700 dark:text-emerald-300" />
                                                        ) : (
                                                            <UploadIcon
                                                                className={cn(
                                                                    'mb-2 h-7 w-7 transition-colors',
                                                                    isSourceDragging
                                                                        ? 'text-[var(--platform-violet)]'
                                                                        : 'text-[var(--platform-ink-muted)]',
                                                                )}
                                                            />
                                                        )}
                                                        <p className="mb-1 text-xs sm:text-sm text-center px-2">
                                                            <span
                                                                className={cn(
                                                                    'font-semibold',
                                                                    sourceFile
                                                                        ? 'text-emerald-700 dark:text-emerald-300'
                                                                        : isSourceDragging
                                                                          ? 'text-[var(--platform-violet)]'
                                                                          : 'text-[var(--platform-ink)]',
                                                                )}
                                                            >
                                                                {sourceFile
                                                                    ? t('fileSelected')
                                                                    : t('clickToUpload')}
                                                            </span>
                                                            {!sourceFile && (
                                                                <span className="hidden text-[var(--platform-ink-muted-strong)] sm:inline">
                                                                    {' '}
                                                                    {t('dragAndDrop')}
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p
                                                            id="source-file-constraints"
                                                            className={cn(
                                                                'px-2 text-center text-xs',
                                                                sourceFile
                                                                    ? 'font-medium text-emerald-700 dark:text-emerald-300'
                                                                    : 'text-[var(--platform-ink-muted)]',
                                                            )}
                                                        >
                                                            {sourceFile
                                                                ? `${sourceFile.name} · ${formatProblemUploadSize(sourceFile.size, locale)}`
                                                                : t('sourceFileTypes')}
                                                        </p>
                                                    </div>
                                                    <input
                                                        id="source-file"
                                                        type="file"
                                                        accept={SOURCE_FILE_ACCEPT}
                                                        className="sr-only"
                                                        onChange={handleSourceChange}
                                                        aria-describedby="source-file-constraints problem-upload-size-limit"
                                                        aria-invalid={
                                                            fileValidationError ? true : undefined
                                                        }
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    {fileValidationError && (
                                        <div
                                            className="border border-red-700/30 bg-red-500/10 px-3 py-3 text-sm leading-6 text-red-800 dark:text-red-200"
                                            role="alert"
                                        >
                                            {fileValidationError}
                                        </div>
                                    )}
                                    {status !== 'authenticated' ? (
                                        <>
                                            <p className="text-xs leading-5 text-[var(--platform-ink-muted)]">
                                                {t('loginToSubmit')}
                                            </p>
                                            <Button
                                                className="min-h-11 w-full rounded-none bg-[var(--platform-violet)] text-sm text-white hover:bg-[var(--platform-violet-strong)] dark:text-[var(--platform-on-accent)]"
                                                onClick={() => signIn('keycloak')}
                                            >
                                                {t('loginForUpload')}
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            className="h-12 w-full rounded-none bg-[var(--platform-citron)] text-sm font-bold text-[var(--platform-on-accent)] shadow-[4px_4px_0_var(--platform-violet)] hover:bg-[var(--platform-citron)] hover:brightness-95 active:translate-y-px active:shadow-[2px_2px_0_var(--platform-violet)]"
                                            onClick={handleUpload}
                                            disabled={
                                                !file ||
                                                uploading ||
                                                (problem.isInOngoingCompetition && !sourceFile)
                                            }
                                            loading={uploading}
                                        >
                                            <UploadIcon className="me-2 h-4 w-4" />
                                            {uploading ? t('uploading') : t('uploadAndEvaluate')}
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>

                            <div className="flex items-center gap-3 py-1">
                                <span
                                    className="h-px flex-1 bg-[var(--platform-line-strong)]"
                                    aria-hidden="true"
                                />
                                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-[var(--platform-ink-muted-strong)]">
                                    {t('colab.alternativeLabel')}
                                </span>
                                <span
                                    className="h-px flex-1 bg-[var(--platform-line-strong)]"
                                    aria-hidden="true"
                                />
                            </div>

                            <ProblemColabWorkspaceCard
                                problemId={problem.id}
                                problemTitle={problem.title}
                            />
                        </aside>
                    </div>

                    <section className="pt-3" aria-label={tMyQuestions('title')}>
                        <CommentsErrorBoundary
                            translations={{
                                title: tError('title'),
                                description: tError('description'),
                                suggestion: tError('suggestion'),
                                technicalDetails: tError('technicalDetails'),
                                reloadSection: tError('reloadSection'),
                                reloadPage: tError('reloadPage'),
                                retry: tCommon('retry'),
                            }}
                        >
                            <CommentsSection problemId={Number(problem.id)} />
                        </CommentsErrorBoundary>
                    </section>
                </div>
            </PlatformPageShell>

            {/* Submission Status Dialog */}
            <Dialog
                open={showSubmissionStatus}
                onOpenChange={(open) => {
                    setShowSubmissionStatus(open);
                    if (!open) handleCloseSubmissionStatus();
                }}
            >
                <DialogContent className={cn(dialogSurfaceClass, 'sm:max-w-md')}>
                    <DialogTitle className="sr-only">
                        {currentSubmission
                            ? tSubmissionStatus('success')
                            : tSubmissionStatus('failed')}
                    </DialogTitle>
                    <SubmissionStatus
                        submission={currentSubmission}
                        error={uploadError ?? undefined}
                        onCloseAction={handleCloseSubmissionStatus}
                    />
                </DialogContent>
            </Dialog>

            {/* Submission Details Dialog */}
            <Dialog
                open={showSubmissionDetails}
                onOpenChange={(open) => {
                    setShowSubmissionDetails(open);
                    if (!open) handleCloseSubmissionDetails();
                }}
            >
                <DialogContent
                    className={cn(dialogSurfaceClass, 'max-h-[92dvh] overflow-y-auto sm:max-w-4xl')}
                >
                    <DialogTitle className="sr-only">{t('details')}</DialogTitle>
                    {currentSubmission && (
                        <SubmissionDetails
                            submission={currentSubmission}
                            onClose={handleCloseSubmissionDetails}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {requiresSubmissionSelection && (
                <SelectedSubmissionsModal
                    competitionId={problem.competitionId || 0}
                    competitionStartTime={problem.competitionStartTime}
                    competitionEndTime={problem.competitionEndTime}
                />
            )}

            {/* Selection Error Dialog */}
            <Dialog open={showSelectionError} onOpenChange={setShowSelectionError}>
                <DialogContent className={cn(dialogSurfaceClass, 'sm:max-w-md')}>
                    <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
                        <div className="mb-5 grid h-14 w-14 place-items-center bg-red-500/10 text-red-700 shadow-[4px_4px_0_oklch(0.72_0.18_32)] dark:text-red-300">
                            <XCircleIcon className="h-7 w-7" aria-hidden="true" />
                        </div>
                        <DialogTitle className="mb-2 text-xl font-bold tracking-tight">
                            {t('saveSelectionError.title')}
                        </DialogTitle>
                        <p className="mb-6 max-w-sm text-sm leading-6 text-muted-foreground">
                            {t('saveSelectionError.description')}
                        </p>
                        <Button
                            onClick={() => window.location.reload()}
                            className="min-h-11 w-full rounded-none bg-[oklch(0.43_0.235_291)] text-white hover:bg-[oklch(0.36_0.22_291)]"
                            variant="default"
                        >
                            {t('saveSelectionError.reload')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
