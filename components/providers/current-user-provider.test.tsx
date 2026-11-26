import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fetchApi: vi.fn(),
    session: {
        current: {
            data: null as null | { id: string; accessToken?: string },
            status: 'unauthenticated' as 'loading' | 'authenticated' | 'unauthenticated',
        },
    },
}));

vi.mock('next-auth/react', () => ({
    useSession: () => mocks.session.current,
}));

vi.mock('@/lib/api', () => ({
    fetchApi: mocks.fetchApi,
}));

import { CurrentUserProvider, useCurrentUser } from '@/components/providers/current-user-provider';

function CurrentUserProbe() {
    const context = useCurrentUser();

    return (
        <div>
            <span data-testid="auth-status">{context.status}</span>
            <span data-testid="profile-status">{context.profileStatus}</span>
            <span data-testid="user-id">{context.user?.userId ?? 'none'}</span>
            <span data-testid="bio-length">{context.user?.bio?.length ?? 0}</span>
            <span data-testid="error">{context.error ?? 'none'}</span>
        </div>
    );
}

function response(
    status: number,
    body?: { userId: string; username: string; email: string; bio?: string },
): Pick<Response, 'ok' | 'status' | 'json'> {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: vi.fn().mockResolvedValue(body),
    };
}

describe('CurrentUserProvider', () => {
    beforeEach(() => {
        mocks.fetchApi.mockReset();
        mocks.session.current = { data: null, status: 'unauthenticated' };
    });

    afterEach(cleanup);

    it('keeps profile API errors distinct from authentication state', async () => {
        mocks.session.current = {
            data: { id: 'account-a', accessToken: 'token' },
            status: 'authenticated',
        };
        mocks.fetchApi.mockResolvedValue(response(503));

        render(
            <CurrentUserProvider>
                <CurrentUserProbe />
            </CurrentUserProvider>,
        );

        await waitFor(() => expect(screen.getByTestId('profile-status').textContent).toBe('error'));
        expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
        expect(screen.getByTestId('user-id').textContent).toBe('none');
        expect(screen.getByTestId('error').textContent).toContain('503');
    });

    it('ignores a stale profile response after the account changes', async () => {
        let resolveFirstRequest!: (value: Pick<Response, 'ok' | 'status' | 'json'>) => void;
        const firstRequest = new Promise<Pick<Response, 'ok' | 'status' | 'json'>>((resolve) => {
            resolveFirstRequest = resolve;
        });

        mocks.session.current = { data: { id: 'account-a' }, status: 'authenticated' };
        mocks.fetchApi.mockReturnValueOnce(firstRequest);

        const view = render(
            <CurrentUserProvider>
                <CurrentUserProbe />
            </CurrentUserProvider>,
        );

        mocks.session.current = { data: { id: 'account-b' }, status: 'authenticated' };
        mocks.fetchApi.mockResolvedValueOnce(
            response(200, { userId: 'account-b', username: 'bravo', email: 'b@example.com' }),
        );
        view.rerender(
            <CurrentUserProvider>
                <CurrentUserProbe />
            </CurrentUserProvider>,
        );

        await waitFor(() => expect(screen.getByTestId('user-id').textContent).toBe('account-b'));

        resolveFirstRequest(
            response(200, { userId: 'account-a', username: 'alpha', email: 'a@example.com' }),
        );

        await waitFor(() => expect(screen.getByTestId('user-id').textContent).toBe('account-b'));
    });

    it('bounds an oversized legacy biography before exposing it to the UI', async () => {
        mocks.session.current = {
            data: { id: 'account-a', accessToken: 'token' },
            status: 'authenticated',
        };
        mocks.fetchApi.mockResolvedValue(
            response(200, {
                userId: 'account-a',
                username: 'alpha',
                email: 'a@example.com',
                bio: 'a'.repeat(50_000),
            }),
        );

        render(
            <CurrentUserProvider>
                <CurrentUserProbe />
            </CurrentUserProvider>,
        );

        await waitFor(() => expect(screen.getByTestId('profile-status').textContent).toBe('ready'));
        expect(screen.getByTestId('bio-length').textContent).toBe('500');
    });
});
