const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_AVATAR_DIMENSION = 2048;
const MAX_AVATAR_PIXELS = 4_194_304;
const PROFILE_FETCH_TIMEOUT_MS = 3_000;
const AVATAR_FETCH_TIMEOUT_MS = 4_000;
const R2_STORAGE_HOST_SUFFIX = '.r2.cloudflarestorage.com';

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface PublicProfileResponse {
    settings?: {
        avatar?: unknown;
        isPublic?: unknown;
    };
}

function buildPublicProfileUrl(profileIdentifier: string): URL | null {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBaseUrl) return null;

    try {
        const baseUrl = new URL(apiBaseUrl);
        if (baseUrl.protocol !== 'https:' && baseUrl.protocol !== 'http:') return null;

        baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/u, '')}/`;
        baseUrl.search = '';
        baseUrl.hash = '';

        return new URL(`profile/${encodeURIComponent(profileIdentifier)}`, baseUrl);
    } catch {
        return null;
    }
}

function configuredAvatarOrigins(): Set<string> {
    const origins = new Set<string>();

    for (const candidate of (process.env.OG_AVATAR_ALLOWED_ORIGINS ?? '').split(',')) {
        const value = candidate.trim();
        if (!value) continue;

        try {
            const url = new URL(value);
            if (url.protocol === 'https:' || url.protocol === 'http:') {
                origins.add(url.origin);
            }
        } catch {
            // Ignore malformed optional configuration.
        }
    }

    return origins;
}

function isDevelopmentStorageHost(url: URL): boolean {
    if (process.env.NODE_ENV === 'production') return false;

    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
}

function getTrustedAvatarUrl(value: unknown): URL | null {
    if (typeof value !== 'string' || !value.trim()) return null;

    try {
        const url = new URL(value);
        if (url.username || url.password) return null;
        if (url.protocol !== 'https:' && !isDevelopmentStorageHost(url)) return null;

        const trustedCloudflareStorage =
            url.hostname.length > R2_STORAGE_HOST_SUFFIX.length &&
            url.hostname.endsWith(R2_STORAGE_HOST_SUFFIX);
        if (
            !trustedCloudflareStorage &&
            !configuredAvatarOrigins().has(url.origin) &&
            !isDevelopmentStorageHost(url)
        ) {
            return null;
        }

        return url;
    } catch {
        return null;
    }
}

async function fetchWithTimeout(
    fetchImplementation: FetchImplementation,
    input: URL,
    init: RequestInit,
    timeoutMs: number,
): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetchImplementation(input, {
            ...init,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
}

function isSafePng(bytes: Uint8Array): boolean {
    if (bytes.byteLength < 24) return false;

    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!pngSignature.every((value, index) => bytes[index] === value)) return false;

    const chunkType = String.fromCharCode(...bytes.slice(12, 16));
    if (chunkType !== 'IHDR') return false;

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);

    return (
        width > 0 &&
        height > 0 &&
        width <= MAX_AVATAR_DIMENSION &&
        height <= MAX_AVATAR_DIMENSION &&
        width * height <= MAX_AVATAR_PIXELS
    );
}

async function readBoundedBytes(response: Response): Promise<Uint8Array | null> {
    if (!response.body) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        return bytes.byteLength <= MAX_AVATAR_BYTES ? bytes : null;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;

            totalBytes += value.byteLength;
            if (totalBytes > MAX_AVATAR_BYTES) {
                await reader.cancel();
                return null;
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}

/**
 * Resolves a public profile avatar without placing its presigned storage URL
 * in page metadata. Only the configured backend chooses the image location;
 * caller-controlled OG parameters can never supply a fetch target.
 */
export async function resolvePublicProfileAvatarDataUrl(
    profileIdentifier: string,
    fetchImplementation: FetchImplementation = fetch,
): Promise<string | undefined> {
    const profileUrl = buildPublicProfileUrl(profileIdentifier);
    if (!profileUrl) return undefined;

    try {
        const profileResponse = await fetchWithTimeout(
            fetchImplementation,
            profileUrl,
            {
                cache: 'no-store',
                headers: { Accept: 'application/json' },
                redirect: 'error',
            },
            PROFILE_FETCH_TIMEOUT_MS,
        );
        if (!profileResponse.ok || profileResponse.redirected) return undefined;

        const profile = (await profileResponse.json()) as PublicProfileResponse;
        if (profile.settings?.isPublic !== true) return undefined;

        const avatarUrl = getTrustedAvatarUrl(profile.settings.avatar);
        if (!avatarUrl) return undefined;

        const avatarResponse = await fetchWithTimeout(
            fetchImplementation,
            avatarUrl,
            {
                cache: 'no-store',
                headers: { Accept: 'image/png' },
                redirect: 'error',
            },
            AVATAR_FETCH_TIMEOUT_MS,
        );
        if (!avatarResponse.ok || avatarResponse.redirected) return undefined;

        const contentType = avatarResponse.headers.get('content-type')?.split(';', 1)[0].trim();
        if (
            contentType !== 'image/png' &&
            contentType !== 'application/octet-stream' &&
            contentType !== 'binary/octet-stream'
        ) {
            return undefined;
        }

        const declaredLength = Number(avatarResponse.headers.get('content-length'));
        if (Number.isFinite(declaredLength) && declaredLength > MAX_AVATAR_BYTES) {
            return undefined;
        }

        const bytes = await readBoundedBytes(avatarResponse);
        if (!bytes || !isSafePng(bytes)) return undefined;

        return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
    } catch {
        return undefined;
    }
}
