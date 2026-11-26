'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useCompetitionData } from '@/components/competition-data-provider';
import { fetchApi } from '@/lib/api';
import { limitProfileBio } from '@/lib/profile-bio';

interface ProfileCompletionIndicatorProps {
    /**
     * Whether to show the indicator inline (e.g., in dropdown menu)
     * or as a standalone badge
     */
    variant?: 'inline' | 'badge';
    /**
     * Optional className for styling
     */
    className?: string;
    /**
     * Whether the indicator can be dismissed
     */
    dismissible?: boolean;
}

/**
 * ProfileCompletionIndicator component displays a subtle indicator
 * when a user's profile is incomplete.
 *
 * Features:
 * - Shows only when profile is incomplete
 * - Can be dismissed after onboarding wizard is dismissed
 * - Updates automatically when profile is completed
 * - Respects user's dismissal preference (stored in localStorage)
 */
export function ProfileCompletionIndicator({
    variant = 'badge',
    className,
    dismissible = true,
}: ProfileCompletionIndicatorProps) {
    const { data: session, status } = useSession();
    const t = useTranslations('profileCompletion');
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDismissed, setIsDismissed] = useState(false);
    const [isProfileComplete, setIsProfileComplete] = useState(true);
    const { authenticated, isProfileConfirmed } = useCompetitionData();
    const isUsernameMissing = authenticated && !isProfileConfirmed;

    // Check if indicator has been dismissed by user
    useEffect(() => {
        if (typeof window !== 'undefined' && session?.id) {
            const dismissed = localStorage.getItem(`profile-indicator-dismissed-${session.id}`);
            setIsDismissed(dismissed === 'true');
        }
    }, [session?.id]);

    // Fetch user profile to check completion status
    useEffect(() => {
        const fetchUserProfile = async () => {
            if (status === 'loading') {
                return;
            }

            if (status === 'unauthenticated' || !session?.id || isUsernameMissing) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                const response = await fetchApi(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/profile/${session.id}`,
                );

                if (!response.ok) {
                    console.error('Failed to fetch user profile:', response.statusText);
                    setIsLoading(false);
                    return;
                }

                const data = await response.json();
                const settingsData = data.settings || data;

                // Transform date strings to Date objects
                const profile: UserProfile = {
                    userId: settingsData.userId || '',
                    username: settingsData.username || '',
                    firstName: settingsData.firstName || null,
                    lastName: settingsData.lastName || null,
                    email: settingsData.email || null,
                    joinedAt: new Date(settingsData.joinDate || settingsData.joinedAt),
                    avatar: settingsData.avatar || '',
                    bio: limitProfileBio(settingsData.bio),
                    location: settingsData.location || null,
                    website: settingsData.website || null,
                    github: settingsData.github || null,
                    totalScore: 0,
                    problemsSolved: 0,
                    averageScore: 0,
                    rank: 0,
                    leaderboardPlaced: false,
                    institution: settingsData.institution || undefined,
                    institutionJoinedAt: settingsData.institutionJoinedAt
                        ? new Date(settingsData.institutionJoinedAt)
                        : undefined,
                    country: settingsData.country || undefined,
                    onboardingDismissed: settingsData.onboardingDismissed || false,
                };

                setUserProfile(profile);

                // Check if profile is complete
                const isComplete = checkProfileComplete(profile);
                setIsProfileComplete(isComplete);
            } catch (error) {
                console.error('Error fetching user profile:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserProfile();
    }, [session, status]);

    const handleDismiss = () => {
        if (session?.id) {
            localStorage.setItem(`profile-indicator-dismissed-${session.id}`, 'true');
            setIsDismissed(true);
        }
    };

    // Don't show indicator if:
    // - Still loading
    // - User is not authenticated
    // - Profile is complete
    // - Indicator has been dismissed
    // - Onboarding wizard hasn't been dismissed yet (wizard takes priority)
    if (
        isLoading ||
        !userProfile ||
        isProfileComplete ||
        isDismissed ||
        !userProfile.onboardingDismissed
    ) {
        return null;
    }

    if (variant === 'inline') {
        return (
            <div
                className={cn(
                    'flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800',
                    className,
                )}
                role="status"
                aria-live="polite"
            >
                <div className="flex items-center gap-2 flex-1">
                    <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" />
                    <span className="text-xs text-orange-700 dark:text-orange-300">
                        {t('incompleteProfile')}
                    </span>
                </div>
                {dismissible && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:bg-orange-100 dark:hover:bg-orange-900/50"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDismiss();
                        }}
                        aria-label={t('dismissIndicator')}
                    >
                        <X className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                    </Button>
                )}
            </div>
        );
    }

    return (
        <Badge
            variant="secondary"
            className={cn(
                'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50 gap-1',
                className,
            )}
            role="status"
            aria-live="polite"
        >
            <AlertCircle className="h-3 w-3" />
            <span>{t('incomplete')}</span>
            {dismissible && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-transparent ml-1"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDismiss();
                    }}
                    aria-label={t('dismissIndicator')}
                >
                    <X className="h-3 w-3" />
                </Button>
            )}
        </Badge>
    );
}

/**
 * Check if user profile is complete
 * A profile is considered complete if it has basic information filled out
 */
function checkProfileComplete(profile: UserProfile): boolean {
    return !!(profile.username && profile.bio && profile.location);
}
