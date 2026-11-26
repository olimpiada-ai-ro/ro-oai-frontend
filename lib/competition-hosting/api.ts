import type { RequiredFieldsUpdateRequest } from '@/lib/types';
import { fetchApi } from '@/lib/api';
import { fetchPublicApi } from '@/lib/public-api';
import { normalizeProblemProposal } from '@/lib/problem-proposals';
import type {
    CompetitionHostingPage,
    CompetitionHostingPermissions,
    CompetitionHostingRequest,
    CompetitionHostingRequestInput,
    CompetitionHostingRequestStatus,
    CompetitionInvitationDeliveryStatus,
    CompetitionInvitationPreview,
    CompetitionOrganizerDataConsent,
    CompetitionInviteeOption,
    CompetitionParticipantInvitation,
    CompetitionParticipantInvitationStatus,
    HostedCompetition,
    HostedCompetitionAccess,
    HostedCompetitionInput,
    HostedCompetitionLifecycle,
    HostedCompetitionMode,
    HostedCompetitionParticipant,
    HostedCompetitionPermissions,
    HostedCompetitionProblem,
} from '@/lib/competition-hosting/types';
import type { ProblemProposal } from '@/lib/problem-proposals';

type UnknownRecord = Record<string, unknown>;
type SpringPage<T> = {
    content?: T[];
    items?: T[];
    page?: number | { number?: number; size?: number; totalElements?: number; totalPages?: number };
    number?: number;
    size?: number;
    totalElements?: number;
    totalPages?: number;
};

const REQUEST_STATUSES = new Set<CompetitionHostingRequestStatus>([
    'DRAFT',
    'PENDING',
    'CHANGES_REQUESTED',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
]);
const INVITATION_STATUSES = new Set<CompetitionParticipantInvitationStatus>([
    'PENDING',
    'ACCEPTED',
    'REVOKED',
    'EXPIRED',
]);
const INVITATION_DELIVERY_STATUSES = new Set<CompetitionInvitationDeliveryStatus>([
    'QUEUED',
    'SENT',
    'FAILED',
]);

export class CompetitionHostingApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly code?: string,
    ) {
        super(message);
        this.name = 'CompetitionHostingApiError';
    }
}

