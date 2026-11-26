import { fetchPublicApi } from '@/lib/public-api';
import { fetchApi } from '@/lib/api';
import { normalizeIdentityPresentation } from '@/lib/identity-presentation';

import type {
    CompetitionSeriesChild,
    CompetitionSeriesChildLeaderboard,
    CompetitionSeriesDetail,
    CompetitionSeriesLeaderboard,
    CompetitionSeriesLeaderboardRow,
    CompetitionSeriesMode,
    CompetitionSeriesScore,
    CompetitionSeriesUser,
} from './types';

type UnknownRecord = Record<string, unknown>;

export class CompetitionSeriesApiError extends Error {
    constructor(
        message: string,
        readonly status?: number,
    ) {
        super(message);
        this.name = 'CompetitionSeriesApiError';
    }
}

function record(value: unknown): UnknownRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as UnknownRecord)
        : {};
}

function array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function identifierValue(value: unknown, fallback = ''): string {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

function nullableString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function modeValue(value: unknown): CompetitionSeriesMode {
    return value === 'DIVISIONS' ? 'DIVISIONS' : 'MULTI_ROUND';
}

function normalizeChild(value: unknown, index: number): CompetitionSeriesChild {
    const child = record(value);
    return {
        id: numberValue(child.id ?? child.competitionId),
        name: stringValue(child.name ?? child.competitionName),
        shortDescription: nullableString(child.shortDescription),
        startTime: stringValue(child.startTime),
        endTime: stringValue(child.endTime),
        displayOrder: numberValue(
            child.displayOrder ?? child.position ?? child.seriesPosition,
            index,
        ),
        problemCount: Math.max(0, numberValue(child.problemCount, array(child.problems).length)),
        status: nullableString(child.status),
        competitionType:
            child.competitionType === 'CLASSIC' ||
            child.competitionType === 'CASUAL' ||
            child.competitionType === 'HYBRID'
                ? child.competitionType
                : null,
    };
}

export function normalizeCompetitionSeriesDetail(payload: unknown): CompetitionSeriesDetail {
    const raw = record(payload);
    const children = array(raw.children ?? raw.competitions)
        .map(normalizeChild)
        .filter((child) => child.id > 0 && child.name)
        .sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id);

    return {
        id: numberValue(raw.id),
        name: stringValue(raw.name),
        shortDescription: nullableString(raw.shortDescription),
        description: nullableString(raw.description),
        mode: modeValue(raw.mode ?? raw.type),
        isPrivate: raw.isPrivate === true,
        startTime: stringValue(raw.startTime),
        endTime: stringValue(raw.endTime),
        children,
    };
}

function normalizeUser(value: unknown, row: UnknownRecord): CompetitionSeriesUser {
    const user = record(value);
    const username = stringValue(
        user.username ?? user.displayName ?? row.username ?? row.displayName,
        identifierValue(user.id ?? user.userId ?? row.userId, 'Participant'),
    );
    return {
        id: identifierValue(user.id ?? user.userId ?? row.userId, username),
        username,
        avatar: nullableString(
            user.avatar ?? user.avatarUrl ?? user.profilePicture ?? row.avatar ?? row.avatarUrl,
        ),
        identityPresentation: normalizeIdentityPresentation(
            user.identityPresentation ?? row.identityPresentation,
        ),
    };
}

function normalizeScores(value: unknown, kind: 'round' | 'problem'): CompetitionSeriesScore[] {
    if (Array.isArray(value)) {
        return value.map((item, index) => {
            const score = record(item);
            const entity = record(
                kind === 'round'
                    ? (score.competition ?? score.childCompetition ?? score.child)
                    : score.problem,
            );
            const id = numberValue(
                kind === 'round'
                    ? (score.childCompetitionId ?? score.competitionId ?? score.id ?? entity.id)
                    : (score.problemId ?? score.id ?? entity.id),
                index + 1,
            );
            return {
                id,
                name: stringValue(
                    score.name ??
                        score.title ??
                        score.competitionName ??
                        score.problemName ??
                        entity.name ??
                        entity.title,
                    String(id),
                ),
                score: nullableNumber(score.score ?? score.totalScore),
                competitionId:
                    kind === 'problem'
                        ? nullableNumber(
                              score.competitionId ??
                                  score.childCompetitionId ??
                                  entity.competitionId,
                          )
                        : id,
            };
        });
    }

    const values = record(value);
    return Object.entries(values).map(([key, score]) => ({
        id: numberValue(key),
        name: key,
        score: nullableNumber(record(score).score ?? score),
        competitionId: kind === 'round' ? numberValue(key) : null,
    }));
}

