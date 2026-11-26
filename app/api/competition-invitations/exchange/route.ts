import { NextRequest, NextResponse } from 'next/server';

import {
    COMPETITION_INVITATION_COOKIE_MAX_AGE_SECONDS,
    COMPETITION_INVITATION_PREVIEW_COOKIE,
    COMPETITION_INVITATION_REDEEM_COOKIE,
    competitionInvitationPreviewCookiePath,
    competitionInvitationRedeemCookiePath,
    getCompetitionInvitationHandle,
    isAllowedCompetitionInvitationOrigin,
} from '@/lib/competition-hosting/invitation-session';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/types';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

function apiError(status: number, errorCode: string, publicErrorMessage: string) {
    const response = NextResponse.json({ errorCode, publicErrorMessage }, { status });
    response.headers.set('Cache-Control', 'no-store, private');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
}

export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin');
    if (!isAllowedCompetitionInvitationOrigin(origin, request.nextUrl.origin)) {
        return apiError(403, 'INVALID_ORIGIN', 'The request origin is not allowed');
    }
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 4096) {
        return apiError(413, 'INVITATION_REQUEST_TOO_LARGE', 'The invitation is not valid');
    }

    const body = (await request.json().catch(() => null)) as {
        token?: unknown;
        locale?: unknown;
    } | null;
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const locale = typeof body?.locale === 'string' ? body.locale : '';
    if (!TOKEN_PATTERN.test(token) || !SUPPORTED_LOCALES.includes(locale as Locale)) {
        return apiError(400, 'INVALID_INVITATION', 'The invitation is not valid');
    }

    const handle = await getCompetitionInvitationHandle(token);
    const continuationPath = `/${locale}/competition-invitations/continue/${handle}`;
    const response = NextResponse.json({ continuationPath });
    const secureCookie =
        process.env.NODE_ENV === 'production' || request.nextUrl.protocol === 'https:';
    const cookieOptions = {
        httpOnly: true,
        maxAge: COMPETITION_INVITATION_COOKIE_MAX_AGE_SECONDS,
        sameSite: 'lax',
        secure: secureCookie,
    } as const;
    response.cookies.set(COMPETITION_INVITATION_PREVIEW_COOKIE, token, {
        ...cookieOptions,
        path: competitionInvitationPreviewCookiePath(locale, handle),
    });
    response.cookies.set(COMPETITION_INVITATION_REDEEM_COOKIE, token, {
        ...cookieOptions,
        path: competitionInvitationRedeemCookiePath(handle),
    });
    response.headers.set('Cache-Control', 'no-store, private');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
}
