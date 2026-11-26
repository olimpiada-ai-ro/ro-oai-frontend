import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    COMPETITION_INVITATION_PREVIEW_COOKIE,
    COMPETITION_INVITATION_REDEEM_COOKIE,
    getCompetitionInvitationHandle,
} from '@/lib/competition-hosting/invitation-session';

import { POST } from './route';

describe('fragment competition invitation exchange', () => {
    beforeEach(() => vi.stubEnv('NEXTAUTH_URL', 'https://platform.olimpiada-ai.ro'));
    afterEach(() => vi.unstubAllEnvs());
    it('moves the bearer into handle-scoped HttpOnly cookies', async () => {
        const token = 'abcdefghijklmnopqrstuvwxyz_ABCDEFGH-123456';
        const handle = await getCompetitionInvitationHandle(token);
        const response = await POST(
            new NextRequest(
                'https://platform.olimpiada-ai.ro/api/competition-invitations/exchange',
                {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        origin: 'https://platform.olimpiada-ai.ro',
                    },
                    body: JSON.stringify({ token, locale: 'ro' }),
                },
            ),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            continuationPath: `/ro/competition-invitations/continue/${handle}`,
        });
        const cookies = response.headers.get('set-cookie');
        expect(cookies).toContain(`${COMPETITION_INVITATION_PREVIEW_COOKIE}=`);
        expect(cookies).toContain(`${COMPETITION_INVITATION_REDEEM_COOKIE}=`);
        expect(cookies).toContain('HttpOnly');
        expect(cookies).toContain(`Path=/ro/competition-invitations/continue/${handle}`);
        expect(cookies).toContain(`Path=/api/competition-invitations/${handle}`);
        expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    });

    it('allows the public site origin behind the internal service URL', async () => {
        const request = new NextRequest(
            'http://service.internal:3000/api/competition-invitations/exchange',
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ token: 'comp_' + 'x'.repeat(43), locale: 'ro' }),
            },
        );
        request.headers.set('origin', 'https://platform.olimpiada-ai.ro');
        expect((await POST(request)).status).toBe(200);
    });

    it('rejects invalid tokens and cross-origin requests', async () => {
        const invalid = await POST(
            new NextRequest(
                'https://platform.olimpiada-ai.ro/api/competition-invitations/exchange',
                {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ token: 'short', locale: 'ro' }),
                },
            ),
        );
        const crossOriginRequest = new NextRequest(
            'https://platform.olimpiada-ai.ro/api/competition-invitations/exchange',
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    token: 'abcdefghijklmnopqrstuvwxyz_ABCDEFGH-123456',
                    locale: 'ro',
                }),
            },
        );
        crossOriginRequest.headers.set('origin', 'https://attacker.example');
        const crossOrigin = await POST(crossOriginRequest);

        expect(invalid.status).toBe(400);
        expect(crossOrigin.status).toBe(403);
        expect(invalid.headers.get('set-cookie')).toBeNull();
        expect(crossOrigin.headers.get('set-cookie')).toBeNull();
    });
});
