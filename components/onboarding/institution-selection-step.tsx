'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, ArrowRight, Building2, Clock, RefreshCw, Search } from 'lucide-react';
import { Institution, MembershipRequest } from '@/lib/types';
import { InlineLoadingIndicator } from '@/components/loading-indicators';
import { fadeRightVariants, prefersReducedMotion } from '@/lib/animations';
import { InstitutionSearchSelect } from './institution-search-select';

interface InstitutionSelectionStepProps {
    currentInstitution: Institution | null;
    pendingRequest: MembershipRequest | null;
    isLoading?: boolean;
    error?: string | null;
    onRetry?: () => void;
    onNavigateToInstitutions: () => void;
    onInstitutionSelected?: (approved: boolean) => void;
}

export function InstitutionSelectionStep({
    currentInstitution,
    pendingRequest,
    isLoading = false,
    error,
    onRetry,
    onNavigateToInstitutions,
    onInstitutionSelected,
}: InstitutionSelectionStepProps) {
    const t = useTranslations('onboarding.institutionSelection');
    const tCommon = useTranslations('common');
    const router = useRouter();
    const shouldReduceMotion = prefersReducedMotion();
    const [showSearch, setShowSearch] = useState(false);

    const handleNavigate = () => {
        onNavigateToInstitutions();
        router.push('/institutions');
    };

    const handleInstitutionSelected = (approved: boolean) => {
        setShowSearch(false);
        if (onInstitutionSelected) {
            onInstitutionSelected(approved);
        }
    };

    // Show loading state while fetching membership requests
    if (isLoading) {
        return (
            <motion.div
                initial={shouldReduceMotion ? undefined : 'hidden'}
                animate={shouldReduceMotion ? undefined : 'visible'}
                exit={shouldReduceMotion ? undefined : 'exit'}
                variants={fadeRightVariants}
            >
                <Card
                    className="rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] shadow-none"
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                >
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center justify-center py-4">
                            <InlineLoadingIndicator
                                message={t('loading', { default: 'Loading institution status...' })}
                                size="md"
                            />
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        );
    }

    if (error) {
        return (
            <motion.div
                initial={shouldReduceMotion ? undefined : 'hidden'}
                animate={shouldReduceMotion ? undefined : 'visible'}
                exit={shouldReduceMotion ? undefined : 'exit'}
                variants={fadeRightVariants}
            >
                <Card
                    className="rounded-none border-[var(--platform-coral)] bg-[var(--platform-paper)] shadow-none"
                    role="alert"
                >
                    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div className="flex items-start gap-3">
                            <span className="grid h-11 w-11 shrink-0 place-items-center bg-[var(--platform-paper-strong)] text-[var(--platform-coral)]">
                                <AlertCircle className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <div>
                                <h3 className="font-bold text-[var(--platform-ink)]">
                                    {t('title')}
                                </h3>
                                <p className="mt-1 text-sm leading-6 text-[var(--platform-ink-muted)]">
                                    {error}
                                </p>
                            </div>
                        </div>
                        {onRetry ? (
                            <Button
                                type="button"
                                onClick={onRetry}
                                className="min-h-11 shrink-0 rounded-none bg-[var(--platform-violet)] px-5 text-white shadow-none hover:bg-[var(--platform-violet-strong)] dark:text-[var(--platform-on-accent)]"
                            >
                                <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
                                {tCommon('retry')}
                            </Button>
                        ) : null}
                    </CardContent>
                </Card>
            </motion.div>
        );
    }

    // State 1: User has an approved institution - show completion message or search
    if (currentInstitution) {
        return (
            <motion.div
                initial={shouldReduceMotion ? undefined : 'hidden'}
                animate={shouldReduceMotion ? undefined : 'visible'}
                exit={shouldReduceMotion ? undefined : 'exit'}
                variants={fadeRightVariants}
            >
                <Card
                    className="rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] shadow-none"
                    role="article"
                    aria-labelledby="institution-complete-title"
                >
                    <CardContent className="p-4 sm:p-6">
                        {!showSearch ? (
                            <div className="flex items-start gap-4">
                                <div
                                    className="flex h-11 w-11 shrink-0 items-center justify-center bg-[var(--platform-citron)] text-[var(--platform-on-accent)]"
                                    role="img"
                                    aria-label={t('completeIconLabel', {
                                        default: 'Institution selected',
                                    })}
                                >
                                    <Building2 className="h-5 w-5" aria-hidden="true" />
                                </div>

                                <div className="flex-1 space-y-3">
                                    <div>
                                        <h3
                                            id="institution-complete-title"
                                            className="text-lg font-semibold flex items-center gap-2"
                                        >
                                            {t('title')}
                                        </h3>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {t('completeDescription', {
                                                default:
                                                    'You have successfully joined an institution.',
                                            })}
                                        </p>
                                    </div>

                                    <div
                                        className="border-s-4 border-[var(--platform-citron)] bg-[var(--platform-paper-strong)] p-3"
                                        role="status"
                                        aria-live="polite"
                                    >
                                        <p className="text-sm font-bold text-[var(--platform-ink)]">
                                            {currentInstitution.name}
                                        </p>
                                        <p className="mt-1 text-xs text-[var(--platform-ink-muted)]">
                                            {t('currentInstitution', {
                                                default: 'Your current institution',
                                            })}
                                        </p>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Button
                                            onClick={() => setShowSearch(true)}
                                            variant="default"
                                            className="min-h-11 w-full rounded-none bg-[var(--platform-violet)] text-white shadow-none hover:bg-[var(--platform-violet-strong)] dark:text-[var(--platform-on-accent)] sm:w-auto"
                                            aria-label={t('changeInstitutionAriaLabel', {
                                                default: 'Change institution',
                                            })}
                                        >
                                            <Search className="mr-2 h-4 w-4" aria-hidden="true" />
                                            {t('changeInstitution', {
                                                default: 'Change Institution',
                                            })}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">
                                        {t('searchInstitutions', {
                                            default: 'Search Institutions',
                                        })}
                                    </h3>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setShowSearch(false)}
                                        className="min-h-11 rounded-none border border-transparent px-4 text-[var(--platform-ink-muted)] shadow-none hover:border-[var(--platform-line-strong)] hover:bg-[var(--platform-paper-strong)]"
                                    >
                                        {t('cancel', { default: 'Cancel' })}
                                    </Button>
                                </div>
                                <InstitutionSearchSelect
                                    onInstitutionSelected={handleInstitutionSelected}
                                    initialCountryCode={currentInstitution.country?.code}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        );
    }

    // State 2: User has a pending request
    if (pendingRequest) {
        return (
            <motion.div
                initial={shouldReduceMotion ? undefined : 'hidden'}
                animate={shouldReduceMotion ? undefined : 'visible'}
                exit={shouldReduceMotion ? undefined : 'exit'}
                variants={fadeRightVariants}
            >
                <Card
                    className="rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] shadow-none"
                    role="article"
                    aria-labelledby="institution-pending-title"
                >
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-start gap-4">
                            <div
                                className="flex h-11 w-11 shrink-0 items-center justify-center bg-[var(--platform-paper-strong)] text-[var(--platform-coral)]"
                                role="img"
                                aria-label={t('pendingIconLabel')}
                            >
                                <Clock className="h-5 w-5" aria-hidden="true" />
                            </div>

                            <div className="flex-1 space-y-3">
                                <div>
                                    <h3
                                        id="institution-pending-title"
                                        className="text-lg font-semibold flex items-center gap-2"
                                    >
                                        {t('title')}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {t('pendingDescription')}
                                    </p>
                                </div>

                                <div
                                    className="border-s-4 border-[var(--platform-coral)] bg-[var(--platform-paper-strong)] p-3"
                                    role="status"
                                    aria-live="polite"
                                >
                                    <p className="text-sm font-bold text-[var(--platform-ink)]">
                                        {pendingRequest.institution.name}
                                    </p>
                                    <p className="mt-1 text-xs text-[var(--platform-ink-muted)]">
                                        {t('pendingStatus')}
                                    </p>
                                </div>

                                <Button
                                    onClick={handleNavigate}
                                    variant="outline"
                                    className="min-h-11 w-full rounded-none border-[var(--platform-line-strong)] bg-transparent text-[var(--platform-ink)] shadow-none hover:bg-[var(--platform-paper-strong)] sm:w-auto"
                                    aria-label={t('viewInstitutionsAriaLabel')}
                                >
                                    {t('viewInstitutions')}
                                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        );
    }

    // State 3: User has no institution and no pending request
    return (
        <motion.div
            initial={shouldReduceMotion ? undefined : 'hidden'}
            animate={shouldReduceMotion ? undefined : 'visible'}
            exit={shouldReduceMotion ? undefined : 'exit'}
            variants={fadeRightVariants}
        >
            <Card
                className="rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] shadow-none"
                role="article"
                aria-labelledby="institution-select-title"
            >
                <CardContent className="p-4 sm:p-6">
                    {!showSearch ? (
                        <div className="flex items-start gap-4">
                            <div
                                className="flex h-11 w-11 shrink-0 items-center justify-center bg-[var(--platform-paper-strong)] text-[var(--platform-violet)]"
                                role="img"
                                aria-label={t('selectIconLabel')}
                            >
                                <Building2 className="h-5 w-5" aria-hidden="true" />
                            </div>

                            <div className="flex-1 space-y-3">
                                <div>
                                    <h3
                                        id="institution-select-title"
                                        className="text-lg font-semibold"
                                    >
                                        {t('title')}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {t('description')}
                                    </p>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Button
                                        onClick={() => setShowSearch(true)}
                                        variant="default"
                                        className="min-h-11 w-full rounded-none bg-[var(--platform-violet)] text-white shadow-none hover:bg-[var(--platform-violet-strong)] dark:text-[var(--platform-on-accent)] sm:w-auto"
                                        aria-label={t('selectInstitutionAriaLabel')}
                                    >
                                        <Search className="mr-2 h-4 w-4" aria-hidden="true" />
                                        {t('searchAndSelect', { default: 'Search & Select' })}
                                    </Button>
                                    <Button
                                        onClick={handleNavigate}
                                        variant="outline"
                                        className="min-h-11 w-full rounded-none border-[var(--platform-line-strong)] bg-transparent text-[var(--platform-ink)] shadow-none hover:bg-[var(--platform-paper-strong)] sm:w-auto"
                                        aria-label={t('browseAllAriaLabel', {
                                            default: 'Browse all institutions',
                                        })}
                                    >
                                        {t('browseAll', { default: 'Browse All' })}
                                        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold">
                                    {t('searchInstitutions', { default: 'Search Institutions' })}
                                </h3>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setShowSearch(false)}
                                    className="min-h-11 rounded-none border border-transparent px-4 text-[var(--platform-ink-muted)] shadow-none hover:border-[var(--platform-line-strong)] hover:bg-[var(--platform-paper-strong)]"
                                >
                                    {t('cancel', { default: 'Cancel' })}
                                </Button>
                            </div>
                            <InstitutionSearchSelect
                                onInstitutionSelected={handleInstitutionSelected}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}
