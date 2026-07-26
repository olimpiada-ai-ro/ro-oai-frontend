'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import {
    AlertTriangle,
    ArrowLeft,
    Building2,
    Check,
    ChevronRight,
    Clock3,
    Globe,
    Home,
    LogOut,
    MapPin,
    RefreshCw,
    ShieldCheck,
    Users,
} from 'lucide-react';

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
import { Skeleton } from '@/components/ui/skeleton';
import {
    PlatformEmptyState,
    PlatformPageHeader,
    PlatformSectionHeading,
} from '@/components/platform-page-shell';
import { CountryFlag } from '@/components/country-flag';
import { useToast } from '@/hooks/use-toast';
import { useGTMTracker } from '@/hooks/use-gtm-tracker';
import { Link, useRouter } from '@/i18n/routing';
import {
    createMembershipRequest,
    fetchApi,
    getInstitutionById,
    getMyMembershipRequests,
    leaveInstitution,
} from '@/lib/api';
import { getCountryDisplayName } from '@/lib/country-display';
import { platformSans } from '@/lib/platform-fonts';
import type { InstitutionResponse, InstitutionType, MembershipRequest } from '@/lib/types';
import { cn } from '@/lib/utils';

interface InstitutionDetailViewProps {
    institutionId: number | null;
}

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';
type MembershipAction = 'join' | 'leave' | null;

const dialogSurface = cn(
    platformSans.className,
    'rounded-none border-[oklch(0.62_0.06_287)] bg-[oklch(0.978_0.014_292)] text-[oklch(0.22_0.055_282)] shadow-[8px_8px_0_oklch(0.79_0.04_289)]',
    'dark:border-[oklch(0.5_0.07_287)] dark:bg-[oklch(0.18_0.038_286)] dark:text-[oklch(0.94_0.016_292)] dark:shadow-[8px_8px_0_oklch(0.34_0.055_287)]',
);

function isNotFoundError(error: unknown) {
    return error instanceof Error && /not found/i.test(error.message);
}

