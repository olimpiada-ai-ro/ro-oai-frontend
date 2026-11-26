// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolvePublicProfileAvatarDataUrl } from './profile-avatar';

const ONE_PIXEL_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
);

function responseBody(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function publicProfile(avatar: string | null, isPublic = true): Response {
    return Response.json({
        settings: {
            avatar,
            isPublic,
        },
    });
}

describe('public profile avatar resolver', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('returns a bounded PNG data URL from the trusted public profile response', async () => {
        vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test');
        const avatarUrl =
            'https://account.r2.cloudflarestorage.com/avatars/user-id?X-Amz-Signature=private';
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(publicProfile(avatarUrl))
            .mockResolvedValueOnce(
                new Response(responseBody(ONE_PIXEL_PNG), {
                    headers: {
                        'Content-Length': ONE_PIXEL_PNG.byteLength.toString(),
                        'Content-Type': 'binary/octet-stream',
                    },
                }),
            );

        const avatarDataUrl = await resolvePublicProfileAvatarDataUrl('ana/popescu', fetchMock);

        expect(avatarDataUrl).toBe(`data:image/png;base64,${ONE_PIXEL_PNG.toString('base64')}`);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0]?.[0].toString()).toBe(
            'https://api.example.test/profile/ana%2Fpopescu',
        );
        expect(fetchMock.mock.calls[1]?.[0].toString()).toBe(avatarUrl);
        expect(fetchMock.mock.calls[1]?.[1]).toEqual(
            expect.objectContaining({
                redirect: 'error',
            }),
        );
    });

    it.each([
        ['a private profile', publicProfile(null, false)],
        ['a missing profile', new Response(null, { status: 404 })],
        ['a profile without an avatar', publicProfile(null)],
    ])('falls back for %s', async (_label, profileResponse) => {
        vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test');
        const fetchMock = vi.fn().mockResolvedValue(profileResponse);

        await expect(
            resolvePublicProfileAvatarDataUrl('competitor', fetchMock),
        ).resolves.toBeUndefined();
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('never fetches an untrusted avatar origin returned by the profile API', async () => {
        vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test');
        const fetchMock = vi
            .fn()
            .mockResolvedValue(publicProfile('https://evil.example/avatar.png'));

        await expect(
            resolvePublicProfileAvatarDataUrl('competitor', fetchMock),
        ).resolves.toBeUndefined();
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('accepts an explicitly configured HTTPS storage origin', async () => {
        vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test');
        vi.stubEnv('OG_AVATAR_ALLOWED_ORIGINS', 'https://images.example');
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(publicProfile('https://images.example/avatar.png'))
            .mockResolvedValueOnce(
                new Response(responseBody(ONE_PIXEL_PNG), {
                    headers: { 'Content-Type': 'image/png' },
                }),
            );

        await expect(resolvePublicProfileAvatarDataUrl('competitor', fetchMock)).resolves.toMatch(
            /^data:image\/png;base64,/u,
        );
    });

    it('rejects mislabeled, malformed, and oversized avatar payloads', async () => {
        vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test');
        const avatarUrl = 'https://account.r2.cloudflarestorage.com/avatars/user-id';
        const malformedPng = new Uint8Array(ONE_PIXEL_PNG);
        new DataView(
            malformedPng.buffer,
            malformedPng.byteOffset,
            malformedPng.byteLength,
        ).setUint32(16, 4096);

        for (const avatarResponse of [
            new Response('<svg></svg>', {
                headers: { 'Content-Type': 'image/svg+xml' },
            }),
            new Response(responseBody(malformedPng), {
                headers: { 'Content-Type': 'image/png' },
            }),
            new Response(null, {
                headers: {
                    'Content-Length': String(2 * 1024 * 1024 + 1),
                    'Content-Type': 'image/png',
                },
            }),
        ]) {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce(publicProfile(avatarUrl))
                .mockResolvedValueOnce(avatarResponse);

            await expect(
                resolvePublicProfileAvatarDataUrl('competitor', fetchMock),
            ).resolves.toBeUndefined();
        }
    });

    it('stops reading a streamed response once it exceeds the byte limit', async () => {
        vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test');
        const avatarUrl = 'https://account.r2.cloudflarestorage.com/avatars/user-id';
        const oversizedBody = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new Uint8Array(1024 * 1024));
                controller.enqueue(new Uint8Array(1024 * 1024));
                controller.enqueue(new Uint8Array(1));
                controller.close();
            },
        });
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(publicProfile(avatarUrl))
            .mockResolvedValueOnce(
                new Response(oversizedBody, {
                    headers: { 'Content-Type': 'image/png' },
                }),
            );

        await expect(
            resolvePublicProfileAvatarDataUrl('competitor', fetchMock),
        ).resolves.toBeUndefined();
    });
});
