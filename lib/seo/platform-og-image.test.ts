// @vitest-environment node

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/og/route';

import {
    generateArticleOgImageUrl,
    generateCompetitionOgImageUrl,
    generateCountyOgImageUrl,
    generateGenericOgImageUrl,
    generateHomeOgImageUrl,
    generateInstitutionOgImageUrl,
    generateProblemOgImageUrl,
    getFallbackOgImageUrl,
} from './config';

function pngDimensions(buffer: ArrayBuffer): { width: number; height: number } {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    return {
        width: view.getUint32(16),
        height: view.getUint32(20),
    };
}

async function expectOgPng(url: string) {
    const response = await GET(new NextRequest(url));
    const body = await response.arrayBuffer();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
    expect(response.headers.get('cache-control')).toContain('s-maxage=604800');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(pngDimensions(body)).toEqual({ width: 1200, height: 630 });
}

describe('ONIA-v2 platform Open Graph images', () => {
    it('builds deterministic, versioned URLs for every public content family', () => {
        const urls = [
            generateHomeOgImageUrl(),
            generateGenericOgImageUrl('Problems', 'Solve ML challenges', {
                kind: 'problems',
            }),
            generateProblemOgImageUrl('Model steering', 'Hard', {
                problemId: 248,
                authorLine: 'By Ana',
            }),
            generateCompetitionOgImageUrl(
                'IOAI 2026',
                'UPCOMING',
                {
                    start: '2026-08-02T08:00:00Z',
                    end: '2026-08-08T17:00:00Z',
                },
                { detailsLine: '6 problems' },
            ),
            generateArticleOgImageUrl('How validation works', {
                kind: 'PROBLEM_EDITORIAL',
                problemTitle: 'Model steering',
                revision: '2026-07-27T12:00:00Z',
            }),
            generateInstitutionOgImageUrl('Colegiul Național de Informatică', {
                countryCode: ' ro ',
                location: 'Prahova, România',
            }),
            generateCountyOgImageUrl('Cluj', 'CJ'),
        ].map((value) => new URL(value));

        for (const imageUrl of urls) {
            expect(imageUrl.pathname).toBe('/api/og');
            expect(imageUrl.searchParams.get('v')).toBe('onia-og-2');
        }

        expect(urls[1].searchParams.get('kind')).toBe('problems');
        expect(urls[2].searchParams.get('problemId')).toBe('248');
        expect(urls[4].searchParams.get('type')).toBe('article');
        expect(urls[5].searchParams.get('countryCode')).toBe('RO');
        expect(urls[6].searchParams.get('type')).toBe('county');
    });

    it.each([
        'https://platform.olimpiada-ai.ro/api/og?type=home&title=MLCompete&subtitle=Learn%2C+build%2C+compete',
        'https://platform.olimpiada-ai.ro/api/og?type=generic&kind=leaderboard&title=Clasament&subtitle=Cei+mai+buni+concuren%C8%9Bi',
        'https://platform.olimpiada-ai.ro/api/og?type=problem&title=Analiza+seriilor+temporale+%F0%9F%A7%A0&difficulty=Hard&problemId=248',
        'https://platform.olimpiada-ai.ro/api/og?type=competition&title=IOAI+2026&status=UPCOMING&startDate=2026-08-02T08%3A00%3A00Z&endDate=2026-08-08T17%3A00%3A00Z',
        'https://platform.olimpiada-ai.ro/api/og?type=article&title=%E6%A8%A1%E5%9E%8B%E8%AF%84%E4%BC%B0%E6%8C%87%E5%8D%97&articleKind=ARTICLE&subtitle=Practical+validation+notes',
        'https://platform.olimpiada-ai.ro/api/og?type=institution&title=%E1%83%97%E1%83%91%E1%83%98%E1%83%9A%E1%83%98%E1%83%A1%E1%83%98%E1%83%A1+%E1%83%99%E1%83%9D%E1%83%9A%E1%83%94%E1%83%AF%E1%83%98&countryCode=GE&location=Tbilisi',
        'https://platform.olimpiada-ai.ro/api/og?type=county&title=Cluj&countyCode=CJ',
    ])('renders a complete PNG for %s', async (url) => {
        await expectOgPng(url);
    });

    it.each([
        'https://platform.olimpiada-ai.ro/api/og?type=unknown&title=Spoof',
        'https://platform.olimpiada-ai.ro/api/og?type=problem&title=Problem&difficulty=Impossible',
        'https://platform.olimpiada-ai.ro/api/og?type=competition&title=Contest&status=ACTIVE&startDate=not-a-date&endDate=also-bad',
        'https://platform.olimpiada-ai.ro/api/og?type=competition&title=Contest&status=ACTIVE&startDate=2026-08-08T00%3A00%3A00Z&endDate=2026-08-02T00%3A00%3A00Z',
    ])('rejects invalid public image contracts: %s', async (url) => {
        const response = await GET(new NextRequest(url));
        expect(response.status).toBe(400);
    });

    it('ships a real 1200×630 static fallback image', async () => {
        const fallbackUrl = new URL(getFallbackOgImageUrl());
        const fallbackPath = path.join(
            process.cwd(),
            'public',
            path.basename(fallbackUrl.pathname),
        );
        const [fileStats, buffer] = await Promise.all([stat(fallbackPath), readFile(fallbackPath)]);

        expect(fileStats.isFile()).toBe(true);
        expect(fileStats.size).toBeGreaterThan(10_000);
        expect(
            pngDimensions(
                buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
            ),
        ).toEqual({
            width: 1200,
            height: 630,
        });
    });
});