function apiUrl(path: string): URL {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!base) throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured');
    return new URL(path.replace(/^\//, ''), `${base.replace(/\/$/, '')}/`);
}

function asRecord(value: unknown): UnknownRecord | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as UnknownRecord)
        : null;
}

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function asNullableNumber(value: unknown): number | null {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

async function parseError(
    response: Response,
    fallback: string,
): Promise<CompetitionHostingApiError> {
    const payload = asRecord(await response.json().catch(() => null));
    return new CompetitionHostingApiError(
        response.status,
        asNullableString(payload?.publicErrorMessage) ??
            asNullableString(payload?.message) ??
            asNullableString(payload?.error) ??
            fallback,
        asNullableString(payload?.errorCode ?? payload?.code) ?? undefined,
    );
}

function requestStatus(value: unknown): CompetitionHostingRequestStatus {
    const normalized = asString(value, 'DRAFT').toUpperCase();
    const aliases: Record<string, CompetitionHostingRequestStatus> = {
        IN_REVIEW: 'PENDING',
        SUBMITTED: 'PENDING',
        PUBLISHED: 'APPROVED',
    };
    return (
        aliases[normalized] ??
        (REQUEST_STATUSES.has(normalized as CompetitionHostingRequestStatus)
            ? (normalized as CompetitionHostingRequestStatus)
            : 'DRAFT')
    );
}

function competitionMode(value: unknown): HostedCompetitionMode {
    return asString(value).toUpperCase() === 'CASUAL' ? 'CASUAL' : 'CLASSIC';
}

function competitionAccess(value: unknown, isPrivate?: unknown): HostedCompetitionAccess {
    const normalized = asString(value).toUpperCase();
    if (normalized === 'PUBLIC' || normalized === 'PRIVATE') return normalized;
    return asBoolean(isPrivate, true) ? 'PRIVATE' : 'PUBLIC';
}

function lifecycle(
    startTime: string,
    endTime: string,
    value?: unknown,
): HostedCompetitionLifecycle {
    const normalized = asString(value).toUpperCase();
    if (normalized === 'UPCOMING' || normalized === 'ONGOING' || normalized === 'ENDED') {
        return normalized;
    }
    const now = Date.now();
    const start = Date.parse(startTime);
    const end = Date.parse(endTime);
    if (Number.isFinite(end) && end <= now) return 'ENDED';
    if (Number.isFinite(start) && start <= now) return 'ONGOING';
    return 'UPCOMING';
}

function defaultRequestPermissions(
    status: CompetitionHostingRequestStatus,
): CompetitionHostingPermissions {
    const editable = status === 'DRAFT' || status === 'CHANGES_REQUESTED';
    return {
        canEdit: editable,
        canSubmit: editable,
        canResubmit: status === 'CHANGES_REQUESTED',
        canCancelReview: status === 'PENDING' || status === 'CHANGES_REQUESTED',
        canDeleteDraft: status === 'DRAFT',
        canAddProblems: ['DRAFT', 'PENDING', 'CHANGES_REQUESTED', 'CANCELLED'].includes(status),
    };
}

function normalizeProblemRows(value: unknown): ProblemProposal[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((candidate) =>
        asRecord(candidate) ? [normalizeProblemProposal(candidate)] : [],
    );
}

function hostingRequestPayload(input: CompetitionHostingRequestInput) {
    return {
        version: input.version,
        name: input.name,
        shortDescription: input.shortDescription,
        description: input.description,
        rules: input.rules,
        startTime: input.startTime,
        endTime: input.endTime,
        competitionType: input.competitionType,
        isPrivate: input.access === 'PRIVATE',
        allowPublicQuestions: input.allowPublicQuestions,
        commentsEnabled: input.commentsEnabled,
        selectionLimit: input.selectionLimit,
        requestMode: input.requestMode,
    };
}

export function normalizeCompetitionHostingRequest(value: unknown): CompetitionHostingRequest {
    const row = asRecord(value) ?? {};
    const current = asRecord(row.currentRevision ?? row.revision) ?? row;
    const status = requestStatus(row.status);
    const defaults = defaultRequestPermissions(status);
    const permissions = asRecord(row.permissions);
    return {
        id: asNumber(row.id ?? row.requestId),
        name: asString(current.name ?? row.name ?? current.title ?? row.title),
        shortDescription: asString(
            current.shortDescription ?? row.shortDescription ?? current.summary ?? row.summary,
        ),
        description: asString(current.description ?? row.description),
        rules: asString(current.rules ?? row.rules),
        startTime: asString(current.startTime ?? row.startTime),
        endTime: asString(current.endTime ?? row.endTime),
        requestMode:
            asString(current.requestMode ?? row.requestMode).toUpperCase() === 'WITH_PROBLEMS'
                ? 'WITH_PROBLEMS'
                : 'COMPETITION_ONLY',
        competitionType: competitionMode(current.competitionType ?? row.competitionType),
        access: competitionAccess(current.access ?? row.access, current.isPrivate ?? row.isPrivate),
        allowPublicQuestions: asBoolean(
            current.allowPublicQuestions ?? row.allowPublicQuestions,
            true,
        ),
        commentsEnabled: asBoolean(current.commentsEnabled ?? row.commentsEnabled, true),
        selectionLimit: Math.max(1, asNumber(current.selectionLimit ?? row.selectionLimit, 1)),
        status,
        reviewerMessage:
            asNullableString(row.reviewerNote) ??
            asNullableString(row.reviewerMessage) ??
            asNullableString(row.reviewMessage) ??
            asNullableString(asRecord(row.latestReview)?.reviewerMessage),
        approvedCompetitionId: asNullableNumber(
            row.approvedCompetitionId ?? row.competitionId ?? asRecord(row.competition)?.id,
        ),
        problemProposals: normalizeProblemRows(
            row.problemProposals ?? row.proposals ?? row.problems,
        ),
        permissions: permissions
            ? {
                  canEdit: asBoolean(permissions.canEdit, defaults.canEdit),
                  canSubmit: asBoolean(permissions.canSubmit, defaults.canSubmit),
                  canResubmit: asBoolean(permissions.canResubmit, defaults.canResubmit),
                  canCancelReview: asBoolean(
                      permissions.canCancelReview ?? permissions.canCancel,
                      defaults.canCancelReview,
                  ),
                  canDeleteDraft: asBoolean(
                      permissions.canDeleteDraft ?? permissions.canDelete,
                      defaults.canDeleteDraft,
                  ),
                  canAddProblems: asBoolean(permissions.canAddProblems, defaults.canAddProblems),
              }
            : defaults,
        version: asNumber(row.version),
        createdAt: asString(row.createdAt, new Date(0).toISOString()),
        updatedAt: asString(row.updatedAt ?? row.createdAt, new Date(0).toISOString()),
    };
}

function defaultHostedPermissions(): HostedCompetitionPermissions {
    return {
        approvedHosting: false,
        canEditContent: false,
        canEditSchedule: false,
        canSubmitProblems: false,
        canManageParticipants: false,
        canInviteParticipants: false,
    };
}

function normalizeHostedProblem(value: unknown): HostedCompetitionProblem | null {
    const row = asRecord(value);
    if (!row) return null;
    const id = asNumber(row.id ?? row.problemId ?? row.proposalId);
    if (id <= 0) return null;
    return {
        id,
        proposalId: asNullableNumber(row.proposalId ?? row.problemProposalId),
        title: asString(row.title ?? row.name, `#${id}`),
        status: asString(row.status ?? row.proposalStatus, 'APPROVED').toUpperCase(),
        evaluationType: asNullableString(row.evaluationType ?? row.submissionFormat),
        updatedAt: asNullableString(row.updatedAt ?? row.createdAt),
    };
}

export function normalizeHostedCompetition(value: unknown): HostedCompetition {
    const outer = asRecord(value) ?? {};
    const row = asRecord(outer.competition) ?? outer;
    const permissions = asRecord(outer.permissions ?? row.permissions);
    const defaults = defaultHostedPermissions();
    const startTime = asString(row.startTime);
    const endTime = asString(row.endTime);
    const problemsRaw = row.problems ?? outer.problems;
    const problems = Array.isArray(problemsRaw)
        ? problemsRaw.flatMap((candidate) => {
              const problem = normalizeHostedProblem(candidate);
              return problem ? [problem] : [];
          })
        : [];
    return {
        id: asNumber(row.id ?? outer.competitionId),
        name: asString(row.name),
        shortDescription: asString(row.shortDescription ?? row.summary),
        description: asString(row.description),
        rules: asString(row.rules),
        startTime,
        endTime,
        competitionType: competitionMode(row.competitionType),
        access: competitionAccess(row.access, row.isPrivate),
        lifecycle: lifecycle(startTime, endTime, row.lifecycle ?? row.status),
        allowPublicQuestions: asBoolean(row.allowPublicQuestions, true),
        commentsEnabled: asBoolean(row.commentsEnabled, true),
        selectionLimit: Math.max(1, asNumber(row.selectionLimit, 1)),
        participantCount: Math.max(
            0,
            asNumber(outer.participantCount ?? row.participantCount ?? row.numberOfParticipants),
        ),
        pendingInvitationCount: Math.max(
            0,
            asNumber(outer.pendingInvitationCount ?? row.pendingInvitationCount),
        ),
        problemCount: Math.max(
            0,
            asNumber(
                outer.problemCount ?? row.problemCount ?? row.problemProposalCount,
                problems.length,
            ),
        ),
        problems,
        permissions: permissions
            ? {
                  approvedHosting: asBoolean(permissions.approvedHosting, defaults.approvedHosting),
                  canEditContent: asBoolean(permissions.canEditContent, defaults.canEditContent),
                  canEditSchedule: asBoolean(permissions.canEditSchedule, defaults.canEditSchedule),
                  canSubmitProblems: asBoolean(
                      permissions.canSubmitProblems,
                      defaults.canSubmitProblems,
                  ),
                  canManageParticipants: asBoolean(
                      permissions.canManageParticipants,
                      defaults.canManageParticipants,
                  ),
                  canInviteParticipants: asBoolean(
                      permissions.canInviteParticipants ?? permissions.canInvite,
                      defaults.canInviteParticipants,
                  ),
              }
            : defaults,
        version: asNumber(row.version ?? outer.version),
        createdAt: asNullableString(row.createdAt ?? outer.createdAt),
        updatedAt: asNullableString(row.updatedAt ?? outer.updatedAt),
    };
}

function normalizePage<T>(
    value: unknown,
    normalizer: (candidate: unknown) => T,
    fallbackPage = 0,
    fallbackSize = 20,
): CompetitionHostingPage<T> {
    const payload = (Array.isArray(value) ? { content: value } : value) as SpringPage<unknown>;
    const rows = payload.content ?? payload.items ?? [];
    const page = typeof payload.page === 'object' ? payload.page : undefined;
    const content = rows.map(normalizer);
    return {
        content,
        page: {
            number:
                (typeof payload.page === 'number' ? payload.page : page?.number) ??
                payload.number ??
                fallbackPage,
            size: page?.size ?? payload.size ?? fallbackSize,
            totalElements: page?.totalElements ?? payload.totalElements ?? content.length,
            totalPages: page?.totalPages ?? payload.totalPages ?? (content.length > 0 ? 1 : 0),
        },
    };
}

async function getAllProblemProposals(
    path: string,
    fallbackMessage: string,
): Promise<ProblemProposal[]> {
    const results: ProblemProposal[] = [];
    const pageSize = 50;
    let requestedPage = 0;
    let totalPages = 1;

    while (requestedPage < totalPages) {
        const url = apiUrl(path);
        url.searchParams.set('page', String(requestedPage));
        url.searchParams.set('size', String(pageSize));
        const response = await fetchApi(url);
        if (!response.ok) throw await parseError(response, fallbackMessage);
        const current = normalizePage(
            await response.json(),
            normalizeProblemProposal,
            requestedPage,
            pageSize,
        );
        results.push(...current.content);
        totalPages =
            Number.isSafeInteger(current.page.totalPages) && current.page.totalPages > 0
                ? Math.min(current.page.totalPages, 10_000)
                : requestedPage + 1;
        requestedPage += 1;
    }

    return results;
}

export async function getMyCompetitionHostingRequests({
    page = 0,
    size = 20,
}: { page?: number; size?: number } = {}): Promise<
    CompetitionHostingPage<CompetitionHostingRequest>
> {
    const url = apiUrl('/me/competition-hosting-requests');
    url.searchParams.set('page', String(Math.max(0, page)));
    url.searchParams.set('size', String(Math.max(1, Math.min(50, size))));
    const response = await fetchApi(url);
    if (!response.ok) throw await parseError(response, 'Unable to load your hosting requests');
    return normalizePage(await response.json(), normalizeCompetitionHostingRequest, page, size);
}

export async function getMyCompetitionHostingRequest(
    id: number,
): Promise<CompetitionHostingRequest> {
    const response = await fetchApi(
        apiUrl(`/me/competition-hosting-requests/${encodeURIComponent(id)}`),
    );
    if (!response.ok) throw await parseError(response, 'Unable to load this hosting request');
    return normalizeCompetitionHostingRequest(await response.json());
}

export async function createCompetitionHostingRequest(
    input: CompetitionHostingRequestInput,
): Promise<CompetitionHostingRequest> {
    const response = await fetchApi(apiUrl('/me/competition-hosting-requests'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(hostingRequestPayload(input)),
    });
    if (!response.ok) throw await parseError(response, 'Unable to create this hosting request');
    return normalizeCompetitionHostingRequest(await response.json());
}

export async function saveCompetitionHostingRequest(
    id: number,
    input: CompetitionHostingRequestInput,
): Promise<CompetitionHostingRequest> {
    const response = await fetchApi(
        apiUrl(`/me/competition-hosting-requests/${encodeURIComponent(id)}`),
        {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(hostingRequestPayload(input)),
        },
    );
    if (!response.ok) throw await parseError(response, 'Unable to save this hosting request');
    return normalizeCompetitionHostingRequest(await response.json());
}

export async function deleteCompetitionHostingRequest(
    request: CompetitionHostingRequest,
): Promise<void> {
    const response = await fetchApi(
        apiUrl(`/me/competition-hosting-requests/${encodeURIComponent(request.id)}`),
        {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ version: request.version }),
        },
    );
    if (!response.ok) throw await parseError(response, 'Unable to delete this hosting request');
}

