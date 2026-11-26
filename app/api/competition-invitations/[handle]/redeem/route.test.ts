import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    COMPETITION_INVITATION_REDEEM_COOKIE,
    getCompetitionInvitationHandle,
} from '@/lib/competition-hosting/invitation-session';

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession: mocks.getSession }));

import { POST } from './route';

describe('stored competition invitation redemption', () => {
    beforeEach(() => {
        vi.stubEnv('NEXTAUTH_URL', 'https://platform.olimpiada-ai.ro');
        process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test';
        mocks.getSession.mockResolvedValue({ accessToken: 'access-token' });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        vi.clearAllMocks();
    });

    it('keeps the raw token out of the upstream URL and clears its cookie', async () => {
        const token = 'a-secret-competition-token';
        const handle = await getCompetitionInvitationHandle(token);
        const upstream = vi.fn().mockResolvedValue(Response.json({ competitionId: 42 }));
        vi.stubGlobal('fetch', upstream);
        const request = new NextRequest(
            `https://platform.olimpiada-ai.ro/api/competition-invitations/${handle}/redeem`,
            {
                method: 'POST',
                headers: {
                    origin: 'https://platform.olimpiada-ai.ro',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({ sharePersonalDataWithOrganizer: true }),
            },
        );
        request.cookies.set(COMPETITION_INVITATION_REDEEM_COOKIE, token);

        const response = await POST(request, { params: Promise.resolve({ handle }) });

        expect(response.status).toBe(200);
        expect(upstream).toHaveBeenCalledWith(
            new URL('https://api.example.test/competition-invitations/accept'),
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    authorization: 'Bearer access-token',
                    'content-type': 'application/json',
                }),
                body: JSON.stringify({ token, sharePersonalDataWithOrganizer: true }),
            }),
        );
        expect(upstream.mock.calls[0]?.[0].toString()).not.toContain(token);
        expect(response.headers.get('set-cookie')).toContain(
            `${COMPETITION_INVITATION_REDEEM_COOKIE}=`,
        );
        expect(response.headers.get('set-cookie')).toContain(
            'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        );
    });

    it('sends the allowed shared-link registration fields only with the authenticated redeem request', async () => {
        const token = 'comp_' + 'a'.repeat(43);
        const handle = await getCompetitionInvitationHandle(token);
        const upstream = vi.fn().mockResolvedValue(Response.json({ competitionId: 42 }));
        vi.stubGlobal('fetch', upstream);
        const request = new NextRequest(
            'https://example.test/api/competition-invitations/' + handle + '/redeem',
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    registration: { firstName: 'Ana', grade: '6', institutionId: 23 },
                }),
            },
        );
        request.cookies.set(COMPETITION_INVITATION_REDEEM_COOKIE, token);
        const response = await POST(request, { params: Promise.resolve({ handle }) });
        expect(response.status).toBe(200);
        expect(JSON.parse(upstream.mock.calls[0]?.[1]?.body as string)).toEqual({
            token,
            registration: { firstName: 'Ana', grade: '6' },
        });
    });

    it('rejects a cookie from another invitation handle', async () => {
        const handle = await getCompetitionInvitationHandle('tab-a-invitation');
        const request = new NextRequest(
            `https://platform.olimpiada-ai.ro/api/competition-invitations/${handle}/redeem`,
            { method: 'POST' },
        );
        request.cookies.set(COMPETITION_INVITATION_REDEEM_COOKIE, 'tab-b-invitation');

        const response = await POST(request, { params: Promise.resolve({ handle }) });

        expect(response.status).toBe(410);
    });

    it('preserves the existing decision when an older client sends no choice', async () => {
        const token = 'an-unchecked-invitation';
        const handle = await getCompetitionInvitationHandle(token);
        const upstream = vi.fn().mockResolvedValue(Response.json({ competitionId: 42 }));
        vi.stubGlobal('fetch', upstream);
        const request = new NextRequest(
            `https://platform.olimpiada-ai.ro/api/competition-invitations/${handle}/redeem`,
            { method: 'POST' },
        );
        request.cookies.set(COMPETITION_INVITATION_REDEEM_COOKIE, token);

        await POST(request, { params: Promise.resolve({ handle }) });

        expect(JSON.parse(upstream.mock.calls[0]?.[1]?.body as string)).toEqual({ token });
    });
});
