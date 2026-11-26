'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { useSession } from 'next-auth/react';

import { fetchApi } from '@/lib/api';
import { limitProfileBio } from '@/lib/profile-bio';
import type { UserProfileSettingsResponse } from '@/lib/types';

export type CurrentUserProfileStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CurrentUserContextType {
    user: UserProfileSettingsResponse | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    status: 'loading' | 'authenticated' | 'unauthenticated';
    profileStatus: CurrentUserProfileStatus;
    sessionId: string | null;
    accessToken: string | null;
    error: string | null;
    refetch: () => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUserContextType>({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    status: 'loading',
    profileStatus: 'idle',
    sessionId: null,
    accessToken: null,
    error: null,
    refetch: async () => {},
});

export const useCurrentUser = () => useContext(CurrentUserContext);

function profileRequestError(status: number): string {
    if (status === 401 || status === 403) {
        return `Profile access failed (${status}). Your sign-in session is still active.`;
    }

    if (status >= 500) {
        return `The profile service is temporarily unavailable (${status}).`;
    }

    return `The profile could not be loaded (${status}).`;
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
    const { data: session, status } = useSession();
    const sessionId = session?.id ?? null;
    const [user, setUser] = useState<UserProfileSettingsResponse | null>(null);
    const [profileAccountId, setProfileAccountId] = useState<string | null>(null);
    const [profileStatus, setProfileStatus] = useState<CurrentUserProfileStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const activeRequestRef = useRef(0);

    const fetchUserProfile = useCallback(async () => {
        const requestId = ++activeRequestRef.current;

        if (status !== 'authenticated') {
            setUser(null);
            setProfileAccountId(null);
            setProfileStatus('idle');
            setError(null);
            return;
        }

        if (!sessionId) {
            setUser(null);
            setProfileAccountId(null);
            setProfileStatus('error');
            setError('The authenticated session is missing its account identifier.');
            return;
        }

        setProfileAccountId(sessionId);
        setProfileStatus('loading');
        setError(null);

        try {
            const response = await fetchApi(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/profile/settings`,
            );

            if (!response.ok) {
                throw new Error(profileRequestError(response.status));
            }

            const data = (await response.json()) as UserProfileSettingsResponse;

            if (data.userId && data.userId !== sessionId) {
                throw new Error('The profile response did not match the active account.');
            }

            if (requestId !== activeRequestRef.current) return;

            setUser({
                ...data,
                bio: limitProfileBio(data.bio) ?? undefined,
            });
            setProfileAccountId(sessionId);
            setProfileStatus('ready');
        } catch (requestError) {
            if (requestId !== activeRequestRef.current) return;

            setProfileAccountId(sessionId);
            setProfileStatus('error');
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : 'The profile service returned an unexpected error.',
            );
        }
    }, [sessionId, status]);

    useEffect(() => {
        void fetchUserProfile();

        return () => {
            activeRequestRef.current += 1;
        };
    }, [fetchUserProfile]);

    const isCurrentAccount = profileAccountId === sessionId;
    const currentUser = status === 'authenticated' && isCurrentAccount ? user : null;
    const currentProfileStatus: CurrentUserProfileStatus =
        status !== 'authenticated' ? 'idle' : !isCurrentAccount ? 'loading' : profileStatus;
    const currentError = status === 'authenticated' && isCurrentAccount ? error : null;

    const value = useMemo<CurrentUserContextType>(
        () => ({
            user: currentUser,
            isLoading:
                status === 'loading' ||
                (status === 'authenticated' && currentProfileStatus === 'loading'),
            isAuthenticated: status === 'authenticated',
            status,
            profileStatus: currentProfileStatus,
            sessionId,
            accessToken: session?.accessToken ?? null,
            error: currentError,
            refetch: fetchUserProfile,
        }),
        [
            currentError,
            currentProfileStatus,
            currentUser,
            fetchUserProfile,
            session?.accessToken,
            sessionId,
            status,
        ],
    );

    return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}