async function runHostingRequestAction(
    request: CompetitionHostingRequest,
    action: 'submit' | 'resubmit' | 'cancel',
    note?: string,
): Promise<CompetitionHostingRequest> {
    const response = await fetchApi(
        apiUrl(`/me/competition-hosting-requests/${encodeURIComponent(request.id)}/${action}`),
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                version: request.version,
                ...(note?.trim() ? { rationale: note.trim() } : {}),
            }),
        },
    );
    if (!response.ok) throw await parseError(response, 'Unable to update this hosting request');
    const body = await response.json().catch(() => null);
    return asRecord(body)
        ? normalizeCompetitionHostingRequest(body)
        : getMyCompetitionHostingRequest(request.id);
}

export const submitCompetitionHostingRequest = (
    request: CompetitionHostingRequest,
    note?: string,
) => runHostingRequestAction(request, 'submit', note);
export const resubmitCompetitionHostingRequest = (
    request: CompetitionHostingRequest,
    note?: string,
) => runHostingRequestAction(request, 'resubmit', note);
export const cancelCompetitionHostingRequestReview = (request: CompetitionHostingRequest) =>
    runHostingRequestAction(request, 'cancel');

export async function getMyHostedCompetitions({
    page = 0,
    size = 20,
}: { page?: number; size?: number } = {}): Promise<CompetitionHostingPage<HostedCompetition>> {
    const url = apiUrl('/me/hosted-competitions');
    url.searchParams.set('page', String(Math.max(0, page)));
    url.searchParams.set('size', String(Math.max(1, Math.min(50, size))));
    const response = await fetchApi(url);
    if (!response.ok) throw await parseError(response, 'Unable to load your competitions');
    return normalizePage(await response.json(), normalizeHostedCompetition, page, size);
}

