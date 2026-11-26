// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import config from '../next.config.mjs';

afterEach(() => vi.unstubAllEnvs());

async function directive(name: string) {
    const [rule] = await config.headers();
    const policy = rule.headers.find((header) => header.key === 'Content-Security-Policy')!.value;
    return policy
        .split('; ')
        .find((entry) => entry.startsWith(name + ' '))!
        .split(' ');
}

it('adds the configured upload origin only to connection permissions', async () => {
    vi.stubEnv('UPLOAD_STORAGE_ORIGIN', '');
    const initial = await directive('connect-src');
    vi.stubEnv('UPLOAD_STORAGE_ORIGIN', 'https://uploads.example.test/bucket');
    expect(await directive('connect-src')).toEqual([...initial, 'https://uploads.example.test']);
    expect(await directive('frame-src')).not.toContain('https://uploads.example.test');
});

it.each(['invalid', 'http://uploads.example.test', 'https://*.example.test'])(
    'ignores unsupported upload storage settings (%s)',
    async (value) => {
        vi.stubEnv('UPLOAD_STORAGE_ORIGIN', '');
        const initial = await directive('connect-src');
        vi.stubEnv('UPLOAD_STORAGE_ORIGIN', value);
        expect(await directive('connect-src')).toEqual(initial);
    },
);
