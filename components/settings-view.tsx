'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import {
    AlertCircle,
    Check,
    CheckCircle2,
    ImagePlus,
    LayoutTemplate,
    LogIn,
    MonitorCog,
    Moon,
    Palette,
    RefreshCw,
    Save,
    Settings2,
    ShieldCheck,
    Sparkles,
    Sun,
    Terminal,
    Trash2,
    UserRound,
    type LucideIcon,
} from 'lucide-react';

import AvatarCropper from '@/components/avatar-cropper';
import { CountrySelector } from '@/components/country-selector';
import {
    PlatformEmptyState,
    PlatformPageHeader,
    PlatformPageShell,
} from '@/components/platform-page-shell';
import { useCurrentUser } from '@/components/providers/current-user-provider';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useGTMTracker } from '@/hooks/use-gtm-tracker';
import { Link } from '@/i18n/routing';
import { fetchApi } from '@/lib/api';
import { platformSans } from '@/lib/platform-fonts';
import { isUsernameSlugFriendly, toProfileSlug } from '@/lib/profile-utils';
import type {
    Country,
    UserProfileSettingsResponse,
    UserProfileSettingsUpdateRequest,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAppearance } from '@/components/providers/appearance-provider';
import { isColorMode, isInterfaceTheme, type InterfaceTheme } from '@/lib/appearance';

const fieldClassName =
    'h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] text-[var(--platform-ink)] shadow-none focus-visible:scale-100 focus-visible:ring-0 disabled:bg-[var(--platform-paper-strong)] disabled:text-[var(--platform-ink-muted)]';

const secondaryButtonClassName =
    'min-h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-4 text-[var(--platform-ink)] shadow-none hover:-translate-y-0.5 hover:bg-[var(--platform-paper-strong)] active:translate-y-0 active:scale-[0.98]';

const primaryButtonClassName =
    'min-h-11 rounded-none bg-[var(--platform-violet)] px-5 text-white shadow-[4px_4px_0_var(--platform-coral)] hover:-translate-y-0.5 hover:bg-[var(--platform-violet-strong)] active:translate-y-0 active:scale-[0.98] dark:text-[var(--platform-on-accent)]';

const SETTINGS_DRAFT_VERSION = 1;
const SETTINGS_DRAFT_PREFIX = 'mlcompete:settings-draft:';

function settingsDraftKey(accountId: string) {
    return `${SETTINGS_DRAFT_PREFIX}${accountId}`;
}

function readSettingsDraft(accountId: string): Partial<UserProfileSettingsUpdateRequest> | null {
    try {
        const stored = window.sessionStorage.getItem(settingsDraftKey(accountId));
        if (!stored) return null;

        const parsed: unknown = JSON.parse(stored);
        if (
            typeof parsed !== 'object' ||
            parsed === null ||
            !('version' in parsed) ||
            parsed.version !== SETTINGS_DRAFT_VERSION ||
            !('form' in parsed) ||
            typeof parsed.form !== 'object' ||
            parsed.form === null ||
            Array.isArray(parsed.form)
        ) {
            clearSettingsDraft(accountId);
            return null;
        }

        return parsed.form as Partial<UserProfileSettingsUpdateRequest>;
    } catch {
        clearSettingsDraft(accountId);
        return null;
    }
}

function clearSettingsDraft(accountId: string | null) {
    if (!accountId) return;

    try {
        window.sessionStorage.removeItem(settingsDraftKey(accountId));
    } catch {
        // Storage can be unavailable in hardened browser modes. The navigation
        // guard still protects the current editing session in that case.
    }
}

type SettingsPanelHeaderProps = {
    icon: LucideIcon;
    title: string;
    description: string;
};

function SettingsPanelHeader({ icon: Icon, title, description }: SettingsPanelHeaderProps) {
    return (
        <header className="flex items-start gap-4 border-b border-[var(--platform-line)] bg-[var(--platform-paper-strong)] px-4 py-5 sm:px-6 sm:py-6">
            <span className="grid h-11 w-11 shrink-0 place-items-center bg-[var(--platform-citron)] text-[var(--platform-on-accent)] shadow-[3px_3px_0_var(--platform-violet)]">
                <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-[-0.035em] text-[var(--platform-ink)] sm:text-2xl">
                    {title}
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--platform-ink-muted)]">
                    {description}
                </p>
            </div>
        </header>
    );
}

type PrivacyToggleRowProps = {
    id: string;
    label: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
};

function PrivacyToggleRow({
    id,
    label,
    description,
    checked,
    onCheckedChange,
}: PrivacyToggleRowProps) {
    const descriptionId = `${id}-description`;

    return (
        <div className="grid min-h-24 grid-cols-[minmax(0,1fr)_auto] items-center gap-5 border-b border-[var(--platform-line)] px-4 py-4 last:border-b-0 sm:px-6">
            <div className="min-w-0">
                <Label
                    htmlFor={id}
                    className="cursor-pointer text-sm font-semibold text-[var(--platform-ink)] sm:text-base"
                >
                    {label}
                </Label>
                <p
                    id={descriptionId}
                    className="mt-1 max-w-2xl text-sm leading-6 text-[var(--platform-ink-muted)]"
                >
                    {description}
                </p>
            </div>
            <span className="grid h-11 w-14 shrink-0 place-items-center">
                <Switch
                    id={id}
                    checked={checked}
                    onCheckedChange={onCheckedChange}
                    aria-describedby={descriptionId}
                    className="relative h-7 w-12 rounded-none border border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] after:absolute after:-inset-x-1 after:-inset-y-2 after:content-[''] data-[state=checked]:bg-[var(--platform-violet)] data-[state=unchecked]:bg-[var(--platform-paper-strong)] [&>span]:rounded-none [&>span]:bg-[var(--platform-paper)] data-[state=checked]:[&>span]:bg-[var(--platform-citron)]"
                />
            </span>
        </div>
    );
}

type SaveActionProps = {
    label: string;
    saving: boolean;
    succeeded: boolean;
    successLabel: string;
    savingLabel: string;
    dirty: boolean;
};

function SaveAction({
    label,
    saving,
    succeeded,
    successLabel,
    savingLabel,
    dirty,
}: SaveActionProps) {
    return (
        <Button
            type="submit"
            loading={saving}
            disabled={saving || !dirty}
            className={cn(primaryButtonClassName, 'w-full sm:w-auto')}
        >
            {!saving &&
                (succeeded ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                    <Save className="h-4 w-4" aria-hidden="true" />
                ))}
            <span aria-live="polite">
                {saving ? savingLabel : succeeded ? successLabel : label}
            </span>
        </Button>
    );
}

type ThemePreviewProps = {
    mode: 'light' | 'dark' | 'system';
};