export async function getMyHostedCompetition(id: number): Promise<HostedCompetition> {
    const response = await fetchApi(apiUrl(`/me/hosted-competitions/${encodeURIComponent(id)}`));
    if (!response.ok) throw await parseError(response, 'Unable to load this competition');
    return normalizeHostedCompetition(await response.json());
}

export async function saveHostedCompetition(
    id: number,
    input: HostedCompetitionInput,
): Promise<HostedCompetition> {
    const response = await fetchApi(apiUrl(`/me/hosted-competitions/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            version: input.version,
            name: input.name,
            shortDescription: input.shortDescription,
            description: input.description,
            rules: input.rules,
            startTime: input.startTime,
            endTime: input.endTime,
            competitionType: input.competitionType,
            isPrivate: input.access === 'PRIVATE',
            allowPublicQuestions: input.allowPublicQuestions,
            commentsEnabled: input.commentsEnabled,
            selectionLimit: input.selectionLimit,
        }),
    });
    if (!response.ok) throw await parseError(response, 'Unable to save this competition');
    return normalizeHostedCompetition(await response.json());
}

export async function getHostedCompetitionProblemProposals(
    competitionId: number,
): Promise<ProblemProposal[]> {
    return getAllProblemProposals(
        `/me/hosted-competitions/${encodeURIComponent(competitionId)}/problem-proposals`,
        'Unable to load competition problems',
    );
}

export async function getHostingRequestProblemProposals(
    requestId: number,
): Promise<ProblemProposal[]> {
    return getAllProblemProposals(
        `/me/competition-hosting-requests/${encodeURIComponent(requestId)}/problem-proposals`,
        'Unable to load proposed problems',
    );
}

export function normalizeHostedCompetitionParticipant(
    value: unknown,
): HostedCompetitionParticipant {
    const row = asRecord(value) ?? {};
    const user = asRecord(row.user) ?? row;
    const sharePersonalDataWithOrganizer = asBoolean(row.sharePersonalDataWithOrganizer);
    const firstName = sharePersonalDataWithOrganizer
        ? asNullableString(row.firstName ?? user.firstName)
        : null;
    const lastName = sharePersonalDataWithOrganizer
        ? asNullableString(row.lastName ?? user.lastName)
        : null;
    const username = asNullableString(user.username);
    return {
        id: asNumber(row.id ?? row.participantId),
        username,
        displayName:
            asNullableString(row.displayName ?? user.displayName) ?? username ?? 'Participant',
        email: sharePersonalDataWithOrganizer ? asNullableString(row.email ?? user.email) : null,
        firstName,
        lastName,
        grade: sharePersonalDataWithOrganizer ? asNullableString(row.grade ?? user.grade) : null,
        institution: sharePersonalDataWithOrganizer
            ? asNullableString(
                  row.institution ??
                      row.institutionName ??
                      user.institution ??
                      user.institutionName,
              )
            : null,
        sharePersonalDataWithOrganizer,
        consentedAt: asNullableString(row.consentedAt),
        decisionUpdatedAt: asNullableString(row.decisionUpdatedAt),
        consentNoticeVersion: asNullableString(row.consentNoticeVersion ?? row.noticeVersion),
        avatar: asNullableString(user.avatar ?? row.avatar),
        joinedAt: asNullableString(row.joinedAt ?? row.createdAt),
        disabled: asBoolean(row.disabled),
        hasSubmissions: asBoolean(row.hasSubmissions),
        canRemove: asBoolean(row.canRemove, !asBoolean(row.disabled)),
    };
}

export function normalizeCompetitionParticipantInvitation(
    value: unknown,
): CompetitionParticipantInvitation {
    const row = asRecord(value) ?? {};
    const user = asRecord(row.user);
    const normalizedStatus = asString(row.status, 'PENDING').toUpperCase();
    const status = INVITATION_STATUSES.has(
        normalizedStatus as CompetitionParticipantInvitationStatus,
    )
        ? (normalizedStatus as CompetitionParticipantInvitationStatus)
        : 'PENDING';
    const email = asNullableString(row.email);
    const normalizedDeliveryStatus = asString(row.deliveryStatus).toUpperCase();
    const deliveryStatus = INVITATION_DELIVERY_STATUSES.has(
        normalizedDeliveryStatus as CompetitionInvitationDeliveryStatus,
    )
        ? (normalizedDeliveryStatus as CompetitionInvitationDeliveryStatus)
        : null;
    return {
        id: asString(row.id ?? row.invitationId),
        recipientType: asNullableString(row.recipientUserId ?? row.userId ?? user?.userId)
            ? 'PLATFORM_USER'
            : 'EMAIL',
        userId: asNullableString(row.recipientUserId ?? row.userId ?? user?.userId),
        username: asNullableString(row.username ?? user?.username),
        displayName: asNullableString(row.displayName ?? user?.displayName),
        email,
        maskedEmail: asNullableString(row.maskedEmail) ?? email,
        status,
        expiresAt: asNullableString(row.expiresAt),
        createdAt: asNullableString(row.createdAt),
        lastSentAt: asNullableString(row.lastSentAt ?? row.sentAt),
        deliveryStatus,
        deliveryAttemptedAt: asNullableString(row.deliveryAttemptedAt),
        deliveryAttemptCount: Math.max(0, Math.trunc(asNumber(row.deliveryAttemptCount))),
        version: asNumber(row.version),
        canResend: asBoolean(row.canResend, status === 'PENDING'),
        canRevoke: asBoolean(row.canRevoke, status === 'PENDING'),
    };
}

export async function getHostedCompetitionParticipants(
    competitionId: number,
    { page = 0, size = 20 }: { page?: number; size?: number } = {},
): Promise<CompetitionHostingPage<HostedCompetitionParticipant>> {
    const url = apiUrl(`/me/hosted-competitions/${encodeURIComponent(competitionId)}/participants`);
    url.searchParams.set('page', String(Math.max(0, page)));
    url.searchParams.set('size', String(Math.max(1, Math.min(50, size))));
    const response = await fetchApi(url);
    if (!response.ok) throw await parseError(response, 'Unable to load participants');
    return normalizePage(await response.json(), normalizeHostedCompetitionParticipant, page, size);
}

export async function getHostedCompetitionInvitations(
    competitionId: number,
    { page = 0, size = 20 }: { page?: number; size?: number } = {},
): Promise<CompetitionHostingPage<CompetitionParticipantInvitation>> {
    const url = apiUrl(`/me/hosted-competitions/${encodeURIComponent(competitionId)}/invitations`);
    url.searchParams.set('page', String(Math.max(0, page)));
    url.searchParams.set('size', String(Math.max(1, Math.min(50, size))));
    const response = await fetchApi(url);
    if (!response.ok) throw await parseError(response, 'Unable to load invitations');
    return normalizePage(
        await response.json(),
        normalizeCompetitionParticipantInvitation,
        page,
        size,
    );
}

export async function searchCompetitionInvitees(
    competitionId: number,
    query: string,
): Promise<CompetitionInviteeOption[]> {
    const normalized = query.trim();
    if (normalized.length < 2) return [];
    const url = apiUrl(`/me/hosted-competitions/${encodeURIComponent(competitionId)}/users/search`);
    url.searchParams.set('query', normalized);
    url.searchParams.set('size', '8');
    const response = await fetchApi(url);
    if (!response.ok) throw await parseError(response, 'Unable to search platform users');
    const payload = (await response.json()) as unknown;
    const rows = Array.isArray(payload)
        ? payload
        : (((asRecord(payload)?.content ?? asRecord(payload)?.items) as unknown[] | undefined) ??
          []);
    return rows.flatMap((candidate) => {
        const row = asRecord(candidate);
        const userId = asNullableString(row?.userId ?? row?.id);
        if (!row || !userId) return [];
        const username = asNullableString(row.username);
        return [
            {
                userId,
                username: username ?? '',
                displayName:
                    asNullableString(row.displayName) ??
                    ([asString(row.firstName), asString(row.lastName)].filter(Boolean).join(' ') ||
                        username) ??
                    'User',
                avatar: asNullableString(row.avatar),
            },
        ];
    });
}

export async function inviteHostedCompetitionParticipant(
    competitionId: number,
    recipient: ({ userId: string } | { email: string }) & {
        message?: string | null;
        expiresAt?: string | null;
    },
): Promise<CompetitionParticipantInvitation> {
    const response = await fetchApi(
        apiUrl(`/me/hosted-competitions/${encodeURIComponent(competitionId)}/invitations`),
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(recipient),
        },
    );
    if (!response.ok) throw await parseError(response, 'Unable to send this invitation');
    return normalizeCompetitionParticipantInvitation(await response.json());
}

export async function resendHostedCompetitionInvitation(
    competitionId: number,
    invitation: CompetitionParticipantInvitation,
    expiresAt?: string | null,
): Promise<CompetitionParticipantInvitation> {
    const response = await fetchApi(
        apiUrl(
            `/me/hosted-competitions/${encodeURIComponent(competitionId)}/invitations/${encodeURIComponent(invitation.id)}/resend`,
        ),
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ version: invitation.version, expiresAt: expiresAt ?? null }),
        },
    );
    if (!response.ok) throw await parseError(response, 'Unable to resend this invitation');
    return normalizeCompetitionParticipantInvitation(await response.json());
}

export async function revokeHostedCompetitionInvitation(
    competitionId: number,
    invitation: CompetitionParticipantInvitation,
): Promise<void> {
    const response = await fetchApi(
        apiUrl(
            `/me/hosted-competitions/${encodeURIComponent(competitionId)}/invitations/${encodeURIComponent(invitation.id)}`,
        ),
        {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ version: invitation.version }),
        },
    );
    if (!response.ok) throw await parseError(response, 'Unable to revoke this invitation');
}

export async function removeHostedCompetitionParticipant(
    competitionId: number,
    participantId: number,
): Promise<void> {
    const response = await fetchApi(
        apiUrl(
            `/me/hosted-competitions/${encodeURIComponent(competitionId)}/participants/${encodeURIComponent(participantId)}`,
        ),
        { method: 'DELETE' },
    );
    if (!response.ok) throw await parseError(response, 'Unable to remove this participant');
}

export async function getCompetitionInvitation(
    token: string,
): Promise<CompetitionInvitationPreview> {
    const response = await fetchPublicApi(apiUrl('/competition-invitations/preview'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
        cache: 'no-store',
    });
    if (!response.ok) throw await parseError(response, 'Unable to load this invitation');
    const row = asRecord(await response.json()) ?? {};
    const competition = asRecord(row.competition);
    const id = asNumber(competition?.id ?? row.competitionId);
    const status = asString(row.status, 'INVALID');
    return {
        valid: asBoolean(row.valid) || status.toUpperCase() === 'PENDING',
        ...(row.sharedLink === true
            ? {
                  sharedLink: true,
                  requiredFields: Array.isArray(row.requiredFields)
                      ? row.requiredFields.filter(
                            (field): field is string => typeof field === 'string',
                        )
                      : [],
                  validGrades: Array.isArray(row.validGrades)
                      ? row.validGrades.filter(
                            (grade): grade is string => typeof grade === 'string',
                        )
                      : [],
              }
            : {}),
        thirdPartyHosted: asBoolean(row.thirdPartyHosted),
        status,
        maskedEmail: asNullableString(row.maskedEmail),
        competition:
            id > 0
                ? {
                      id,
                      name: asString(competition?.name ?? row.competitionName, `#${id}`),
                  }
                : null,
        organizerName: asNullableString(
            row.organizerDisplayName ?? row.organizerName ?? asRecord(row.organizer)?.displayName,
        ),
        expiresAt: asNullableString(row.expiresAt),
        message: asNullableString(row.message),
        consentNoticeVersion: asNullableString(row.consentNoticeVersion ?? row.noticeVersion),
    };
}

