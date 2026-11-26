'use client';

import type { BasicCompetitionUserResponse } from '@/lib/types';
import { FormEvent, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { fetchApi } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AntiCheatBadge } from '@/components/anti-cheat-badge';
import { OnboardingGate } from '@/components/anti-cheat/onboarding-gate';
import { Link, useRouter } from '@/i18n/routing';
import { useOnboardingProgress } from '@/hooks/use-onboarding-progress';
import { RequiredFieldsUpdateRequest } from '@/lib/types';
import { CompetitionRegistrationFields } from '@/components/competition-registration-fields';
import { ArrowLeft, Trophy } from 'lucide-react';

import { PlatformPageShell, PlatformPageHeader } from '@/components/platform-page-shell';
import { OrganizerDataConsentChoice } from '@/components/competition-organizer-data-consent';
import type { CompetitionOrganizerDataConsent } from '@/lib/competition-hosting';

export type JoinCompetitionProps = {
    competition: BasicCompetitionUserResponse;
    organizerDataConsent?: CompetitionOrganizerDataConsent | null;
};

async function getJoinErrorMessage(response: Response, fallback: string): Promise<string> {
    try {
        const data = await response.clone().json();
        if (typeof data?.message === 'string' && data.message.trim()) return data.message;
    } catch {
        // Some backend errors are plain text.
    }

    try {
        const message = await response.text();
        if (message.trim()) return message;
    } catch {
        // Preserve the localized fallback.
    }

    return fallback;
}

