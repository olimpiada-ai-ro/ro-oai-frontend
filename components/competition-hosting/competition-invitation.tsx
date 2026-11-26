'use client';

import { useState } from 'react';
import {
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Clock3,
    Loader2,
    LockKeyhole,
    Mail,
    Trophy,
    UserRound,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link, useRouter } from '@/i18n/routing';
import { OrganizerDataConsentChoice } from '@/components/competition-organizer-data-consent';
import {
    CompetitionHostingApiError,
    redeemStoredCompetitionInvitation,
    type CompetitionInvitationPreview,
} from '@/lib/competition-hosting';
import type { Locale, RequiredFieldsUpdateRequest } from '@/lib/types';
import { CompetitionRegistrationFields } from '@/components/competition-registration-fields';

function formatExpiry(value: string | null, locale: Locale): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Europe/Bucharest',
    }).format(date);
}

export function CompetitionInvitation({
    invitationHandle,
    invitation,
    locale,
    authenticated,
}: {
    invitationHandle: string;
    invitation: CompetitionInvitationPreview;
    locale: Locale;
    authenticated: boolean;
}) {
    const t = useTranslations('competitionHosting.invitation');
    const tRequired = useTranslations('requiredFields');
    const router = useRouter();
    const [registration, setRegistration] = useState<RequiredFieldsUpdateRequest>({});
    const requiredFields = invitation.sharedLink ? (invitation.requiredFields ?? []) : [];
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hasOrganizerConsentNotice = Boolean(
        invitation.valid && invitation.thirdPartyHosted && invitation.organizerName,
    );
    const [sharePersonalDataWithOrganizer, setSharePersonalDataWithOrganizer] = useState<
        boolean | undefined
    >(() => (hasOrganizerConsentNotice ? false : undefined));
    const expiry = formatExpiry(invitation.expiresAt, locale);
    const callbackPath = `/${locale}/competition-invitations/continue/${invitationHandle}`;

    const accept = async () => {
        if (!authenticated || !invitation.valid || busy) return;
        setBusy(true);
        setError(null);
        try {
            const result = await redeemStoredCompetitionInvitation(
                invitationHandle,
                sharePersonalDataWithOrganizer,
                requiredFields.length && Object.keys(registration).length
                    ? registration
                    : undefined,
            );
            router.replace(`/competitions/${result.competitionId}`);
            router.refresh();
        } catch (caught) {
            if (caught instanceof CompetitionHostingApiError && caught.status === 410) {
                setError(t('errors.unavailable'));
            } else {
                setError(caught instanceof Error ? caught.message : t('errors.generic'));
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="platform-page-shell">
            <div className="platform-page-inner">
                <section className="mx-auto max-w-4xl border border-[var(--platform-line-strong)] bg-[var(--platform-paper)] shadow-[8px_8px_0_var(--platform-line)]">
                    <div className="grid lg:grid-cols-[15rem_minmax(0,1fr)]">
                        <div className="relative min-h-44 overflow-hidden border-b border-[var(--platform-line-strong)] bg-[var(--platform-violet)] text-white lg:min-h-[32rem] lg:border-b-0 lg:border-e dark:text-[var(--platform-on-accent)]">
                            <svg
                                viewBox="0 0 240 520"
                                preserveAspectRatio="none"
                                className="absolute inset-0 h-full w-full"
                                aria-hidden="true"
                            >
                                <path
                                    d="M0 84H240M0 188H240M0 292H240M0 396H240M48 0V520M120 0V520M192 0V520"
                                    stroke="currentColor"
                                    strokeOpacity="0.14"
                                />
                                <path
                                    d="M22 397L72 326L113 352L161 211L219 128"
                                    fill="none"
                                    stroke="var(--platform-citron)"
                                    strokeWidth="7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            <span className="absolute start-5 top-5 grid h-14 w-14 place-items-center bg-[var(--platform-citron)] text-[var(--platform-on-accent)]">
                                <Trophy className="h-6 w-6" aria-hidden="true" />
                            </span>
                        </div>
                        <form
                            className="flex min-w-0 flex-col p-6 sm:p-9 lg:p-11"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void accept();
                            }}
                        >
                            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--platform-violet)]">
                                {t('eyebrow')}
                            </p>
                            <h1 className="mt-4 text-balance text-3xl font-bold leading-tight tracking-[-0.045em] text-[var(--platform-ink)] sm:text-4xl">
                                {invitation.valid ? t('title') : t('unavailableTitle')}
                            </h1>
                            <p className="mt-4 text-pretty text-base leading-7 text-[var(--platform-ink-muted)]">
                                {invitation.valid
                                    ? invitation.message || t('description')
                                    : t('unavailableDescription')}
                            </p>

                            {invitation.valid ? (
                                <dl className="mt-8 border-y border-[var(--platform-line-strong)] py-2">
                                    {invitation.competition ? (
                                        <div className="grid gap-1 border-b border-[var(--platform-line)] py-4 sm:grid-cols-[9rem_1fr]">
                                            <dt className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--platform-ink-muted)]">
                                                {t('competition')}
                                            </dt>
                                            <dd className="font-semibold text-[var(--platform-ink)]">
                                                {invitation.competition.name}
                                            </dd>
                                        </div>
                                    ) : null}
                                    {invitation.organizerName ? (
                                        <div className="grid gap-1 border-b border-[var(--platform-line)] py-4 sm:grid-cols-[9rem_1fr]">
                                            <dt className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[var(--platform-ink-muted)]">
                                                <UserRound
                                                    className="h-3.5 w-3.5"
                                                    aria-hidden="true"
                                                />
                                                {t('organizer')}
                                            </dt>
                                            <dd className="text-sm text-[var(--platform-ink)]">
                                                {invitation.organizerName}
                                            </dd>
                                        </div>
                                    ) : null}
                                    {invitation.maskedEmail ? (
                                        <div className="grid gap-1 border-b border-[var(--platform-line)] py-4 sm:grid-cols-[9rem_1fr]">
                                            <dt className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[var(--platform-ink-muted)]">
                                                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                                                {t('recipient')}
                                            </dt>
                                            <dd className="font-mono text-sm text-[var(--platform-ink)]">
                                                {invitation.maskedEmail}
                                            </dd>
                                        </div>
                                    ) : null}
                                    {expiry ? (
                                        <div className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]">
                                            <dt className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[var(--platform-ink-muted)]">
                                                <Clock3
                                                    className="h-3.5 w-3.5"
                                                    aria-hidden="true"
                                                />
                                                {t('expires')}
                                            </dt>
                                            <dd className="text-sm text-[var(--platform-ink)]">
                                                {expiry}
                                            </dd>
                                        </div>
                                    ) : null}
                                </dl>
                            ) : (
                                <p className="mt-8 flex items-start gap-2 border border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] p-4 text-sm text-[var(--platform-ink-muted)]">
                                    <AlertCircle
                                        className="mt-0.5 h-4 w-4 shrink-0"
                                        aria-hidden="true"
                                    />
                                    {t('status', { status: invitation.status })}
                                </p>
                            )}

                            {authenticated && invitation.valid && requiredFields.length > 0 && (
                                <fieldset disabled={busy} className="mt-7 space-y-4">
                                    <legend className="mb-4 text-sm">
                                        {tRequired('dialog.description', {
                                            competitionName: invitation.competition?.name ?? '',
                                        })}
                                    </legend>
                                    <CompetitionRegistrationFields
                                        requiredFields={requiredFields}
                                        validGrades={invitation.validGrades}
                                        values={registration}
                                        onChange={(field, value) =>
                                            setRegistration((current) => ({
                                                ...current,
                                                [field]: value,
                                            }))
                                        }
                                        maxLength={255}
                                    />
                                    {requiredFields.includes('institutionId') && (
                                        <Link
                                            href="/institutions"
                                            className="inline-block font-semibold underline"
                                        >
                                            {tRequired('selectInstitution')}
                                        </Link>
                                    )}
                                </fieldset>
                            )}

                            {invitation.valid &&
                            invitation.thirdPartyHosted &&
                            invitation.organizerName ? (
                                <OrganizerDataConsentChoice
                                    organizerName={invitation.organizerName}
                                    checked={sharePersonalDataWithOrganizer === true}
                                    onCheckedChange={setSharePersonalDataWithOrganizer}
                                    showControl={authenticated}
                                    disabled={busy}
                                    className="mt-7"
                                />
                            ) : null}

                            {error ? (
                                <p
                                    role="alert"
                                    className="mt-5 flex items-start gap-2 text-sm text-red-700 dark:text-red-300"
                                >
                                    <AlertCircle
                                        className="mt-0.5 h-4 w-4 shrink-0"
                                        aria-hidden="true"
                                    />
                                    {error}
                                </p>
                            ) : null}

                            <div className="mt-8">
                                {!invitation.valid ? (
                                    <Link
                                        href="/competitions"
                                        className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--platform-line-strong)] px-4 text-sm font-bold text-[var(--platform-ink)]"
                                    >
                                        {t('browseCompetitions')}
                                        <ArrowRight
                                            className="h-4 w-4 rtl:rotate-180"
                                            aria-hidden="true"
                                        />
                                    </Link>
                                ) : authenticated ? (
                                    <button
                                        type="submit"
                                        disabled={busy}
                                        className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--platform-violet)] px-5 text-sm font-bold text-white shadow-[4px_4px_0_var(--platform-line)] disabled:opacity-50 dark:text-[var(--platform-on-accent)]"
                                    >
                                        {busy ? (
                                            <Loader2
                                                className="h-4 w-4 animate-spin"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                        )}
                                        {busy ? t('accepting') : t('accept')}
                                    </button>
                                ) : (
                                    <Link
                                        href={`/login?callbackUrl=${encodeURIComponent(callbackPath)}`}
                                        className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--platform-violet)] px-5 text-sm font-bold text-white shadow-[4px_4px_0_var(--platform-line)] dark:text-[var(--platform-on-accent)]"
                                    >
                                        <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                                        {t('signIn')}
                                    </Link>
                                )}
                            </div>
                        </form>
                    </div>
                </section>
            </div>
        </div>
    );
}