export function InstitutionDetailView({ institutionId }: InstitutionDetailViewProps) {
    const t = useTranslations();
    const locale = useLocale();
    const router = useRouter();
    const { toast } = useToast();
    const { data: session } = useSession();
    const { trackProfile } = useGTMTracker();

    const [institution, setInstitution] = useState<InstitutionResponse | null>(null);
    const [myRequests, setMyRequests] = useState<MembershipRequest[]>([]);
    const [loadState, setLoadState] = useState<LoadState>(
        institutionId === null ? 'not-found' : 'loading',
    );
    const [loadError, setLoadError] = useState<string | null>(null);
    const [joinDialogOpen, setJoinDialogOpen] = useState(false);
    const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
    const [membershipAction, setMembershipAction] = useState<MembershipAction>(null);
    const [userInstitutionId, setUserInstitutionId] = useState<number | null>(null);
    const [membershipLoadedFor, setMembershipLoadedFor] = useState<string | null>(null);

    const loadInstitution = useCallback(async () => {
        if (institutionId === null) {
            setInstitution(null);
            setLoadState('not-found');
            return;
        }

        setLoadState('loading');
        setLoadError(null);

        try {
            const data = await getInstitutionById(institutionId);
            setInstitution(data);
            setLoadState('ready');
        } catch (error) {
            console.error('Failed to load institution:', error);
            setInstitution(null);
            if (isNotFoundError(error)) {
                setLoadState('not-found');
                return;
            }

            setLoadError(error instanceof Error ? error.message : t('institutions.loadError'));
            setLoadState('error');
        }
    }, [institutionId, t]);

    const loadUserProfile = useCallback(async () => {
        if (!session?.id) return;

        try {
            const response = await fetchApi(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/profile/settings`,
            );
            if (response.ok) {
                const data = await response.json();
                setUserInstitutionId(data.institution?.id || null);
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
        }
    }, [session?.id]);

    const loadMyRequests = useCallback(async () => {
        if (!session?.id) return;

        try {
            const data = await getMyMembershipRequests();
            setMyRequests(data);
        } catch (error) {
            console.error('Failed to load membership requests:', error);
        }
    }, [session?.id]);

    useEffect(() => {
        void loadInstitution();
    }, [loadInstitution]);

    useEffect(() => {
        if (!session?.id) {
            setMyRequests([]);
            setUserInstitutionId(null);
            setMembershipLoadedFor(null);
            return;
        }

        let isCurrent = true;
        setMembershipLoadedFor(null);
        void Promise.allSettled([loadMyRequests(), loadUserProfile()]).then(() => {
            if (isCurrent) setMembershipLoadedFor(session.id || null);
        });

        return () => {
            isCurrent = false;
        };
    }, [loadMyRequests, loadUserProfile, session?.id]);

    const handleConfirmRequest = async () => {
        if (!institution || membershipAction) return;

        setMembershipAction('join');
        try {
            const response = await createMembershipRequest(institution.id);

            if (response.status === 'APPROVED') {
                toast({
                    title: t('institutions.requestApproved'),
                    description: t('institutions.requestApprovedDescription'),
                });
                setUserInstitutionId(institution.id);
                await Promise.all([loadUserProfile(), loadInstitution()]);
                trackProfile('institution_membership', {
                    actionType: 'join',
                    institutionId: institution.id,
                    institutionName: institution.name,
                    autoApproved: true,
                });
            } else {
                toast({
                    title: t('institutions.requestSent'),
                    description: t('institutions.requestSentDescription'),
                });
                await loadMyRequests();
                trackProfile('institution_membership', {
                    actionType: 'request',
                    institutionId: institution.id,
                    institutionName: institution.name,
                    autoApproved: false,
                });
            }

            setJoinDialogOpen(false);
        } catch (error) {
            toast({
                title: t('institutions.requestError'),
                description:
                    error instanceof Error
                        ? error.message
                        : t('institutions.requestErrorDescription'),
                variant: 'destructive',
            });
        } finally {
            setMembershipAction(null);
        }
    };

    const handleLeaveInstitution = async () => {
        if (!institution || membershipAction) return;

        setMembershipAction('leave');
        try {
            const institutionInfo = {
                institutionId: institution.id,
                institutionName: institution.name,
            };

            await leaveInstitution();
            toast({
                title: t('institutions.leftInstitution'),
                description: t('institutions.leftInstitutionDescription'),
            });
            setUserInstitutionId(null);
            setLeaveDialogOpen(false);
            await Promise.all([loadInstitution(), loadUserProfile()]);
            trackProfile('institution_membership', {
                actionType: 'leave',
                ...institutionInfo,
            });
            router.refresh();
        } catch (error) {
            toast({
                title: t('institutions.leaveError'),
                description:
                    error instanceof Error
                        ? error.message
                        : t('institutions.leaveErrorDescription'),
                variant: 'destructive',
            });
        } finally {
            setMembershipAction(null);
        }
    };

    const getInstitutionTypeLabel = (type: InstitutionType) => {
        const labels: Record<InstitutionType, string> = {
            GIMNAZIU: t('institutions.types.gimnaziu'),
            LICEU: t('institutions.types.liceu'),
            FACULTATE: t('institutions.types.facultate'),
        };
        return labels[type];
    };

    const dateFormatter = useMemo(
        () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }),
        [locale],
    );

    if (loadState === 'loading') {
        return <InstitutionDetailLoading loadingLabel={t('common.loading')} />;
    }

    if (loadState === 'not-found') {
        return (
            <>
                <PlatformPageHeader
                    eyebrow={t('institutions.title')}
                    icon={Building2}
                    title={t('institutions.notFound')}
                    description={t('institutions.description')}
                />
                <PlatformEmptyState
                    className="mt-8"
                    icon={Building2}
                    title={t('institutions.notFound')}
                    action={
                        <Button asChild className="min-h-11 rounded-none px-5">
                            <Link href="/institutions">
                                <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
                                {t('institutions.backToList')}
                            </Link>
                        </Button>
                    }
                />
            </>
        );
    }

    if (loadState === 'error' || !institution) {
        return (
            <>
                <PlatformPageHeader
                    eyebrow={t('institutions.title')}
                    icon={Building2}
                    title={t('institutions.error')}
                    description={t('institutions.description')}
                />
                <PlatformEmptyState
                    className="mt-8"
                    icon={AlertTriangle}
                    title={t('institutions.loadError')}
                    description={loadError}
                    action={
                        <div className="flex flex-wrap justify-center gap-3">
                            <Button
                                type="button"
                                className="min-h-11 rounded-none px-5"
                                onClick={() => void loadInstitution()}
                            >
                                <RefreshCw className="me-2 h-4 w-4" />
                                {t('common.retry')}
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                className="min-h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-5"
                            >
                                <Link href="/institutions">{t('institutions.backToList')}</Link>
                            </Button>
                        </div>
                    }
                />
            </>
        );
    }

    const pendingRequest = myRequests.find(
        (request) => request.institution.id === institution.id && request.status === 'PENDING',
    );
    const isMember = userInstitutionId === institution.id;
    const typeLabel = getInstitutionTypeLabel(institution.type);
    const isRomanian = institution.country?.code === 'RO';
    const countryName = institution.country
        ? getCountryDisplayName(institution.country, locale)
        : null;

    const membershipControl = session?.id ? (
        membershipLoadedFor !== session.id ? (
            <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] px-5"
                disabled
            >
                <Clock3
                    className="me-2 h-4 w-4 animate-pulse motion-reduce:animate-none"
                    aria-hidden="true"
                />
                {t('common.loading')}
            </Button>
        ) : isMember ? (
            <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-none border-[var(--platform-coral)] bg-[var(--platform-paper)] px-5 text-[var(--platform-ink)] hover:bg-[color-mix(in_oklch,var(--platform-coral)_14%,var(--platform-paper))]"
                onClick={() => setLeaveDialogOpen(true)}
            >
                <LogOut className="me-2 h-4 w-4" aria-hidden="true" />
                {t('institutions.leaveInstitution')}
            </Button>
        ) : pendingRequest ? (
            <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] px-5"
                disabled
            >
                <Clock3 className="me-2 h-4 w-4" aria-hidden="true" />
                {t('institutions.requestPending')}
            </Button>
        ) : (
            <Button
                type="button"
                className="min-h-11 rounded-none bg-[var(--platform-violet)] px-5 text-white hover:bg-[var(--platform-violet-strong)] dark:text-[var(--platform-on-accent)]"
                onClick={() => setJoinDialogOpen(true)}
            >
                <Building2 className="me-2 h-4 w-4" aria-hidden="true" />
                {t('institutions.requestToJoin')}
            </Button>
        )
    ) : undefined;

    return (
        <>
            <nav
                aria-label={t('institutions.title')}
                className="mb-7 flex min-h-11 items-center gap-2 overflow-x-auto text-sm text-[var(--platform-ink-muted)]"
            >
                <Link
                    href="/"
                    aria-label={t('common.appName')}
                    className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center border border-transparent hover:border-[var(--platform-line)] hover:bg-[var(--platform-paper-strong)]"
                >
                    <Home className="h-4 w-4" aria-hidden="true" />
                </Link>
                <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
                <Link
                    href="/institutions"
                    className="inline-flex min-h-11 shrink-0 items-center px-2 font-semibold hover:text-[var(--platform-violet)] hover:underline"
                >
                    {t('institutions.title')}
                </Link>
                <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
                <span
                    className="truncate font-medium text-[var(--platform-ink)]"
                    aria-current="page"
                >
                    {institution.name}
                </span>
            </nav>

            <PlatformPageHeader
                eyebrow={typeLabel}
                icon={Building2}
                title={<span dir="auto">{institution.name}</span>}
                description={
                    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                        {isRomanian ? (
                            <>
                                <Link
                                    href={`/countries/RO/counties/${institution.county.id}`}
                                    className="font-medium underline-offset-4 hover:text-[var(--platform-violet)] hover:underline"
                                >
                                    {institution.county.name}
                                </Link>
                                <span aria-hidden="true">·</span>
                            </>
                        ) : null}
                        {institution.country ? (
                            <Link
                                href={`/countries/${institution.country.code}`}
                                className="font-medium underline-offset-4 hover:text-[var(--platform-violet)] hover:underline"
                            >
                                {countryName}
                            </Link>
                        ) : null}
                    </span>
                }
                aside={membershipControl}
            />

            <dl
                className={cn(
                    'mt-8 grid grid-cols-2 border-y border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)]',
                    isRomanian ? 'md:grid-cols-4' : 'md:grid-cols-3',
                )}
            >
                <InstitutionMetric
                    icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
                    label={t('rankings.type')}
                    value={typeLabel}
                />
                {isRomanian ? (
                    <InstitutionMetric
                        icon={<MapPin className="h-5 w-5" aria-hidden="true" />}
                        label={t('rankings.county')}
                        value={institution.county.name}
                    />
                ) : null}
                <InstitutionMetric
                    icon={
                        institution.country ? (
                            <CountryFlag
                                countryCode={institution.country.code}
                                countryName={countryName ?? institution.country.name}
                                size="sm"
                            />
                        ) : (
                            <Globe className="h-5 w-5" aria-hidden="true" />
                        )
                    }
                    label={t('institutions.country')}
                    value={countryName || t('common.na')}
                />
                <InstitutionMetric
                    icon={<Users className="h-5 w-5" aria-hidden="true" />}
                    label={t('institutions.totalMembers')}
                    value={new Intl.NumberFormat(locale).format(institution.memberCount)}
                />
            </dl>

            <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:gap-14">
                <section aria-label={t('institutions.about')}>
                    <PlatformSectionHeading
                        title={t('institutions.about')}
                        eyebrow={t('institutions.title')}
                    />
                    <div className="border-b border-[var(--platform-line)] py-6">
                        {institution.description ? (
                            <p
                                className="max-w-[70ch] text-pretty text-base leading-7 text-[var(--platform-ink-muted-strong)]"
                                dir="auto"
                            >
                                {institution.description}
                            </p>
                        ) : (
                            <p className="text-sm text-[var(--platform-ink-muted)]">
                                {t('institutions.description')}
                            </p>
                        )}
                    </div>
                </section>

                <aside
                    aria-label={t('institutions.about')}
                    className="border-y border-[var(--platform-line-strong)]"
                >
                    {institution.address ? (
                        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 border-b border-[var(--platform-line)] py-4">
                            <span className="grid h-11 w-11 place-items-center bg-[var(--platform-citron)] text-[var(--platform-on-accent)]">
                                <MapPin className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                                    {t('institutions.address')}
                                </p>
                                <p
                                    className="mt-1 text-sm leading-6 text-[var(--platform-ink)]"
                                    dir="auto"
                                >
                                    {institution.address}
                                </p>
                            </div>
                        </div>
                    ) : null}
                    {institution.website ? (
                        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 py-4">
                            <span className="grid h-11 w-11 place-items-center bg-[var(--platform-violet)] text-white dark:text-[var(--platform-on-accent)]">
                                <Globe className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                                    {t('institutions.website')}
                                </p>
                                <a
                                    href={institution.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex min-h-11 max-w-full items-center break-all text-sm font-semibold text-[var(--platform-violet)] underline decoration-[var(--platform-coral)] decoration-2 underline-offset-4"
                                >
                                    {institution.website}
                                </a>
                            </div>
                        </div>
                    ) : null}
                    {!institution.address && !institution.website ? (
                        <div className="py-6 text-sm text-[var(--platform-ink-muted)]">
                            {t('common.na')}
                        </div>
                    ) : null}
                </aside>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
                {institution.autoApproveRequests ? (
                    <span className="inline-flex min-h-11 items-center gap-2 border border-[var(--platform-line-strong)] bg-[var(--platform-citron)] px-4 text-sm font-semibold text-[var(--platform-on-accent)]">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        {t('institutions.autoApproveEnabled')}
                    </span>
                ) : null}
                {isMember ? (
                    <span className="inline-flex min-h-11 items-center gap-2 border border-[var(--platform-violet)] bg-[var(--platform-paper-strong)] px-4 text-sm font-semibold text-[var(--platform-violet)]">
                        <Check className="h-4 w-4" aria-hidden="true" />
                        {t('institutions.alreadyMember')}
                    </span>
                ) : null}
            </div>

            {institution.moderators?.length ? (
                <section className="mt-12" aria-label={t('institutions.moderators')}>
                    <PlatformSectionHeading
                        title={t('institutions.moderators')}
                        description={t('institutions.moderatorsDescription')}
                    />
                    <ul className="border-t border-[var(--platform-line-strong)]">
                        {institution.moderators.map((moderator, index) => (
                            <li
                                key={moderator.userId}
                                className="grid min-h-16 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 border-b border-[var(--platform-line)] py-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]"
                            >
                                <span className="font-mono text-xs font-bold tabular-nums text-[var(--platform-violet)]">
                                    {String(index + 1).padStart(2, '0')}
                                </span>
                                <span
                                    className="truncate font-semibold text-[var(--platform-ink)]"
                                    dir="auto"
                                >
                                    {moderator.username}
                                </span>
                                <time
                                    dateTime={moderator.assignedAt.toISOString()}
                                    className="col-start-2 text-xs text-[var(--platform-ink-muted)] sm:col-start-3"
                                >
                                    {t('institutions.assignedAt', {
                                        date: dateFormatter.format(moderator.assignedAt),
                                    })}
                                </time>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            <AlertDialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                <AlertDialogContent className={dialogSurface}>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl tracking-[-0.025em]">
                            {t('institutions.requestDialog.title')}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-[oklch(0.46_0.044_282)] dark:text-[oklch(0.73_0.034_290)]">
                            {t('institutions.requestDialog.description', {
                                institution: institution.name,
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            className="min-h-11 rounded-none border-[oklch(0.62_0.06_287)] bg-transparent"
                            disabled={membershipAction === 'join'}
                        >
                            {t('common.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="min-h-11 rounded-none bg-[oklch(0.43_0.235_291)] text-white hover:bg-[oklch(0.36_0.22_291)] dark:bg-[oklch(0.72_0.19_292)] dark:text-[oklch(0.2_0.045_282)]"
                            disabled={membershipAction === 'join'}
                            onClick={(event) => {
                                event.preventDefault();
                                void handleConfirmRequest();
                            }}
                        >
                            {membershipAction === 'join'
                                ? t('institutions.submitting')
                                : t('institutions.requestDialog.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                <AlertDialogContent className={dialogSurface}>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl tracking-[-0.025em]">
                            {t('institutions.leaveInstitutionConfirmTitle')}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-[oklch(0.46_0.044_282)] dark:text-[oklch(0.73_0.034_290)]">
                            {t('institutions.leaveInstitutionConfirmDescription', {
                                name: institution.name,
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            className="min-h-11 rounded-none border-[oklch(0.62_0.06_287)] bg-transparent"
                            disabled={membershipAction === 'leave'}
                        >
                            {t('common.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="min-h-11 rounded-none bg-[oklch(0.56_0.2_30)] text-white hover:bg-[oklch(0.48_0.2_30)]"
                            disabled={membershipAction === 'leave'}
                            onClick={(event) => {
                                event.preventDefault();
                                void handleLeaveInstitution();
                            }}
                        >
                            {membershipAction === 'leave'
                                ? t('common.loading')
                                : t('institutions.leaveInstitution')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function InstitutionMetric({
    icon,
    label,
    value,
}: {
    icon: ReactNode;
    label: string;
    value: ReactNode;
}) {
    return (
        <div className="grid min-h-28 grid-cols-[2.5rem_minmax(0,1fr)] grid-rows-[auto_1fr] items-center gap-x-3 border-b border-e border-[var(--platform-line)] p-4 even:border-e-0 md:border-b-0 md:even:border-e md:last:border-e-0">
            <dt className="col-start-2 self-end text-xs font-bold uppercase tracking-[0.08em] text-[var(--platform-ink-muted)]">
                {label}
            </dt>
            <dd className="col-span-2 grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3">
                <span
                    className="grid h-10 w-10 shrink-0 place-items-center bg-[var(--platform-citron)] text-[var(--platform-on-accent)]"
                    aria-hidden="true"
                >
                    {icon}
                </span>
                <span
                    className="min-w-0 truncate text-sm font-semibold text-[var(--platform-ink)]"
                    dir="auto"
                >
                    {value}
                </span>
            </dd>
        </div>
    );
}

function InstitutionDetailLoading({ loadingLabel }: { loadingLabel: string }) {
    return (
        <div role="status" aria-label={loadingLabel} aria-busy="true">
            <Skeleton className="h-11 w-48 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
            <div className="mt-7 border-b border-[var(--platform-line-strong)] pb-10">
                <Skeleton className="h-4 w-36 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                <Skeleton className="mt-5 h-16 w-full max-w-3xl rounded-none bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                <Skeleton className="mt-4 h-5 w-full max-w-xl rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
            </div>
            <div className="mt-8 grid grid-cols-2 border-y border-[var(--platform-line)] md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="min-h-28 border-b border-e border-[var(--platform-line)] p-4 md:border-b-0"
                    >
                        <Skeleton className="h-10 w-10 rounded-none bg-[var(--platform-citron)] motion-reduce:animate-none" />
                        <Skeleton className="mt-3 h-4 w-24 rounded-none bg-[var(--platform-line)] motion-reduce:animate-none" />
                    </div>
                ))}
            </div>
            <div className="mt-10 grid gap-10 lg:grid-cols-2">
                <Skeleton className="h-48 rounded-none bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
                <Skeleton className="h-48 rounded-none bg-[var(--platform-paper-strong)] motion-reduce:animate-none" />
            </div>
            <span className="sr-only">{loadingLabel}</span>
        </div>
    );
}