function normalizeLeaderboardRow(value: unknown, index: number): CompetitionSeriesLeaderboardRow {
    const row = record(value);
    return {
        rank: Math.max(1, numberValue(row.rank, index + 1)),
        user: normalizeUser(row.user, row),
        totalScore: numberValue(row.totalScore ?? row.score),
        rounds: normalizeScores(row.rounds ?? row.childTotals ?? row.competitions, 'round'),
        problems: normalizeScores(row.problems ?? row.problemScores, 'problem'),
    };
}

function rowArray(value: unknown): CompetitionSeriesLeaderboardRow[] {
    const source = record(value);
    return array(
        Array.isArray(value)
            ? value
            : (source.rows ?? source.entries ?? source.leaderboard ?? source.content),
    ).map(normalizeLeaderboardRow);
}

function normalizeChildLeaderboard(
    value: unknown,
    index: number,
): CompetitionSeriesChildLeaderboard {
    const section = record(value);
    const competition = record(section.competition ?? section.child);
    const entries =
        section.rows ?? section.entries ?? section.leaderboard ?? section.completeLeaderboard;
    return {
        competitionId: numberValue(
            section.competitionId ?? section.childCompetitionId ?? competition.id ?? section.id,
        ),
        competitionName: stringValue(
            section.competitionName ?? competition.name ?? section.name,
            `#${index + 1}`,
        ),
        complete: section.complete === true,
        entries: rowArray(entries),
    };
}

export function normalizeCompetitionSeriesLeaderboard(
    payload: unknown,
    detailMode?: CompetitionSeriesMode,
): CompetitionSeriesLeaderboard {
    const raw = record(payload);
    const mode = modeValue(raw.mode ?? detailMode);
    const childSource =
        raw.children ??
        raw.sections ??
        raw.childLeaderboards ??
        raw.leaderboards ??
        raw.competitions;
    const combinedSource = raw.combined ?? raw.combinedLeaderboard;

    return {
        mode,
        children: array(childSource).map(normalizeChildLeaderboard),
        combined:
            mode === 'MULTI_ROUND' && combinedSource != null ? rowArray(combinedSource) : null,
    };
}

function endpoint(id: number | string, suffix = ''): string {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!base) throw new CompetitionSeriesApiError('Public API base URL is not configured');
    return `${base}/competition-series/${encodeURIComponent(String(id))}${suffix}`;
}

async function seriesJson(url: string, locale: string, authenticated: boolean): Promise<unknown> {
    const request = authenticated ? fetchApi : fetchPublicApi;
    const response = await request(url, {
        headers: { 'accept-language': locale },
        cache: 'no-store',
    });
    if (!response.ok) {
        throw new CompetitionSeriesApiError(
            `Competition series request failed with status ${response.status}`,
            response.status,
        );
    }
    return response.json();
}

export async function getCompetitionSeries(
    id: number | string,
    locale: string,
    options: { authenticated?: boolean } = {},
): Promise<CompetitionSeriesDetail> {
    return normalizeCompetitionSeriesDetail(
        await seriesJson(endpoint(id), locale, options.authenticated === true),
    );
}

export async function getCompetitionSeriesLeaderboard(
    id: number | string,
    locale: string,
    mode?: CompetitionSeriesMode,
    options: { authenticated?: boolean } = {},
): Promise<CompetitionSeriesLeaderboard> {
    return normalizeCompetitionSeriesLeaderboard(
        await seriesJson(endpoint(id, '/leaderboard'), locale, options.authenticated === true),
        mode,
    );
}