export async function redeemStoredCompetitionInvitation(
    handle: string,
    sharePersonalDataWithOrganizer?: boolean,
    registration?: RequiredFieldsUpdateRequest,
): Promise<{ competitionId: number }> {
    const response = await fetch(
        `/api/competition-invitations/${encodeURIComponent(handle)}/redeem`,
        {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sharePersonalDataWithOrganizer, registration }),
        },
    );
    if (!response.ok) throw await parseError(response, 'Unable to accept this invitation');
    const row = asRecord(await response.json()) ?? {};
    const competitionId = asNumber(row.competitionId ?? asRecord(row.competition)?.id);
    if (competitionId <= 0) {
        throw new CompetitionHostingApiError(502, 'The invitation returned an invalid response');
    }
    return { competitionId };
}

export function normalizeCompetitionOrganizerDataConsent(
    value: unknown,
): CompetitionOrganizerDataConsent {
    const row = asRecord(value) ?? {};
    return {
        thirdPartyHosted: asBoolean(row.thirdPartyHosted),
        organizerDisplayName: asNullableString(row.organizerDisplayName),
        noticeVersion: asNullableString(row.noticeVersion),
        joined: asBoolean(row.joined),
        sharePersonalDataWithOrganizer:
            typeof row.sharePersonalDataWithOrganizer === 'boolean'
                ? row.sharePersonalDataWithOrganizer
                : null,
        consentedAt: asNullableString(row.consentedAt),
        decisionUpdatedAt: asNullableString(row.decisionUpdatedAt),
    };
}

export async function getCompetitionOrganizerDataConsent(
    competitionId: number | string,
): Promise<CompetitionOrganizerDataConsent> {
    const response = await fetchApi(
        apiUrl(`/competitions/${encodeURIComponent(competitionId)}/organizer-data-consent`),
    );
    if (!response.ok) {
        throw await parseError(response, 'Unable to load organizer data-sharing settings');
    }
    return normalizeCompetitionOrganizerDataConsent(await response.json());
}

export async function updateCompetitionOrganizerDataConsent(
    competitionId: number | string,
    sharePersonalDataWithOrganizer: boolean,
): Promise<CompetitionOrganizerDataConsent> {
    const response = await fetchApi(
        apiUrl(`/competitions/${encodeURIComponent(competitionId)}/organizer-data-consent`),
        {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sharePersonalDataWithOrganizer }),
        },
    );
    if (!response.ok) {
        throw await parseError(response, 'Unable to update organizer data-sharing settings');
    }
    return normalizeCompetitionOrganizerDataConsent(await response.json());
}
