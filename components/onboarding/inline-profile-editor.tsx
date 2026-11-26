'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2, RefreshCw, Save, X } from 'lucide-react';
import { UserProfile, Country } from '@/lib/types';
import { cn } from '@/lib/utils';
import { limitProfileBio, PROFILE_BIO_MAX_LENGTH } from '@/lib/profile-bio';
import { CountrySelector } from '@/components/country-selector';
import { fetchApi } from '@/lib/api';
import {
    getMissingOnboardingProfileFields,
    type OnboardingProfileUpdate,
} from '@/lib/onboarding-profile';

interface InlineProfileEditorProps {
    userProfile: UserProfile;
    onSave: (updates: OnboardingProfileUpdate) => Promise<void>;
    onCancel: () => void;
}

export function InlineProfileEditor({ userProfile, onSave, onCancel }: InlineProfileEditorProps) {
    const t = useTranslations('onboarding.profileSetup');
    const tCommon = useTranslations('common');
    const tSettings = useTranslations('settings');
    const locale = useLocale();

    const [formData, setFormData] = useState({
        username: userProfile.username || '',
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        bio: limitProfileBio(userProfile.bio) || '',
        location: userProfile.location || '',
        countryCode: userProfile.country?.code || null,
    });

    const [countries, setCountries] = useState<Country[]>([]);
    const [loadingCountries, setLoadingCountries] = useState(true);
    const [countriesError, setCountriesError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const fetchCountries = useCallback(async () => {
        setLoadingCountries(true);
        setCountriesError(null);

        try {
            const response = await fetchApi(`${process.env.NEXT_PUBLIC_API_BASE_URL}/countries`);
            if (!response.ok) {
                throw new Error(`Country request failed (${response.status})`);
            }

            const data = (await response.json()) as Country[];
            setCountries(data);
        } catch {
            setCountries([]);
            setCountriesError(tSettings('errorLoadingCountries'));
        } finally {
            setLoadingCountries(false);
        }
    }, [tSettings]);

    useEffect(() => {
        void fetchCountries();
    }, [fetchCountries]);

    const handleChange = (field: keyof typeof formData, value: string | null) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        const requiredMessage = (label: string) =>
            locale === 'ro' ? `Completează câmpul „${label}”.` : `Complete the “${label}” field.`;
        const missingFields = getMissingOnboardingProfileFields({
            ...userProfile,
            ...formData,
        });

        if (missingFields.includes('username')) {
            newErrors.username = requiredMessage(t('fields.username'));
        } else if (formData.username.trim().length < 3) {
            newErrors.username =
                locale === 'ro'
                    ? 'Numele de utilizator trebuie să aibă cel puțin 3 caractere.'
                    : 'Username must be at least 3 characters.';
        } else if (formData.username.length > 30) {
            newErrors.username =
                locale === 'ro'
                    ? 'Numele de utilizator trebuie să aibă cel mult 30 de caractere.'
                    : 'Username must be at most 30 characters.';
        }

        if (missingFields.includes('firstName')) {
            newErrors.firstName = requiredMessage(t('fields.firstName'));
        } else if (formData.firstName.length > 50) {
            newErrors.firstName =
                locale === 'ro'
                    ? 'Prenumele trebuie să aibă cel mult 50 de caractere.'
                    : 'First name must be at most 50 characters.';
        }

        if (missingFields.includes('lastName')) {
            newErrors.lastName = requiredMessage(t('fields.lastName'));
        } else if (formData.lastName.length > 50) {
            newErrors.lastName =
                locale === 'ro'
                    ? 'Numele trebuie să aibă cel mult 50 de caractere.'
                    : 'Last name must be at most 50 characters.';
        }

        if (missingFields.includes('bio')) {
            newErrors.bio = requiredMessage(t('fields.bio'));
        } else if (formData.bio.length > PROFILE_BIO_MAX_LENGTH) {
            newErrors.bio =
                locale === 'ro'
                    ? 'Descrierea trebuie să aibă cel mult 500 de caractere.'
                    : 'Bio must be at most 500 characters.';
        }

        if (missingFields.includes('location')) {
            newErrors.location = requiredMessage(t('fields.location'));
        } else if (formData.location.length > 100) {
            newErrors.location =
                locale === 'ro'
                    ? 'Locația trebuie să aibă cel mult 100 de caractere.'
                    : 'Location must be at most 100 characters.';
        }

        if (missingFields.includes('countryCode')) {
            newErrors.countryCode = tSettings('countryRequired');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) {
            return;
        }

        setIsSaving(true);
        try {
            await onSave(formData);
        } catch {
            setErrors({ submit: tSettings('errorSavingSettings') });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isSaving} noValidate>
            <div className="space-y-4">
                {/* Username */}
                <div className="space-y-2">
                    <Label
                        htmlFor="username"
                        className="text-sm font-bold text-[var(--platform-ink)]"
                    >
                        {t('fields.username')}
                        <span className="ms-1 text-[var(--platform-coral)]" aria-hidden="true">
                            *
                        </span>
                    </Label>
                    <Input
                        id="username"
                        value={formData.username}
                        onChange={(e) => handleChange('username', e.target.value)}
                        placeholder={t('fields.username')}
                        disabled={isSaving}
                        required
                        className={cn(
                            'h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] text-[var(--platform-ink)] shadow-none focus-visible:scale-100 focus-visible:ring-0',
                            errors.username && 'border-[var(--platform-coral)]',
                        )}
                        aria-invalid={!!errors.username}
                        aria-describedby={errors.username ? 'username-error' : undefined}
                        maxLength={30}
                    />
                    {errors.username && (
                        <p id="username-error" className="text-sm text-destructive" role="alert">
                            {errors.username}
                        </p>
                    )}
                </div>

                {/* Name fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label
                            htmlFor="firstName"
                            className="text-sm font-bold text-[var(--platform-ink)]"
                        >
                            {t('fields.firstName')}
                            <span className="ms-1 text-[var(--platform-coral)]" aria-hidden="true">
                                *
                            </span>
                        </Label>
                        <Input
                            id="firstName"
                            value={formData.firstName}
                            onChange={(e) => handleChange('firstName', e.target.value)}
                            placeholder={t('fields.firstName')}
                            disabled={isSaving}
                            required
                            className={cn(
                                'h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] text-[var(--platform-ink)] shadow-none focus-visible:scale-100 focus-visible:ring-0',
                                errors.firstName && 'border-[var(--platform-coral)]',
                            )}
                            aria-invalid={!!errors.firstName}
                            aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                            maxLength={50}
                        />
                        {errors.firstName && (
                            <p
                                id="firstName-error"
                                className="text-sm text-destructive"
                                role="alert"
                            >
                                {errors.firstName}
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label
                            htmlFor="lastName"
                            className="text-sm font-bold text-[var(--platform-ink)]"
                        >
                            {t('fields.lastName')}
                            <span className="ms-1 text-[var(--platform-coral)]" aria-hidden="true">
                                *
                            </span>
                        </Label>
                        <Input
                            id="lastName"
                            value={formData.lastName}
                            onChange={(e) => handleChange('lastName', e.target.value)}
                            placeholder={t('fields.lastName')}
                            disabled={isSaving}
                            required
                            className={cn(
                                'h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] text-[var(--platform-ink)] shadow-none focus-visible:scale-100 focus-visible:ring-0',
                                errors.lastName && 'border-[var(--platform-coral)]',
                            )}
                            aria-invalid={!!errors.lastName}
                            aria-describedby={errors.lastName ? 'lastName-error' : undefined}
                            maxLength={50}
                        />
                        {errors.lastName && (
                            <p
                                id="lastName-error"
                                className="text-sm text-destructive"
                                role="alert"
                            >
                                {errors.lastName}
                            </p>
                        )}
                    </div>
                </div>

                {/* Bio */}
                <div className="space-y-2">
                    <Label htmlFor="bio" className="text-sm font-bold text-[var(--platform-ink)]">
                        {t('fields.bio')}
                        <span className="ms-1 text-[var(--platform-coral)]" aria-hidden="true">
                            *
                        </span>
                    </Label>
                    <Textarea
                        id="bio"
                        value={formData.bio}
                        onChange={(e) => handleChange('bio', e.target.value)}
                        placeholder={t('fields.bio')}
                        disabled={isSaving}
                        required
                        className={cn(
                            'min-h-28 resize-none rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] text-[var(--platform-ink)] shadow-none focus-visible:ring-0',
                            errors.bio && 'border-[var(--platform-coral)]',
                        )}
                        aria-invalid={!!errors.bio}
                        aria-describedby={errors.bio ? 'bio-error' : undefined}
                        maxLength={PROFILE_BIO_MAX_LENGTH}
                    />
                    <div className="flex justify-between items-center">
                        {errors.bio ? (
                            <p id="bio-error" className="text-sm text-destructive" role="alert">
                                {errors.bio}
                            </p>
                        ) : (
                            <span className="text-xs text-muted-foreground">
                                {formData.bio.length}/{PROFILE_BIO_MAX_LENGTH}
                            </span>
                        )}
                    </div>
                </div>

                {/* Location */}
                <div className="space-y-2">
                    <Label
                        htmlFor="location"
                        className="text-sm font-bold text-[var(--platform-ink)]"
                    >
                        {t('fields.location')}
                        <span className="ms-1 text-[var(--platform-coral)]" aria-hidden="true">
                            *
                        </span>
                    </Label>
                    <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => handleChange('location', e.target.value)}
                        placeholder={t('fields.location')}
                        disabled={isSaving}
                        required
                        className={cn(
                            'h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] text-[var(--platform-ink)] shadow-none focus-visible:scale-100 focus-visible:ring-0',
                            errors.location && 'border-[var(--platform-coral)]',
                        )}
                        aria-invalid={!!errors.location}
                        aria-describedby={errors.location ? 'location-error' : undefined}
                        maxLength={100}
                    />
                    {errors.location && (
                        <p id="location-error" className="text-sm text-destructive" role="alert">
                            {errors.location}
                        </p>
                    )}
                </div>

                {/* Country */}
                <div className="space-y-2">
                    <Label htmlFor="onboarding-country" className="text-sm font-medium">
                        {tSettings('country')}
                        {!userProfile.institution && (
                            <span className="ms-1 text-[var(--platform-coral)]" aria-hidden="true">
                                *
                            </span>
                        )}
                    </Label>
                    <CountrySelector
                        id="onboarding-country"
                        value={formData.countryCode}
                        onChange={(code) => handleChange('countryCode', code || '')}
                        countries={countries}
                        placeholder={tSettings('selectCountry')}
                        required={!userProfile.institution}
                        disabled={isSaving}
                        loading={loadingCountries}
                        error={errors.countryCode}
                        showClear={!!userProfile.institution}
                        searchPlaceholder={tSettings('searchCountries')}
                        emptyText={tSettings('noCountryFound')}
                        locale={locale}
                        className="[&_button[role=combobox]]:rounded-none [&_button[role=combobox]]:border-[var(--platform-line-strong)] [&_button[role=combobox]]:bg-[var(--platform-paper)] [&_button[role=combobox]]:text-[var(--platform-ink)]"
                    />
                    {countriesError ? (
                        <div
                            className="flex flex-col gap-3 border-s-4 border-[var(--platform-coral)] bg-[var(--platform-paper-strong)] p-4 sm:flex-row sm:items-center sm:justify-between"
                            role="alert"
                        >
                            <span className="flex items-start gap-2 text-sm font-medium text-[var(--platform-ink)]">
                                <AlertCircle
                                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--platform-coral)]"
                                    aria-hidden="true"
                                />
                                {countriesError}
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void fetchCountries()}
                                className="min-h-11 rounded-none border-[var(--platform-line-strong)] bg-transparent text-[var(--platform-ink)] shadow-none"
                            >
                                <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
                                {tCommon('retry')}
                            </Button>
                        </div>
                    ) : null}
                    {userProfile.institution && userProfile.institution.country && (
                        <p className="text-sm text-muted-foreground">
                            {tSettings('institutionCountry')}:{' '}
                            {userProfile.institution.country.name}{' '}
                            {userProfile.institution.country.flagEmoji}
                        </p>
                    )}
                    {!userProfile.institution && (
                        <p className="text-sm text-muted-foreground">
                            {tSettings('countryHelp', {
                                default:
                                    'This will be displayed on your profile and in leaderboards',
                            })}
                        </p>
                    )}
                </div>
            </div>

            {/* Submit error */}
            {errors.submit && (
                <p
                    className="border-s-4 border-[var(--platform-coral)] bg-[var(--platform-paper-strong)] p-4 text-sm text-[var(--platform-ink)]"
                    role="alert"
                >
                    {errors.submit}
                </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                    type="submit"
                    disabled={
                        isSaving ||
                        (!userProfile.institution && (loadingCountries || Boolean(countriesError)))
                    }
                    className="min-h-11 w-full rounded-none bg-[var(--platform-violet)] px-5 text-white shadow-none hover:bg-[var(--platform-violet-strong)] dark:text-[var(--platform-on-accent)] sm:w-auto"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            {tCommon('saving')}
                        </>
                    ) : (
                        <>
                            <Save className="me-2 h-4 w-4" aria-hidden="true" />
                            {tCommon('save')}
                        </>
                    )}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isSaving}
                    className="min-h-11 w-full rounded-none border-[var(--platform-line-strong)] bg-transparent text-[var(--platform-ink)] shadow-none hover:bg-[var(--platform-paper-strong)] sm:w-auto"
                >
                    <X className="me-2 h-4 w-4" aria-hidden="true" />
                    {tCommon('cancel')}
                </Button>
            </div>
        </form>
    );
}