export function JoinCompetition({ competition, organizerDataConsent }: JoinCompetitionProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showOnboardingGate, setShowOnboardingGate] = useState(false);
    const [joinedPendingOnboarding, setJoinedPendingOnboarding] = useState(false);
    const [requiredFieldsForm, setRequiredFieldsForm] = useState<RequiredFieldsUpdateRequest>({});
    const hasOrganizerConsentNotice = Boolean(
        organizerDataConsent?.thirdPartyHosted && organizerDataConsent.organizerDisplayName,
    );
    const [sharePersonalDataWithOrganizer, setSharePersonalDataWithOrganizer] = useState<
        boolean | undefined
    >(() =>
        hasOrganizerConsentNotice
            ? organizerDataConsent?.sharePersonalDataWithOrganizer === true
            : undefined,
    );
    const router = useRouter();
    const t = useTranslations('join');
    const tRequired = useTranslations('requiredFields');

    const handleRequiredFieldChange = (field: keyof RequiredFieldsUpdateRequest, value: string) => {
        setRequiredFieldsForm((prev) => ({ ...prev, [field]: value }));
    };

    // Use onboarding progress hook for managing progress state
    const { resetProgress } = useOnboardingProgress(competition.id);

    // Only show onboarding gate when SEB is required (it gates on sebRequired internally)
    const requiresOnboarding = competition.antiCheatEnabled && competition.sebRequired;

    // Handle successful onboarding completion
    // Requirements: 5.6 - Record consent to backend, navigate to problems
    // The backend will notify the companion app via WebSocket to transition to active mode
    const handleOnboardingComplete = useCallback(async () => {
        if (submitting) return;

        setSubmitting(true);
        setError(null);

        try {
            if (!joinedPendingOnboarding) {
                // Create the participant only after the form has passed native validation and
                // the user has explicitly completed the anti-cheat explanation.
                const joinResponse = await fetchApi(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${competition.id}/join`,
                    {
                        method: 'POST',
                        headers: {
                            'content-type': 'application/json',
                        },
                        body: JSON.stringify({
                            externalId: username,
                            password,
                            ...requiredFieldsForm,
                            ...(sharePersonalDataWithOrganizer === undefined
                                ? {}
                                : { sharePersonalDataWithOrganizer }),
                        }),
                    },
                );

                if (!joinResponse.ok) {
                    setError(
                        await getJoinErrorMessage(joinResponse, t('registerFailedInitialMessage')),
                    );
                    setShowOnboardingGate(false);
                    return;
                }

                // If the second request is interrupted, retry only onboarding completion—not the
                // participant creation request.
                setJoinedPendingOnboarding(true);
            }

            const completionResponse = await fetchApi(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${competition.id}/complete-onboarding`,
                {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                    },
                },
            );

            if (!completionResponse.ok) {
                setError(
                    await getJoinErrorMessage(
                        completionResponse,
                        t('registerFailedGenericMessage'),
                    ),
                );
                setShowOnboardingGate(false);
                return;
            }

            setShowOnboardingGate(false);
            router.push(`/competitions/${competition.id}`);
        } catch {
            setError(t('registerFailedGenericMessage'));
            setShowOnboardingGate(false);
        } finally {
            setSubmitting(false);
        }
    }, [
        competition.id,
        joinedPendingOnboarding,
        password,
        requiredFieldsForm,
        router,
        sharePersonalDataWithOrganizer,
        submitting,
        t,
        username,
    ]);

    // Handle cancel from the onboarding gate
    // Requirements: 1.5 - Redirect to competition page on cancel, clear any partial onboarding progress
    const handleOnboardingCancel = useCallback(() => {
        setShowOnboardingGate(false);
        // Clear any partial onboarding progress
        resetProgress();
        // Redirect back to competition page
        router.push(`/competitions/${competition.id}`);
    }, [competition.id, router, resetProgress]);

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        // Check if anti-cheat onboarding is required but not completed
        if (requiresOnboarding) {
            setShowOnboardingGate(true);
            return;
        }

        setSubmitting(true);

        try {
            const res = await fetchApi(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${competition.id}/join`,
                {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify({
                        externalId: username,
                        password,
                        ...requiredFieldsForm,
                        ...(sharePersonalDataWithOrganizer === undefined
                            ? {}
                            : { sharePersonalDataWithOrganizer }),
                    }),
                },
            );

            if (res.ok) {
                router.push(`/competitions/${competition.id}`);
                return;
            }

            setError(await getJoinErrorMessage(res, t('registerFailedInitialMessage')));
        } catch {
            setError(t('registerFailedGenericMessage'));
        } finally {
            setSubmitting(false);
        }
    }

    const header = (
        <PlatformPageHeader
            title={competition.name}
            eyebrow={t('title')}
            icon={Trophy}
            description={
                competition.inviteLinkOnly
                    ? t('inviteLinkRequired')
                    : t('description', { name: competition.name })
            }
            aside={competition.antiCheatEnabled ? <AntiCheatBadge enabled size="md" /> : null}
        />
    );
    if (competition.inviteLinkOnly)
        return <PlatformPageShell contentClassName="max-w-5xl">{header}</PlatformPageShell>;
    return (
        <PlatformPageShell contentClassName="max-w-5xl">
            {header}
            <div className="mt-8 max-w-3xl">
                <form onSubmit={onSubmit} className="platform-panel space-y-6 p-5 sm:p-7 lg:p-8">
                    {competition.isPrivate && (
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="username">{t('participantId')}</Label>
                                <Input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder={t('participantIdPlaceholder')}
                                    autoComplete="username"
                                    className="min-h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)]"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">{t('password')}</Label>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={t('passwordPlaceholder')}
                                    autoComplete="current-password"
                                    className="min-h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)]"
                                />
                            </div>
                        </div>
                    )}

                    {competition.requiredFields &&
                        competition.requiredFields.length > 0 &&
                        (!competition.requiredFields.includes('institutionId') ||
                            competition.hasInstitution) && (
                            <div className="space-y-5 border-t border-[var(--platform-line)] pt-6">
                                <p className="max-w-2xl text-sm font-medium leading-6 text-[var(--platform-ink-muted)]">
                                    {tRequired('dialog.description', {
                                        competitionName: competition.name,
                                    })}
                                </p>

                                <CompetitionRegistrationFields
                                    requiredFields={competition.requiredFields}
                                    validGrades={competition.validGrades}
                                    values={requiredFieldsForm}
                                    onChange={handleRequiredFieldChange}
                                />
                            </div>
                        )}

                    {competition.requiredFields?.includes('institutionId') &&
                        !competition.hasInstitution && (
                            <div className="space-y-4 border-t border-[var(--platform-line)] pt-6">
                                <p className="text-sm font-medium leading-6 text-[var(--platform-ink-muted)]">
                                    {tRequired('dialog.description', {
                                        competitionName: competition.name,
                                    })}
                                </p>
                                <div className="space-y-2">
                                    <Label>{tRequired('fields.competitionId')}</Label>
                                    <div className="border border-orange-600/35 bg-orange-400/10 p-4">
                                        <Button
                                            variant="link"
                                            className="h-auto min-h-11 rounded-none p-0 font-semibold text-orange-800 underline decoration-2 underline-offset-4 dark:text-orange-200"
                                            asChild
                                        >
                                            <Link href="/institutions">
                                                {tRequired('selectInstitution')}
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                    {organizerDataConsent?.thirdPartyHosted &&
                    organizerDataConsent.organizerDisplayName ? (
                        <OrganizerDataConsentChoice
                            organizerName={organizerDataConsent.organizerDisplayName}
                            checked={sharePersonalDataWithOrganizer === true}
                            onCheckedChange={setSharePersonalDataWithOrganizer}
                            disabled={submitting || joinedPendingOnboarding}
                        />
                    ) : null}

                    {error ? (
                        <p
                            className="border border-red-500/35 bg-red-500/10 p-3 text-sm font-medium text-red-700 dark:text-red-300"
                            role="alert"
                        >
                            {error}
                        </p>
                    ) : null}

                    <div className="flex flex-col-reverse gap-3 border-t border-[var(--platform-line)] pt-6 sm:flex-row sm:items-center">
                        <Button
                            variant="outline"
                            asChild
                            className="min-h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-5 font-semibold text-[var(--platform-ink)] shadow-none hover:bg-[var(--platform-paper-strong)]"
                        >
                            <Link href="/">
                                <ArrowLeft
                                    className="me-2 h-4 w-4 rtl:rotate-180"
                                    aria-hidden="true"
                                />
                                {t('cancel')}
                            </Link>
                        </Button>

                        {(!competition.requiredFields?.includes('institutionId') ||
                            competition.hasInstitution) && (
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="min-h-11 rounded-none bg-[var(--platform-citron)] px-5 font-bold text-[var(--platform-on-accent)] shadow-[4px_4px_0_var(--platform-violet)] hover:bg-[var(--platform-citron)] disabled:shadow-none sm:order-first"
                            >
                                {submitting ? t('submitting') : t('submit')}
                            </Button>
                        )}
                    </div>
                </form>
            </div>

            {requiresOnboarding && (
                <OnboardingGate
                    open={showOnboardingGate}
                    onOpenChange={setShowOnboardingGate}
                    competitionId={competition.id}
                    competitionName={competition.name}
                    sebRequired={competition.sebRequired}
                    onComplete={handleOnboardingComplete}
                    onCancel={handleOnboardingCancel}
                />
            )}
        </PlatformPageShell>
    );
}
