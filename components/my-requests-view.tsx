'use client';

import { useCallback, useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
    AlertTriangle,
    Ban,
    Building2,
    CheckCircle,
    Clock,
    FileText,
    LogIn,
    MapPin,
    XCircle,
} from 'lucide-react';

import { PlatformEmptyState } from '@/components/platform-page-shell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { cancelMembershipRequest, getMyMembershipRequests } from '@/lib/api';
import { getInstitutionLocationLabel } from '@/lib/country-display';
import type { InstitutionType, MembershipRequest, RequestStatus } from '@/lib/types';
import { useLocale } from '@/hooks/use-locale';
import { useRouter } from '@/i18n/routing';
import { platformSans } from '@/lib/platform-fonts';
import { cn } from '@/lib/utils';

const requestDialogClassName = cn(
    platformSans.className,
    'max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-none border-2 border-[oklch(0.62_0.06_287)] bg-[oklch(0.978_0.014_292)] text-[oklch(0.22_0.055_282)] shadow-[8px_8px_0_oklch(0.43_0.235_291/0.24)] dark:border-[oklch(0.5_0.07_287)] dark:bg-[oklch(0.18_0.038_286)] dark:text-[oklch(0.94_0.016_292)]',
);

export function MyRequestsView() {
    const t = useTranslations();
    const { locale } = useLocale();
    const { status } = useSession();
    const router = useRouter();

    const [requests, setRequests] = useState<MembershipRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<MembershipRequest | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const loadRequests = useCallback(async () => {
        if (status !== 'authenticated') {
            setLoading(status === 'loading');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            setRequests(await getMyMembershipRequests());
        } catch (loadError) {
            console.error('Failed to load requests:', loadError);
            setRequests([]);
            setError(loadError instanceof Error ? loadError.message : t('myRequests.loadError'));
        } finally {
            setLoading(false);
        }
    }, [reloadKey, status, t]);

    useEffect(() => {
        void loadRequests();
    }, [loadRequests]);

    const confirmCancelRequest = async () => {
        if (!selectedRequest || cancelling) return;

        setCancelling(true);
        try {
            await cancelMembershipRequest(selectedRequest.id);
            toast.success(t('myRequests.cancelled'), {
                description: t('myRequests.cancelledDescription'),
            });
            setCancelDialogOpen(false);
            setSelectedRequest(null);
            await loadRequests();
        } catch (cancelError) {
            toast.error(t('myRequests.cancelError'), {
                description:
                    cancelError instanceof Error
                        ? cancelError.message
                        : t('myRequests.cancelErrorDescription'),
            });
        } finally {
            setCancelling(false);
        }
    };

    const getStatusPresentation = (requestStatus: RequestStatus) => {
        const presentations: Record<
            RequestStatus,
            { icon: typeof Clock; className: string; label: string }
        > = {
            PENDING: {
                icon: Clock,
                className: 'border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100',
                label: t('myRequests.status.pending'),
            },
            APPROVED: {
                icon: CheckCircle,
                className:
                    'border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
                label: t('myRequests.status.approved'),
            },
            DECLINED: {
                icon: XCircle,
                className: 'border-red-500/35 bg-red-500/10 text-red-900 dark:text-red-100',
                label: t('myRequests.status.declined'),
            },
            CANCELLED: {
                icon: Ban,
                className:
                    'border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] text-[var(--platform-ink-muted)]',
                label: t('myRequests.status.cancelled'),
            },
        };
        return presentations[requestStatus];
    };

    const getInstitutionTypeLabel = (type: InstitutionType) => {
        const labels: Record<InstitutionType, string> = {
            GIMNAZIU: t('institutions.types.gimnaziu'),
            LICEU: t('institutions.types.liceu'),
            FACULTATE: t('institutions.types.facultate'),
        };
        return labels[type];
    };

    const formatDate = (value: Date) =>
        new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
            new Date(value),
        );

    if (status === 'unauthenticated') {
        return (
            <PlatformEmptyState
                className="mt-8"
                icon={LogIn}
                title={t('navigation.login')}
                description={t('myRequests.description')}
                action={
                    <Button
                        type="button"
                        className="min-h-11 rounded-none"
                        onClick={() => signIn('keycloak', { callbackUrl: window.location.href })}
                    >
                        {t('navigation.login')}
                    </Button>
                }
            />
        );
    }

    if (loading) {
        return (
            <div
                className="platform-panel mt-8 divide-y divide-[var(--platform-line)]"
                role="status"
                aria-busy="true"
            >
                {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="space-y-3 px-4 py-5 sm:px-6">
                        <Skeleton className="h-5 w-2/3 rounded-none bg-[var(--platform-line)]" />
                        <Skeleton className="h-4 w-1/3 rounded-none bg-[var(--platform-line)]" />
                        <Skeleton className="h-11 w-40 rounded-none bg-[var(--platform-line)]" />
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <PlatformEmptyState
                className="mt-8"
                icon={AlertTriangle}
                title={t('myRequests.error')}
                description={error}
                action={
                    <Button
                        type="button"
                        className="min-h-11 rounded-none"
                        onClick={() => setReloadKey((key) => key + 1)}
                    >
                        {t('common.retry')}
                    </Button>
                }
            />
        );
    }

    return (
        <div className="mt-8">
            {requests.length === 0 ? (
                <PlatformEmptyState
                    icon={FileText}
                    title={t('myRequests.noRequests')}
                    description={t('myRequests.noRequestsDescription')}
                    action={
                        <Button
                            className="min-h-11 rounded-none"
                            onClick={() => router.push('/institutions')}
                        >
                            {t('myRequests.browseInstitutions')}
                        </Button>
                    }
                />
            ) : (
                <ol className="platform-panel divide-y divide-[var(--platform-line)]">
                    {requests.map((request) => {
                        const presentation = getStatusPresentation(request.status);
                        const StatusIcon = presentation.icon;

                        return (
                            <li key={request.id} className="px-4 py-5 sm:px-6 sm:py-6">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                        <h2
                                            className="text-lg font-bold tracking-[-0.025em] text-[var(--platform-ink)]"
                                            dir="auto"
                                        >
                                            {request.institution.name}
                                        </h2>
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--platform-ink-muted)]">
                                            <span className="inline-flex items-center gap-1.5">
                                                <MapPin className="h-4 w-4" aria-hidden="true" />
                                                {getInstitutionLocationLabel(
                                                    request.institution,
                                                    locale,
                                                )}
                                            </span>
                                            <span>
                                                {getInstitutionTypeLabel(request.institution.type)}
                                            </span>
                                        </div>
                                    </div>
                                    <span
                                        className={cn(
                                            'inline-flex min-h-9 w-fit items-center gap-2 border px-3 text-xs font-bold',
                                            presentation.className,
                                        )}
                                    >
                                        <StatusIcon className="h-4 w-4" aria-hidden="true" />
                                        {presentation.label}
                                    </span>
                                </div>

                                <dl className="mt-5 grid gap-4 border-y border-[var(--platform-line)] py-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                                    <div>
                                        <dt className="text-[var(--platform-ink-muted)]">
                                            {t('myRequests.requestedAt')}
                                        </dt>
                                        <dd className="mt-1 font-semibold tabular-nums text-[var(--platform-ink)]">
                                            {formatDate(request.requestedAt)}
                                        </dd>
                                    </div>
                                    {request.processedAt ? (
                                        <div>
                                            <dt className="text-[var(--platform-ink-muted)]">
                                                {t('myRequests.processedAt')}
                                            </dt>
                                            <dd className="mt-1 font-semibold tabular-nums text-[var(--platform-ink)]">
                                                {formatDate(request.processedAt)}
                                            </dd>
                                        </div>
                                    ) : null}
                                    {request.processedBy ? (
                                        <div>
                                            <dt className="text-[var(--platform-ink-muted)]">
                                                {t('myRequests.processedBy')}
                                            </dt>
                                            <dd className="mt-1 font-semibold text-[var(--platform-ink)]">
                                                {request.processedBy}
                                            </dd>
                                        </div>
                                    ) : null}
                                </dl>

                                {request.notes ? (
                                    <div className="mt-4 border border-[var(--platform-line)] bg-[var(--platform-paper-strong)] p-4 text-sm">
                                        <p className="font-semibold text-[var(--platform-ink)]">
                                            {t('myRequests.notes')}
                                        </p>
                                        <p className="mt-2 whitespace-pre-wrap text-[var(--platform-ink-muted)]">
                                            {request.notes}
                                        </p>
                                    </div>
                                ) : null}

                                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                                    <Button
                                        variant="outline"
                                        className="min-h-11 rounded-none"
                                        onClick={() =>
                                            router.push(`/institutions/${request.institution.id}`)
                                        }
                                    >
                                        <Building2 className="me-2 h-4 w-4" aria-hidden="true" />
                                        {t('myRequests.viewInstitution')}
                                    </Button>
                                    {request.status === 'PENDING' ? (
                                        <Button
                                            variant="destructive"
                                            className="min-h-11 rounded-none"
                                            onClick={() => {
                                                setSelectedRequest(request);
                                                setCancelDialogOpen(true);
                                            }}
                                        >
                                            {t('myRequests.cancelRequest')}
                                        </Button>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}

            <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <AlertDialogContent className={requestDialogClassName}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('myRequests.cancelDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription className="text-[oklch(0.46_0.035_284)] dark:text-[oklch(0.72_0.025_288)]">
                            {t('myRequests.cancelDialog.description', {
                                institution: selectedRequest?.institution.name || '',
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={cancelling} className="min-h-11 rounded-none">
                            {t('common.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={cancelling}
                            onClick={(event) => {
                                event.preventDefault();
                                void confirmCancelRequest();
                            }}
                            className="min-h-11 rounded-none bg-red-700 text-white hover:bg-red-800"
                        >
                            {cancelling ? t('common.saving') : t('myRequests.cancelDialog.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