function ThemePreview({ mode }: ThemePreviewProps) {
    if (mode === 'light') {
        return (
            <span className="relative grid h-20 w-full place-items-center overflow-hidden border border-[oklch(0.72_0.04_289)] bg-[oklch(0.978_0.014_292)] text-[oklch(0.36_0.22_291)]">
                <Sun className="h-7 w-7" aria-hidden="true" />
                <span className="absolute inset-x-3 bottom-3 h-1.5 bg-[oklch(0.43_0.235_291)]" />
            </span>
        );
    }

    if (mode === 'dark') {
        return (
            <span className="relative grid h-20 w-full place-items-center overflow-hidden border border-[oklch(0.42_0.055_287)] bg-[oklch(0.18_0.038_286)] text-[oklch(0.86_0.17_116)]">
                <Moon className="h-7 w-7" aria-hidden="true" />
                <span className="absolute inset-x-3 bottom-3 h-1.5 bg-[oklch(0.72_0.19_292)]" />
            </span>
        );
    }

    return (
        <span className="relative grid h-20 w-full place-items-center overflow-hidden border border-[var(--platform-line-strong)]">
            <span className="absolute inset-y-0 inset-inline-start-0 w-1/2 bg-[oklch(0.978_0.014_292)]" />
            <span className="absolute inset-y-0 inset-inline-end-0 w-1/2 bg-[oklch(0.18_0.038_286)]" />
            <span className="relative grid h-11 w-11 place-items-center bg-[var(--platform-citron)] text-[var(--platform-on-accent)] shadow-[3px_3px_0_var(--platform-violet)]">
                <MonitorCog className="h-5 w-5" aria-hidden="true" />
            </span>
        </span>
    );
}

type ThemeChoiceProps = {
    mode: 'light' | 'dark' | 'system';
    label: string;
    selected: boolean;
};

function ThemeChoice({ mode, label, selected }: ThemeChoiceProps) {
    return (
        <RadioGroupPrimitive.Item
            value={mode}
            className={cn(
                'group relative min-h-11 p-4 text-start transition-[background-color,transform] duration-200 focus-visible:outline-none active:scale-[0.98] disabled:cursor-wait disabled:opacity-65 sm:p-5',
                'border-b border-[var(--platform-line)] last:border-b-0 sm:border-b-0 sm:border-e sm:last:border-e-0',
                selected
                    ? 'bg-[var(--platform-paper-strong)]'
                    : 'bg-[var(--platform-paper)] hover:bg-[var(--platform-paper-strong)]',
            )}
        >
            <ThemePreview mode={mode} />
            <span className="mt-3 flex min-h-6 items-center justify-between gap-3 text-sm font-semibold text-[var(--platform-ink)]">
                <span>{label}</span>
                <span
                    className={cn(
                        'grid h-6 w-6 shrink-0 place-items-center border transition-colors',
                        selected
                            ? 'border-[var(--platform-violet)] bg-[var(--platform-violet)] text-white dark:text-[var(--platform-on-accent)]'
                            : 'border-[var(--platform-line-strong)] text-transparent',
                    )}
                    aria-hidden="true"
                >
                    <Check className="h-4 w-4" />
                </span>
            </span>
        </RadioGroupPrimitive.Item>
    );
}

type InterfaceThemePreviewProps = {
    theme: InterfaceTheme;
};

function InterfaceThemePreview({ theme }: InterfaceThemePreviewProps) {
    if (theme === 'plain') {
        return (
            <span
                data-ui-theme-preview="plain"
                className="ui-theme-preview relative block h-28 overflow-hidden rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900"
                aria-hidden="true"
            >
                <span className="flex h-4 items-center gap-1.5 border-b border-neutral-200 pb-2 dark:border-neutral-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ffdb4d]" />
                    <span className="h-2 w-8 rounded-full bg-neutral-800 dark:bg-neutral-200" />
                </span>
                <span className="mt-3 block h-2.5 w-2/3 rounded-full bg-[#2b7fb5] dark:bg-[#62a9dc]" />
                <span className="mt-3 flex gap-2 border-b border-neutral-200 dark:border-neutral-700">
                    <span className="h-1.5 w-8 rounded-full bg-[#2b7fb5]/70 dark:bg-[#62a9dc]/70" />
                    <span className="h-1.5 w-8 rounded-full border-b-2 border-neutral-800 bg-neutral-800 dark:border-neutral-200 dark:bg-neutral-200" />
                    <span className="h-1.5 w-8 rounded-full bg-[#2b7fb5]/70 dark:bg-[#62a9dc]/70" />
                </span>
                <span className="mt-2.5 block h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-700" />
                <span className="mt-1.5 block h-1.5 w-4/5 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            </span>
        );
    }

    if (theme === 'onia-v1') {
        return (
            <span
                data-ui-theme-preview="onia-v1"
                className="ui-theme-preview relative block h-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950"
                aria-hidden="true"
            >
                <span className="flex h-4 items-center gap-1.5 border-b border-slate-200 pb-2 dark:border-slate-700">
                    <span className="h-2 w-10 rounded-full bg-blue-600" />
                    <span className="ms-auto h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                </span>
                <span className="mt-3 grid grid-cols-[1.15fr_0.85fr] gap-2">
                    <span className="rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 p-2 shadow-sm">
                        <span className="block h-2 w-3/4 rounded-full bg-white/90" />
                        <span className="mt-2 block h-1.5 w-1/2 rounded-full bg-white/55" />
                        <span className="mt-4 block h-4 w-12 rounded-md bg-white/90" />
                    </span>
                    <span className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <span className="block h-2 w-3/4 rounded-full bg-slate-700 dark:bg-slate-200" />
                        <span className="mt-2 block h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
                        <span className="mt-1.5 block h-1.5 w-2/3 rounded-full bg-slate-200 dark:bg-slate-700" />
                    </span>
                </span>
            </span>
        );
    }

    return (
        <span
            data-ui-theme-preview="onia-v2"
            className="ui-theme-preview relative block h-28 overflow-hidden border border-[oklch(0.62_0.06_287)] bg-[oklch(0.978_0.014_292)] p-3 shadow-[4px_4px_0_oklch(0.79_0.04_289)] dark:border-[oklch(0.5_0.07_287)] dark:bg-[oklch(0.18_0.038_286)]"
            aria-hidden="true"
        >
            <span className="flex h-4 items-center border-b-2 border-[oklch(0.43_0.235_291)] pb-2 dark:border-[oklch(0.72_0.19_292)]">
                <span className="h-2 w-10 bg-[oklch(0.43_0.235_291)] dark:bg-[oklch(0.72_0.19_292)]" />
                <span className="ms-auto h-2 w-2 bg-[oklch(0.72_0.18_32)]" />
            </span>
            <span className="mt-3 grid grid-cols-[1.15fr_0.85fr] gap-2">
                <span className="bg-[oklch(0.43_0.235_291)] p-2 shadow-[3px_3px_0_oklch(0.89_0.185_116)]">
                    <span className="block h-2 w-3/4 bg-[oklch(0.978_0.014_292)]" />
                    <span className="mt-2 block h-1.5 w-1/2 bg-[oklch(0.978_0.014_292/0.55)]" />
                    <span className="mt-4 block h-4 w-12 bg-[oklch(0.89_0.185_116)]" />
                </span>
                <span className="border border-[oklch(0.62_0.06_287)] bg-[oklch(0.952_0.026_292)] p-2 dark:border-[oklch(0.5_0.07_287)] dark:bg-[oklch(0.215_0.046_286)]">
                    <span className="block h-2 w-3/4 bg-[oklch(0.22_0.055_282)] dark:bg-[oklch(0.94_0.016_292)]" />
                    <span className="mt-2 block h-1.5 w-full bg-[oklch(0.79_0.04_289)] dark:bg-[oklch(0.34_0.055_287)]" />
                    <span className="mt-1.5 block h-1.5 w-2/3 bg-[oklch(0.79_0.04_289)] dark:bg-[oklch(0.34_0.055_287)]" />
                </span>
            </span>
        </span>
    );
}

const INTERFACE_THEME_ICONS: Record<InterfaceTheme, LucideIcon> = {
    'onia-v2': Sparkles,
    'onia-v1': LayoutTemplate,
    plain: Terminal,
};

type InterfaceThemeChoiceProps = {
    theme: InterfaceTheme;
    label: string;
    description: string;
    selected: boolean;
};

function InterfaceThemeChoice({ theme, label, description, selected }: InterfaceThemeChoiceProps) {
    const descriptionId = `interface-theme-${theme}-description`;
    const Icon = INTERFACE_THEME_ICONS[theme];

    return (
        <RadioGroupPrimitive.Item
            value={theme}
            aria-describedby={descriptionId}
            className={cn(
                'group min-h-11 p-4 text-start transition-[background-color,transform] duration-200 focus-visible:outline-none active:scale-[0.99] disabled:cursor-wait disabled:opacity-65 sm:p-5',
                'border-b border-[var(--platform-line)] last:border-b-0 sm:border-b-0 sm:border-e sm:last:border-e-0',
                selected
                    ? 'bg-[var(--platform-paper-strong)]'
                    : 'bg-[var(--platform-paper)] hover:bg-[var(--platform-paper-strong)]',
            )}
        >
            <InterfaceThemePreview theme={theme} />
            <span className="mt-4 flex items-start gap-3">
                <span
                    className={cn(
                        'mt-0.5 grid h-7 w-7 shrink-0 place-items-center border transition-colors',
                        selected
                            ? 'border-[var(--platform-violet)] bg-[var(--platform-violet)] text-white dark:text-[var(--platform-on-accent)]'
                            : 'border-[var(--platform-line-strong)] text-[var(--platform-ink-muted)]',
                    )}
                    aria-hidden="true"
                >
                    {selected ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                    <span className="block font-semibold text-[var(--platform-ink)]">{label}</span>
                    <span
                        id={descriptionId}
                        className="mt-1 block text-sm leading-6 text-[var(--platform-ink-muted)]"
                    >
                        {description}
                    </span>
                </span>
            </span>
        </RadioGroupPrimitive.Item>
    );
}

function SettingsLoadingState({ label }: { label: string }) {
    return (
        <PlatformPageShell contentClassName="space-y-8 md:space-y-10" aria-busy="true">
            <span className="sr-only" role="status">
                {label}
            </span>
            <div className="border-b border-[var(--platform-line-strong)] pb-8 md:pb-12">
                <Skeleton className="h-4 w-28 rounded-none bg-[var(--platform-paper-strong)]" />
                <Skeleton className="mt-5 h-12 w-64 max-w-full rounded-none bg-[var(--platform-paper-strong)] sm:h-16" />
                <Skeleton className="mt-5 h-5 w-full max-w-xl rounded-none bg-[var(--platform-paper-strong)]" />
            </div>
            <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
                <div className="platform-panel grid grid-cols-3 gap-2 p-2 lg:flex lg:flex-col">
                    {[0, 1, 2].map((item) => (
                        <Skeleton
                            key={item}
                            className="h-12 rounded-none bg-[var(--platform-paper-strong)]"
                        />
                    ))}
                </div>
                <div className="platform-panel overflow-hidden">
                    <div className="border-b border-[var(--platform-line)] bg-[var(--platform-paper-strong)] p-6">
                        <Skeleton className="h-7 w-48 rounded-none" />
                        <Skeleton className="mt-3 h-4 w-full max-w-lg rounded-none" />
                    </div>
                    <div className="grid gap-5 p-6 sm:grid-cols-2">
                        {[0, 1, 2, 3, 4, 5].map((item) => (
                            <div key={item}>
                                <Skeleton className="h-4 w-24 rounded-none" />
                                <Skeleton className="mt-2 h-11 w-full rounded-none" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </PlatformPageShell>
    );
}

export function SettingsView() {
    const t = useTranslations('settings');
    const tCommon = useTranslations('common');
    const tAuth = useTranslations('auth');
    const locale = useLocale();
    const router = useRouter();
    const {
        uiTheme,
        colorMode,
        setInterfaceTheme,
        setColorMode,
        syncStatus: appearanceSyncStatus,
    } = useAppearance();
    const [saving, setSaving] = useState(false);
    const [saveSucceeded, setSaveSucceeded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [avatarRemoving, setAvatarRemoving] = useState(false);
    const [avatarRemoveError, setAvatarRemoveError] = useState<string | null>(null);
    const [avatarRemoveConfirmOpen, setAvatarRemoveConfirmOpen] = useState(false);
    const [countries, setCountries] = useState<Country[]>([]);
    const [countriesLoading, setCountriesLoading] = useState(true);
    const [countriesError, setCountriesError] = useState<string | null>(null);
    const [institutionCountryCode, setInstitutionCountryCode] = useState<string | null>(null);
    const [usernameSuggestion, setUsernameSuggestion] = useState<string | null>(null);
    const [loadTimedOut, setLoadTimedOut] = useState(false);
    const [countryLoadAttempt, setCountryLoadAttempt] = useState(0);
    const [activeTab, setActiveTab] = useState('profile');
    const [pendingTab, setPendingTab] = useState<string | null>(null);
    const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
    const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
    const { trackProfile } = useGTMTracker();
    const {
        refetch: refetchUser,
        user,
        isLoading,
        error: currentUserError,
        status,
        sessionId,
    } = useCurrentUser();

    const initialFormRef = useRef<UserProfileSettingsUpdateRequest | null>(null);
    const [form, setForm] = useState<UserProfileSettingsUpdateRequest | null>(null);
    const [formAccountId, setFormAccountId] = useState<string | null>(null);
    const isDirty = useMemo(() => {
        if (!form || !initialFormRef.current) return false;
        return JSON.stringify(form) !== JSON.stringify(initialFormRef.current);
    }, [form]);

    useEffect(() => {
        if (status === 'unauthenticated') {
            clearSettingsDraft(formAccountId);
            initialFormRef.current = null;
            setForm(null);
            setFormAccountId(null);
            setInstitutionCountryCode(null);
            setUsernameSuggestion(null);
            setLoadTimedOut(false);
            return;
        }

        if (!isLoading && user !== null && sessionId && formAccountId !== sessionId) {
            if (formAccountId && formAccountId !== sessionId) {
                clearSettingsDraft(formAccountId);
            }
            const initialForm = { ...user };
            initialFormRef.current = initialForm;
            const draft = readSettingsDraft(sessionId);
            setForm(draft ? { ...initialForm, ...draft } : initialForm);
            setFormAccountId(sessionId);
            setInstitutionCountryCode(user.institutionCountryCode ?? null);
            setUsernameSuggestion(null);
            setError(null);
            setLoadTimedOut(false);
        }
    }, [formAccountId, isLoading, sessionId, status, user]);

    useEffect(() => {
        if (!form || !formAccountId || formAccountId !== sessionId) return;

        try {
            if (isDirty) {
                window.sessionStorage.setItem(
                    settingsDraftKey(formAccountId),
                    JSON.stringify({ version: SETTINGS_DRAFT_VERSION, form }),
                );
            } else {
                window.sessionStorage.removeItem(settingsDraftKey(formAccountId));
            }
        } catch {
            // The visible navigation guard and beforeunload prompt remain active
            // when session storage is unavailable.
        }
    }, [form, formAccountId, isDirty, sessionId]);

    useEffect(() => {
        setLoadTimedOut(false);
        setSaveSucceeded(false);
    }, [sessionId]);

    useEffect(() => {
        if (!saveSucceeded) return;

        const timer = window.setTimeout(() => setSaveSucceeded(false), 4000);
        return () => window.clearTimeout(timer);
    }, [saveSucceeded]);

    useEffect(() => {
        const hasCurrentAccountForm = form !== null && formAccountId === sessionId;
        if (
            hasCurrentAccountForm ||
            status === 'unauthenticated' ||
            currentUserError ||
            loadTimedOut
        )
            return;

        const timer = window.setTimeout(() => setLoadTimedOut(true), 12000);
        return () => window.clearTimeout(timer);
    }, [currentUserError, form, formAccountId, loadTimedOut, sessionId, status]);

    useEffect(() => {
        if (!isDirty) return;

        const protectUnsavedChanges = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', protectUnsavedChanges);
        return () => window.removeEventListener('beforeunload', protectUnsavedChanges);
    }, [isDirty]);

    useEffect(() => {
        if (!isDirty) return;

        const protectClientNavigation = (event: MouseEvent) => {
            if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }

            const target = event.target;
            if (!(target instanceof Element)) return;

            const anchor = target.closest<HTMLAnchorElement>('a[href]');
            if (!anchor || anchor.download || (anchor.target && anchor.target !== '_self')) return;

            const destination = new URL(anchor.href, window.location.href);
            if (destination.origin !== window.location.origin) return;

            const currentRoute = `${window.location.pathname}${window.location.search}`;
            const nextRoute = `${destination.pathname}${destination.search}`;
            if (nextRoute === currentRoute) return;

            event.preventDefault();
            setPendingTab(null);
            setPendingNavigation(`${nextRoute}${destination.hash}`);
            setDiscardDialogOpen(true);
        };

        document.addEventListener('click', protectClientNavigation, true);
        return () => document.removeEventListener('click', protectClientNavigation, true);
    }, [isDirty]);

    useEffect(() => {
        const loadCountries = async () => {
            setCountriesLoading(true);
            setCountriesError(null);
            try {
                const resp = await fetchApi(`${process.env.NEXT_PUBLIC_API_BASE_URL}/countries`);
                if (!resp.ok) throw new Error('countries-request-failed');
                const data: Country[] = await resp.json();
                setCountries(data);
            } catch (loadError) {
                console.error(loadError);
                setCountriesError(t('errorLoadingCountries'));
            } finally {
                setCountriesLoading(false);
            }
        };
        void loadCountries();
    }, [countryLoadAttempt, t]);

    function updateForm(patch: Partial<UserProfileSettingsUpdateRequest>) {
        setError(null);
        setSaveSucceeded(false);
        setForm((previous) => (previous ? { ...previous, ...patch } : previous));
    }

    async function uploadAvatar(dataUrl: string) {
        try {
            setAvatarUploading(true);
            setError(null);
            const resp = await fetchApi(`${process.env.NEXT_PUBLIC_API_BASE_URL}/profile/avatar`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ avatar: dataUrl }),
            });
            if (!resp.ok) throw new Error(t('errorUploadingAvatar'));
            const data = await resp.json();
            setForm((previous) => (previous ? { ...previous, avatar: data.avatar } : previous));
            if (initialFormRef.current) {
                initialFormRef.current = { ...initialFormRef.current, avatar: data.avatar };
            }
            setAvatarDialogOpen(false);

            await refetchUser();

            trackProfile('avatar_change', {
                action: 'upload',
            });
        } catch (uploadError: any) {
            console.error(uploadError);
            setError(uploadError?.message ?? t('errorUploadingAvatar'));
        } finally {
            setAvatarUploading(false);
        }
    }

    async function removeAvatar() {
        try {
            setAvatarRemoving(true);
            setAvatarRemoveError(null);
            setError(null);
            const resp = await fetchApi(`${process.env.NEXT_PUBLIC_API_BASE_URL}/profile/avatar`, {
                method: 'DELETE',
            });
            if (!resp.ok) throw new Error(t('errorRemovingAvatar'));
            setForm((previous) => (previous ? { ...previous, avatar: '' } : previous));
            if (initialFormRef.current) {
                initialFormRef.current = { ...initialFormRef.current, avatar: '' };
            }
            setAvatarRemoveConfirmOpen(false);

            await refetchUser();

            trackProfile('avatar_change', {
                action: 'remove',
            });
        } catch (removeError: any) {
            console.error(removeError);
            setAvatarRemoveError(removeError?.message ?? t('errorRemovingAvatar'));
        } finally {
            setAvatarRemoving(false);
        }
    }

    function handleUsernameChange(newUsername: string) {
        updateForm({ username: newUsername });

        const originalUsername = initialFormRef.current?.username || '';
        if (
            newUsername &&
            newUsername !== originalUsername &&
            !isUsernameSlugFriendly(newUsername)
        ) {
            const slug = toProfileSlug(newUsername);
            if (slug && slug !== newUsername.toLowerCase()) {
                setUsernameSuggestion(slug);
            } else {
                setUsernameSuggestion(null);
            }
        } else {
            setUsernameSuggestion(null);
        }
    }

    function applyUsernameSuggestion() {
        if (usernameSuggestion) {
            updateForm({ username: usernameSuggestion });
            setUsernameSuggestion(null);
        }
    }

    async function handleSave() {
        try {
            if (form === null) return;

            setSaving(true);
            setSaveSucceeded(false);
            setError(null);

            const originalUsername = initialFormRef.current?.username || '';
            if (form.username && form.username !== originalUsername) {
                if (!isUsernameSlugFriendly(form.username)) {
                    const slug = toProfileSlug(form.username);
                    setError(t('usernameInvalid', { suggestion: slug }));
                    return;
                }
            }

            const changedFields: string[] = [];
            if (initialFormRef.current) {
                const initial = initialFormRef.current;
                if (form.username !== initial.username) changedFields.push('username');
                if (form.firstName !== initial.firstName) changedFields.push('firstName');
                if (form.lastName !== initial.lastName) changedFields.push('lastName');
                if (form.location !== initial.location) changedFields.push('location');
                if (form.website !== initial.website) changedFields.push('website');
                if (form.github !== initial.github) changedFields.push('github');
                if (form.bio !== initial.bio) changedFields.push('bio');
                if (form.countryCode !== initial.countryCode) changedFields.push('country');
                if (form.isPublic !== initial.isPublic) changedFields.push('isPublic');
                if (form.visibleInLeaderboards !== initial.visibleInLeaderboards)
                    changedFields.push('visibleInLeaderboards');
                if (form.publicSubmissionHistory !== initial.publicSubmissionHistory)
                    changedFields.push('publicSubmissionHistory');
                if (form.emailPublic !== initial.emailPublic) changedFields.push('emailPublic');
                if (form.namePublic !== initial.namePublic) changedFields.push('namePublic');
                if (form.consentGeneralAnouncements !== initial.consentGeneralAnouncements)
                    changedFields.push('consentGeneralAnouncements');
                if (form.consentOlympiadAnouncements !== initial.consentOlympiadAnouncements)
                    changedFields.push('consentOlympiadAnouncements');
            }

            const resp = await fetchApi(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/profile/settings`,
                {
                    method: 'PUT',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(form),
                },
            );
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}));
                throw new Error(data.message || t('errorSavingSettings'));
            }

            const saved: UserProfileSettingsResponse = await resp.json();
            setForm(saved);
            setFormAccountId(sessionId);
            initialFormRef.current = { ...saved };
            setInstitutionCountryCode(saved.institutionCountryCode ?? null);

            await refetchUser();

            if (changedFields.length > 0) {
                trackProfile('settings_update', {
                    changedFields: changedFields.join(','),
                    changedFieldCount: changedFields.length,
                });
            }

            setSaveSucceeded(true);
        } catch (saveError: any) {
            console.error(saveError);
            setError(saveError?.message ?? t('errorSavingSettings'));
        } finally {
            setSaving(false);
        }
    }

    const hasCurrentAccountForm = form !== null && formAccountId === sessionId;

    if (!hasCurrentAccountForm && status === 'unauthenticated') {
        return (
            <PlatformPageShell contentClassName="space-y-8 md:space-y-10">
                <PlatformPageHeader
                    eyebrow={tCommon('appName')}
                    icon={Settings2}
                    title={t('title')}
                    description={t('subtitle')}
                />
                <PlatformEmptyState
                    icon={LogIn}
                    title={tAuth('authentication')}
                    description={t('subtitle')}
                    action={
                        <Button asChild className={primaryButtonClassName}>
                            <Link href="/login">
                                <LogIn className="h-4 w-4" aria-hidden="true" />
                                {tAuth('signIn')}
                            </Link>
                        </Button>
                    }
                />
            </PlatformPageShell>
        );
    }

    if (!hasCurrentAccountForm && (currentUserError || loadTimedOut)) {
        return (
            <PlatformPageShell contentClassName="space-y-8 md:space-y-10">
                <PlatformPageHeader
                    eyebrow={tCommon('appName')}
                    icon={Settings2}
                    title={t('title')}
                    description={t('subtitle')}
                />
                <PlatformEmptyState
                    icon={AlertCircle}
                    title={t('errorLoadingSettings')}
                    action={
                        <Button
                            type="button"
                            className={primaryButtonClassName}
                            loading={isLoading}
                            onClick={() => {
                                setLoadTimedOut(false);
                                void refetchUser();
                            }}
                        >
                            {!isLoading && <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                            {tCommon('retry')}
                        </Button>
                    }
                />
            </PlatformPageShell>
        );
    }

    if (!hasCurrentAccountForm || form === null) {
        return <SettingsLoadingState label={tCommon('loadingSettings')} />;
    }

    const activeTheme = colorMode;
    const activeThemeLabel =
        activeTheme === 'light'
            ? t('themeLight')
            : activeTheme === 'dark'
              ? t('themeDark')
              : t('themeSystem');
    const themeAppliedText = t('themeApplied').replace(/^✅\s*/, '');

    return (
        <PlatformPageShell contentClassName="space-y-8 md:space-y-10">
            <PlatformPageHeader
                eyebrow={tCommon('appName')}
                icon={Settings2}
                title={t('title')}
                description={t('subtitle')}
                aside={
                    <div className="platform-panel flex w-full items-center gap-3 bg-[var(--platform-paper)] p-3 sm:w-auto sm:min-w-72">
                        <UserAvatar
                            avatar={form.avatar}
                            userId={sessionId}
                            username={form.username}
                            firstName={form.firstName}
                            lastName={form.lastName}
                            loading="eager"
                            className="h-12 w-12 rounded-none border border-[var(--platform-line-strong)]"
                            imageClassName="rounded-none"
                            fallbackClassName="rounded-none font-bold"
                        />
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--platform-violet)]">
                                {t('profile')}
                            </p>
                            <p
                                className="mt-1 truncate text-sm font-semibold text-[var(--platform-ink)]"
                                dir="auto"
                            >
                                {form.username}
                            </p>
                        </div>
                    </div>
                }
            />

            <div aria-live="polite" aria-atomic="true">
                {error && (
                    <div
                        role="alert"
                        className="flex items-start gap-3 border border-[var(--platform-coral)] bg-[color-mix(in_oklch,var(--platform-coral)_12%,var(--platform-paper))] px-4 py-3 text-sm leading-6 text-[var(--platform-ink)]"
                    >
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--platform-coral)]" />
                        <span>{error}</span>
                    </div>
                )}
                {!error && saveSucceeded && (
                    <div
                        role="status"
                        className="flex items-center gap-3 border border-[var(--platform-violet)] bg-[color-mix(in_oklch,var(--platform-citron)_18%,var(--platform-paper))] px-4 py-3 text-sm font-semibold text-[var(--platform-ink)]"
                    >
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--platform-violet)]" />
                        <span>{tCommon('success')}</span>
                    </div>
                )}
            </div>

            <Tabs
                value={activeTab}
                onValueChange={(nextTab) => {
                    if (!isDirty) {
                        setActiveTab(nextTab);
                        return;
                    }
                    setPendingTab(nextTab);
                    setDiscardDialogOpen(true);
                }}
                className="grid min-w-0 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start"
            >
                <TabsList className="platform-panel !grid h-auto w-full grid-cols-3 items-stretch gap-2 rounded-none bg-[var(--platform-paper)] p-2 text-[var(--platform-ink-muted)] lg:sticky lg:top-24 lg:!flex lg:flex-col">
                    <TabsTrigger
                        value="profile"
                        className="min-h-12 justify-center gap-2 rounded-none px-3 py-2 text-xs shadow-none transition-[background-color,color,transform] active:scale-[0.98] data-[state=active]:bg-[var(--platform-violet)] data-[state=active]:text-white data-[state=active]:shadow-[3px_3px_0_var(--platform-coral)] dark:data-[state=active]:text-[var(--platform-on-accent)] sm:text-sm lg:w-full lg:justify-start"
                    >
                        <UserRound className="h-4 w-4" aria-hidden="true" />
                        <span>{t('profile')}</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="privacy"
                        className="min-h-12 justify-center gap-2 rounded-none px-3 py-2 text-xs shadow-none transition-[background-color,color,transform] active:scale-[0.98] data-[state=active]:bg-[var(--platform-violet)] data-[state=active]:text-white data-[state=active]:shadow-[3px_3px_0_var(--platform-coral)] dark:data-[state=active]:text-[var(--platform-on-accent)] sm:text-sm lg:w-full lg:justify-start"
                    >
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        <span>{t('privacy')}</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="appearance"
                        className="min-h-12 justify-center gap-2 rounded-none px-3 py-2 text-xs shadow-none transition-[background-color,color,transform] active:scale-[0.98] data-[state=active]:bg-[var(--platform-violet)] data-[state=active]:text-white data-[state=active]:shadow-[3px_3px_0_var(--platform-coral)] dark:data-[state=active]:text-[var(--platform-on-accent)] sm:text-sm lg:w-full lg:justify-start"
                    >
                        <Palette className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">{t('appearance')}</span>
                        <span className="sm:hidden">{t('theme')}</span>
                    </TabsTrigger>
                </TabsList>

                <div className="min-w-0">
                    <TabsContent value="profile" className="mt-0">
                        <form
                            className="platform-panel overflow-hidden"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void handleSave();
                            }}
                        >
                            <SettingsPanelHeader
                                icon={UserRound}
                                title={t('profileInfo')}
                                description={t('profileInfoDesc')}
                            />

                            <div className="grid gap-5 border-b border-[var(--platform-line)] bg-[color-mix(in_oklch,var(--platform-citron)_10%,var(--platform-paper))] p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-6 sm:p-6">
                                <UserAvatar
                                    avatar={form.avatar}
                                    userId={sessionId}
                                    username={form.username}
                                    firstName={form.firstName}
                                    lastName={form.lastName}
                                    loading="eager"
                                    className="h-24 w-24 rounded-none border border-[var(--platform-line-strong)] shadow-[5px_5px_0_var(--platform-violet)]"
                                    imageClassName="rounded-none"
                                    fallbackClassName="rounded-none text-2xl font-bold"
                                />
                                <div className="min-w-0">
                                    <p
                                        className="font-semibold text-[var(--platform-ink)]"
                                        dir="auto"
                                    >
                                        {form.username}
                                    </p>
                                    {!form.avatar && (
                                        <p className="mt-1 text-sm text-[var(--platform-ink-muted)]">
                                            {t('noAvatar')}
                                        </p>
                                    )}
                                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={secondaryButtonClassName}
                                            onClick={() => setAvatarDialogOpen(true)}
                                        >
                                            <ImagePlus className="h-4 w-4" aria-hidden="true" />
                                            {t('changeAvatar')}
                                        </Button>
                                        {form.avatar && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={cn(
                                                    secondaryButtonClassName,
                                                    'border-[var(--platform-coral)] text-[var(--platform-ink)] hover:bg-[color-mix(in_oklch,var(--platform-coral)_12%,var(--platform-paper))]',
                                                )}
                                                loading={avatarRemoving}
                                                disabled={avatarRemoving}
                                                onClick={() => {
                                                    setAvatarRemoveError(null);
                                                    setAvatarRemoveConfirmOpen(true);
                                                }}
                                            >
                                                {!avatarRemoving && (
                                                    <Trash2
                                                        className="h-4 w-4"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                {avatarRemoving
                                                    ? t('removingAvatar')
                                                    : t('removeAvatar')}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Dialog
                                open={avatarDialogOpen}
                                onOpenChange={(open) => {
                                    if (!avatarUploading) setAvatarDialogOpen(open);
                                }}
                            >
                                <DialogContent
                                    className={cn(
                                        platformSans.className,
                                        'platform-overlay-surface max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto rounded-none border-2 border-[oklch(0.62_0.06_287)] bg-[oklch(0.978_0.014_292)] text-[oklch(0.22_0.055_282)] shadow-[8px_8px_0_oklch(0.43_0.235_291/0.24)] dark:border-[oklch(0.5_0.07_287)] dark:bg-[oklch(0.18_0.038_286)] dark:text-[oklch(0.94_0.016_292)] sm:rounded-none',
                                    )}
                                >
                                    <DialogHeader>
                                        <DialogTitle>{t('selectAvatar')}</DialogTitle>
                                        <DialogDescription className="text-[oklch(0.46_0.044_282)] dark:text-[oklch(0.73_0.034_290)]">
                                            {t('selectAvatarDesc')}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <AvatarCropper
                                        initialImageUrl={form.avatar || null}
                                        confirming={avatarUploading}
                                        labels={{
                                            selectImage: t('selectAvatar'),
                                            empty: t('noAvatar'),
                                            zoom: t('avatarZoom'),
                                            cancel: tCommon('cancel'),
                                            confirm: tCommon('confirm'),
                                            confirming: tCommon('saving'),
                                            preview: t('avatarPreview'),
                                            position: t('avatarPosition'),
                                            moveUp: t('avatarMoveUp'),
                                            moveDown: t('avatarMoveDown'),
                                            moveLeft: t('avatarMoveLeft'),
                                            moveRight: t('avatarMoveRight'),
                                            resetPosition: t('avatarResetPosition'),
                                            invalidType: t('avatarInvalidType'),
                                            tooLarge: t('avatarTooLarge', { size: 10 }),
                                            loadError: t('avatarLoadError'),
                                        }}
                                        onCancel={() => setAvatarDialogOpen(false)}
                                        onConfirm={async (dataUrl) => {
                                            if (avatarUploading) return;
                                            await uploadAvatar(dataUrl);
                                        }}
                                    />
                                </DialogContent>
                            </Dialog>

                            <div className="space-y-6 px-4 py-6 sm:px-6 sm:py-7">
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="username">{t('username')}</Label>
                                        <Input
                                            id="username"
                                            name="username"
                                            className={fieldClassName}
                                            value={form.username || ''}
                                            aria-describedby={
                                                usernameSuggestion
                                                    ? 'username-suggestion'
                                                    : undefined
                                            }
                                            onChange={(event) =>
                                                handleUsernameChange(event.target.value)
                                            }
                                        />
                                        {usernameSuggestion && (
                                            <p
                                                id="username-suggestion"
                                                className="text-sm leading-6 text-[var(--platform-ink-muted)]"
                                            >
                                                {t('usernameSuggestion')}{' '}
                                                <button
                                                    type="button"
                                                    onClick={applyUsernameSuggestion}
                                                    className="inline-flex min-h-11 items-center font-semibold text-[var(--platform-violet-strong)] underline decoration-[var(--platform-coral)] decoration-2 underline-offset-4 hover:no-underline dark:text-[var(--platform-violet)]"
                                                >
                                                    {usernameSuggestion}
                                                </button>
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">{t('email')}</Label>
                                        <Input
                                            id="email"
                                            name="email"
                                            type="email"
                                            disabled
                                            className={fieldClassName}
                                            value={form.email || ''}
                                            onChange={(event) =>
                                                updateForm({ email: event.target.value })
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="firstName">{t('firstName')}</Label>
                                        <Input
                                            id="firstName"
                                            name="firstName"
                                            className={fieldClassName}
                                            value={form.firstName || ''}
                                            onChange={(event) =>
                                                updateForm({ firstName: event.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="lastName">{t('lastName')}</Label>
                                        <Input
                                            id="lastName"
                                            name="lastName"
                                            className={fieldClassName}
                                            value={form.lastName || ''}
                                            onChange={(event) =>
                                                updateForm({ lastName: event.target.value })
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="location">{t('location')}</Label>
                                        <Input
                                            id="location"
                                            name="location"
                                            className={fieldClassName}
                                            value={form.location || ''}
                                            onChange={(event) =>
                                                updateForm({ location: event.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="website">{t('website')}</Label>
                                        <Input
                                            id="website"
                                            name="website"
                                            className={fieldClassName}
                                            value={form.website || ''}
                                            onChange={(event) =>
                                                updateForm({ website: event.target.value })
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="github">{t('github')}</Label>
                                    <Input
                                        id="github"
                                        name="github"
                                        className={fieldClassName}
                                        placeholder={t('githubPlaceholder')}
                                        value={form.github || ''}
                                        onChange={(event) =>
                                            updateForm({ github: event.target.value })
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="bio">{t('bio')}</Label>
                                    <Textarea
                                        id="bio"
                                        name="bio"
                                        className="min-h-32 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] text-[var(--platform-ink)] shadow-none focus-visible:scale-100 focus-visible:ring-0"
                                        value={form.bio || ''}
                                        onChange={(event) =>
                                            updateForm({ bio: event.target.value })
                                        }
                                        rows={4}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="country">{t('country')}</Label>
                                    <CountrySelector
                                        id="country"
                                        value={form.countryCode}
                                        onChange={(code) => updateForm({ countryCode: code })}
                                        countries={countries}
                                        placeholder={t('selectCountry')}
                                        showClear
                                        loading={countriesLoading}
                                        error={countriesError || undefined}
                                        loadingText={tCommon('loading')}
                                        clearLabel={t('clearCountry')}
                                        searchPlaceholder={t('searchCountries')}
                                        emptyText={t('noCountryFound')}
                                        locale={locale}
                                        className="[&_button[role=combobox]]:h-11 [&_button[role=combobox]]:rounded-none [&_button[role=combobox]]:border-[var(--platform-line-strong)] [&_button[role=combobox]]:bg-[var(--platform-paper)] [&_button[role=combobox]]:text-[var(--platform-ink)]"
                                    />
                                    {countriesError && !countriesLoading ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={cn(secondaryButtonClassName, 'mt-3')}
                                            onClick={() =>
                                                setCountryLoadAttempt((attempt) => attempt + 1)
                                            }
                                        >
                                            <RefreshCw className="h-4 w-4" aria-hidden="true" />
                                            {tCommon('retry')}
                                        </Button>
                                    ) : null}
                                    {institutionCountryCode &&
                                        form.countryCode !== institutionCountryCode && (
                                            <p className="text-sm leading-6 text-[var(--platform-ink-muted)]">
                                                {t('institutionCountryInfo', {
                                                    country:
                                                        countries.find(
                                                            (country) =>
                                                                country.code ===
                                                                institutionCountryCode,
                                                        )?.name || institutionCountryCode,
                                                })}
                                            </p>
                                        )}
                                </div>
                            </div>

                            <div className="flex justify-end border-t border-[var(--platform-line)] bg-[var(--platform-paper-strong)] p-4 sm:p-6">
                                <SaveAction
                                    label={t('saveChanges')}
                                    saving={saving}
                                    succeeded={saveSucceeded}
                                    successLabel={tCommon('success')}
                                    savingLabel={tCommon('saving')}
                                    dirty={isDirty}
                                />
                            </div>
                        </form>
                    </TabsContent>

                    <TabsContent value="privacy" className="mt-0">
                        <form
                            className="platform-panel overflow-hidden"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void handleSave();
                            }}
                        >
                            <SettingsPanelHeader
                                icon={ShieldCheck}
                                title={t('privacySettings')}
                                description={t('privacySettingsDesc')}
                            />

                            <div>
                                <PrivacyToggleRow
                                    id="isPublic"
                                    label={t('publicProfile')}
                                    description={t('publicProfileDesc')}
                                    checked={!!form.isPublic}
                                    onCheckedChange={(checked) => updateForm({ isPublic: checked })}
                                />
                                <PrivacyToggleRow
                                    id="visibleInLeaderboards"
                                    label={t('showInLeaderboard')}
                                    description={t('showInLeaderboardDesc')}
                                    checked={!!form.visibleInLeaderboards}
                                    onCheckedChange={(checked) =>
                                        updateForm({ visibleInLeaderboards: checked })
                                    }
                                />
                                <PrivacyToggleRow
                                    id="publicSubmissionHistory"
                                    label={t('shareSubmissionHistory')}
                                    description={t('shareSubmissionHistoryDesc')}
                                    checked={!!form.publicSubmissionHistory}
                                    onCheckedChange={(checked) =>
                                        updateForm({ publicSubmissionHistory: checked })
                                    }
                                />
                                <PrivacyToggleRow
                                    id="emailPublic"
                                    label={t('publicEmail')}
                                    description={t('publicEmailDesc')}
                                    checked={!!form.emailPublic}
                                    onCheckedChange={(checked) =>
                                        updateForm({ emailPublic: checked })
                                    }
                                />
                                <PrivacyToggleRow
                                    id="namePublic"
                                    label={t('publicName')}
                                    description={t('publicNameDesc')}
                                    checked={!!form.namePublic}
                                    onCheckedChange={(checked) =>
                                        updateForm({ namePublic: checked })
                                    }
                                />
                                <PrivacyToggleRow
                                    id="consentGeneralAnouncements"
                                    label={t('consentGeneralAnouncements')}
                                    description={t('consentGeneralAnouncementsDesc')}
                                    checked={!!form.consentGeneralAnouncements}
                                    onCheckedChange={(checked) =>
                                        updateForm({ consentGeneralAnouncements: checked })
                                    }
                                />
                                <PrivacyToggleRow
                                    id="consentOlympiadAnouncements"
                                    label={t('consentOlympiadAnouncements')}
                                    description={t('consentOlympiadAnouncementsDesc')}
                                    checked={!!form.consentOlympiadAnouncements}
                                    onCheckedChange={(checked) =>
                                        updateForm({ consentOlympiadAnouncements: checked })
                                    }
                                />
                            </div>

                            <div className="flex justify-end border-t border-[var(--platform-line)] bg-[var(--platform-paper-strong)] p-4 sm:p-6">
                                <SaveAction
                                    label={t('updatePrivacySettings')}
                                    saving={saving}
                                    succeeded={saveSucceeded}
                                    successLabel={tCommon('success')}
                                    savingLabel={tCommon('saving')}
                                    dirty={isDirty}
                                />
                            </div>
                        </form>
                    </TabsContent>

                    <TabsContent value="appearance" className="mt-0">
                        <section className="platform-panel overflow-hidden">
                            <SettingsPanelHeader
                                icon={Palette}
                                title={t('appearanceSettings')}
                                description={t('appearanceSettingsDesc')}
                            />

                            <div className="space-y-6 p-4 sm:p-6">
                                <div>
                                    <h3 className="text-sm font-semibold text-[var(--platform-ink)]">
                                        {t('interfaceStyleLabel')}
                                    </h3>
                                    <p className="mt-1 text-sm leading-6 text-[var(--platform-ink-muted)]">
                                        {t('interfaceStyleDescription')}
                                    </p>
                                </div>

                                <RadioGroupPrimitive.Root
                                    aria-label={t('interfaceStyleLabel')}
                                    aria-busy={appearanceSyncStatus === 'saving'}
                                    value={uiTheme}
                                    disabled={appearanceSyncStatus === 'saving'}
                                    onValueChange={(value) => {
                                        if (isInterfaceTheme(value)) {
                                            void setInterfaceTheme(value);
                                        }
                                    }}
                                    className="grid overflow-hidden border border-[var(--platform-line-strong)] sm:grid-cols-3"
                                >
                                    <InterfaceThemeChoice
                                        theme="onia-v2"
                                        label={t('oniaV2Name')}
                                        description={t('oniaV2Description')}
                                        selected={uiTheme === 'onia-v2'}
                                    />
                                    <InterfaceThemeChoice
                                        theme="onia-v1"
                                        label={t('oniaV1Name')}
                                        description={t('oniaV1Description')}
                                        selected={uiTheme === 'onia-v1'}
                                    />
                                    <InterfaceThemeChoice
                                        theme="plain"
                                        label={t('plainName')}
                                        description={t('plainDescription')}
                                        selected={uiTheme === 'plain'}
                                    />
                                </RadioGroupPrimitive.Root>

                                <div className="border-t border-[var(--platform-line)] pt-6">
                                    <h3 className="text-sm font-semibold text-[var(--platform-ink)]">
                                        {t('colorModeLabel')}
                                    </h3>
                                    <p className="mt-1 text-sm leading-6 text-[var(--platform-ink-muted)]">
                                        {t('colorModeDescription', { mode: activeThemeLabel })}
                                    </p>
                                </div>

                                <RadioGroupPrimitive.Root
                                    aria-label={t('colorModeLabel')}
                                    aria-busy={appearanceSyncStatus === 'saving'}
                                    value={colorMode}
                                    disabled={appearanceSyncStatus === 'saving'}
                                    onValueChange={(value) => {
                                        if (isColorMode(value)) void setColorMode(value);
                                    }}
                                    className="grid overflow-hidden border border-[var(--platform-line-strong)] sm:grid-cols-3"
                                >
                                    <ThemeChoice
                                        mode="light"
                                        label={t('themeLight')}
                                        selected={activeTheme === 'light'}
                                    />
                                    <ThemeChoice
                                        mode="dark"
                                        label={t('themeDark')}
                                        selected={activeTheme === 'dark'}
                                    />
                                    <ThemeChoice
                                        mode="system"
                                        label={t('themeSystem')}
                                        selected={activeTheme === 'system'}
                                    />
                                </RadioGroupPrimitive.Root>

                                <div
                                    className={cn(
                                        'flex items-start gap-3 border px-4 py-3 text-sm leading-6',
                                        appearanceSyncStatus === 'error'
                                            ? 'border-[var(--platform-coral)] bg-[color-mix(in_oklch,var(--platform-coral)_12%,var(--platform-paper))] text-[var(--platform-ink)]'
                                            : 'border-[var(--platform-line)] bg-[color-mix(in_oklch,var(--platform-citron)_14%,var(--platform-paper))] text-[var(--platform-ink-muted-strong)]',
                                    )}
                                    role={appearanceSyncStatus === 'error' ? 'alert' : 'status'}
                                    aria-live="polite"
                                >
                                    {appearanceSyncStatus === 'error' ? (
                                        <AlertCircle
                                            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--platform-coral)]"
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <CheckCircle2
                                            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--platform-violet)]"
                                            aria-hidden="true"
                                        />
                                    )}
                                    <p>
                                        {appearanceSyncStatus === 'saving'
                                            ? t('appearanceSaving')
                                            : appearanceSyncStatus === 'error'
                                              ? t('appearanceSaveError')
                                              : appearanceSyncStatus === 'saved'
                                                ? t('appearanceSaved')
                                                : themeAppliedText}
                                    </p>
                                </div>
                            </div>
                        </section>
                    </TabsContent>
                </div>
            </Tabs>

            <AlertDialog
                open={avatarRemoveConfirmOpen}
                onOpenChange={(open) => {
                    if (!avatarRemoving) setAvatarRemoveConfirmOpen(open);
                }}
            >
                <AlertDialogContent
                    className={cn(
                        platformSans.className,
                        'platform-overlay-surface w-[calc(100%-2rem)] max-w-lg rounded-none border-2 border-[var(--platform-line-strong)] bg-[var(--platform-paper)] text-[var(--platform-ink)] shadow-[8px_8px_0_var(--platform-coral)]',
                    )}
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('removeAvatarTitle')}</AlertDialogTitle>
                        <AlertDialogDescription className="leading-6 text-[var(--platform-ink-muted)]">
                            {t('removeAvatarDescription')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {avatarRemoveError ? (
                        <p
                            role="alert"
                            className="border border-[var(--platform-coral)] bg-[color-mix(in_oklch,var(--platform-coral)_12%,var(--platform-paper))] px-3 py-2 text-sm text-[var(--platform-ink)]"
                        >
                            {avatarRemoveError}
                        </p>
                    ) : null}
                    <AlertDialogFooter className="gap-2 sm:space-x-0">
                        <AlertDialogCancel
                            disabled={avatarRemoving}
                            className={secondaryButtonClassName}
                        >
                            {tCommon('cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={avatarRemoving}
                            className="min-h-11 rounded-none bg-[var(--platform-coral)] px-5 text-[var(--platform-on-accent)] shadow-none hover:bg-[color-mix(in_oklch,var(--platform-coral)_82%,var(--platform-paper))]"
                            onClick={(event) => {
                                event.preventDefault();
                                void removeAvatar();
                            }}
                        >
                            {avatarRemoving ? t('removingAvatar') : t('removeAvatarConfirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={discardDialogOpen}
                onOpenChange={(open) => {
                    setDiscardDialogOpen(open);
                    if (!open) {
                        setPendingTab(null);
                        setPendingNavigation(null);
                    }
                }}
            >
                <AlertDialogContent
                    className={cn(
                        platformSans.className,
                        'platform-overlay-surface w-[calc(100%-2rem)] max-w-lg rounded-none border-2 border-[var(--platform-line-strong)] bg-[var(--platform-paper)] text-[var(--platform-ink)] shadow-[8px_8px_0_var(--platform-violet)]',
                    )}
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('unsavedChangesTitle')}</AlertDialogTitle>
                        <AlertDialogDescription className="leading-6 text-[var(--platform-ink-muted)]">
                            {t('unsavedChangesDescription')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:space-x-0">
                        <AlertDialogCancel className={secondaryButtonClassName}>
                            {t('keepEditing')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="min-h-11 rounded-none bg-[var(--platform-coral)] px-5 text-[var(--platform-on-accent)] shadow-none hover:bg-[color-mix(in_oklch,var(--platform-coral)_82%,var(--platform-paper))]"
                            onClick={() => {
                                const navigationTarget = pendingNavigation;
                                if (initialFormRef.current) {
                                    setForm({ ...initialFormRef.current });
                                }
                                clearSettingsDraft(formAccountId);
                                setUsernameSuggestion(null);
                                setError(null);
                                if (pendingTab) setActiveTab(pendingTab);
                                setPendingTab(null);
                                setPendingNavigation(null);
                                setDiscardDialogOpen(false);
                                if (navigationTarget) router.push(navigationTarget);
                            }}
                        >
                            {t('discardChanges')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PlatformPageShell>
    );
}
