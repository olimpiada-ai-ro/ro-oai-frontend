import { cache } from 'react';

import { fetchApi } from '@/lib/api';
import { fetchPublicApi } from '@/lib/public-api';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale, type ProblemAuthor } from '@/lib/types';
import { normalizeIdentityPresentation } from '@/lib/identity-presentation';
import type {
    ArticleDetail,
    ArticleDraftInput,
    ArticleInvitationPreview,
    ArticleChangeOperation,
    ArticleChangeRequestStatus,
    ArticleAuthor,
    ArticlePage,
    EditorialOpportunityOverview,
    EditorialOpportunityProblem,
    ArticleProblemOption,
    ArticleProblemReference,
    ArticleSharedSubmission,
    ArticleSubmissionOption,
    ArticleSummary,
    MarkdownPreview,
    OwnedArticle,
    OwnedArticlePage,
    ArticleImage,
    ArticleImageList,
    AdminArticlePreviewRevision,
    AdminArticleReviewPreviewRevision,
} from '@/lib/articles/types';

type SpringPage<T> = {
    items?: T[];
    content?: T[];
    page?:
        | number
        | {
              number?: number;
              size?: number;
              totalElements?: number;
              totalPages?: number;
          };
    number?: number;
    size?: number;
    totalElements?: number;
    totalPages?: number;
};

type ArticleChangeTransport = {
    id?: number;
    changeRequestId?: number;
    operation?: ArticleChangeOperation;
    type?: ArticleChangeOperation;
    status?: ArticleChangeRequestStatus;
    submittedAt?: string;
    createdAt?: string;
    updatedAt?: string | null;
    reviewerMessage?: string | null;
    reviewMessage?: string | null;
    reviewerNote?: string | null;
    version?: number;
};

type ArticleTransport = Omit<
    Partial<ArticleSummary & ArticleDetail & OwnedArticle>,
    'latestChangeRequest'
> & {
    html?: string;
    renderedHtml?: string;
    status?: ArticleSummary['publicationStatus'];
    problemId?: number | null;
    problemTitle?: string | null;
    currentRevision?: {
        revisionId?: number;
        title?: string;
        excerpt?: string;
        markdown?: string;
        authors?: ArticleSummary['authors'];
        sharedSubmission?: unknown;
        sourceSharingConsent?: boolean;
        createdBy?: string;
        createdAt?: string;
    };
    publishedRevision?: {
        revisionId?: number;
        title?: string;
        excerpt?: string;
        markdown?: string;
        authors?: ArticleSummary['authors'];
        sharedSubmission?: unknown;
        sourceSharingConsent?: boolean;
        createdBy?: string;
        createdAt?: string;
    } | null;
    latestChangeRequest?: ArticleChangeTransport | null;
    pendingChange?: ArticleChangeTransport | null;
    images?: unknown;
};

type InvitationTransport = Partial<ArticleInvitationPreview>;

type ArticleImageTransport = {
    id?: unknown;
    imageId?: unknown;
    markdownUrl?: unknown;
    url?: unknown;
    previewUrl?: unknown;
    contentType?: unknown;
    mimeType?: unknown;
    sizeBytes?: unknown;
    byteSize?: unknown;
    size?: unknown;
    width?: unknown;
    height?: unknown;
    altText?: unknown;
    referencedInCurrent?: unknown;
    referencedInPublished?: unknown;
    countsTowardsDraftLimit?: unknown;
};

function normalizeAuthors(value: unknown): ArticleAuthor[] {
    if (!Array.isArray(value)) return [];

    return value.flatMap((candidate): ArticleAuthor[] => {
        if (!candidate || typeof candidate !== 'object') return [];
        const author = candidate as Record<string, unknown>;
        if (typeof author.userId !== 'string' || !author.userId.trim()) return [];

        return [
            {
                userId: author.userId,
                username:
                    typeof author.username === 'string' && author.username.trim()
                        ? author.username
                        : null,
                displayName:
                    typeof author.displayName === 'string' && author.displayName.trim()
                        ? author.displayName
                        : null,
                avatar: typeof author.avatar === 'string' ? author.avatar : null,
                role: typeof author.role === 'string' ? author.role : null,
                displayOrder: Number.isFinite(author.displayOrder)
                    ? Number(author.displayOrder)
                    : undefined,
                isProblemAuthor:
                    typeof author.isProblemAuthor === 'boolean'
                        ? author.isProblemAuthor
                        : undefined,
                identityPresentation: normalizeIdentityPresentation(author.identityPresentation),
            },
        ];
    });
}

function normalizeProblemAuthors(value: unknown): ProblemAuthor[] {
    if (!Array.isArray(value)) return [];

    return value
        .flatMap((candidate, index): ProblemAuthor[] => {
            if (!candidate || typeof candidate !== 'object') return [];
            const author = candidate as Record<string, unknown>;
            const firstName =
                typeof author.firstName === 'string' && author.firstName.trim()
                    ? author.firstName.trim()
                    : null;
            const lastName =
                typeof author.lastName === 'string' && author.lastName.trim()
                    ? author.lastName.trim()
                    : null;
            const fullName = [firstName, lastName].filter(Boolean).join(' ');
            const displayName =
                fullName ||
                (typeof author.displayName === 'string' ? author.displayName.trim() : '');
            if (!displayName) return [];

            return [
                {
                    userId:
                        typeof author.userId === 'string' && author.userId.trim()
                            ? author.userId.trim()
                            : null,
                    firstName,
                    lastName,
                    displayName,
                    username:
                        typeof author.username === 'string' && author.username.trim()
                            ? author.username.trim()
                            : null,
                    avatar:
                        typeof author.avatar === 'string' && author.avatar.trim()
                            ? author.avatar
                            : null,
                    displayOrder: Number.isFinite(author.displayOrder)
                        ? Number(author.displayOrder)
                        : index,
                    identityPresentation: normalizeIdentityPresentation(
                        author.identityPresentation,
                    ),
                },
            ];
        })
        .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));
}

function normalizeProblemReference(
    value: unknown,
    fallbackId?: number | null,
    fallbackTitle?: string | null,
): ArticleProblemReference | null {
    const candidate =
        value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
    const id = Number(candidate?.id ?? fallbackId);
    if (!Number.isFinite(id) || id <= 0) return null;

    return {
        id,
        title:
            typeof candidate?.title === 'string' && candidate.title.trim()
                ? candidate.title
                : fallbackTitle?.trim() || `#${id}`,
        authors: normalizeProblemAuthors(candidate?.authors),
    };
}

export class ArticleApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly code?: string,
    ) {
        super(message);
        this.name = 'ArticleApiError';
    }
}

function apiUrl(path: string): URL {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!base) throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured');
    return new URL(path, `${base.replace(/\/$/, '')}/`);
}

function normalizeApiResourceUrl(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!base) return null;

    try {
        const apiBase = new URL(`${base.replace(/\/$/, '')}/`);
        const trimmed = value.trim();
        // Public DTOs use stable relative API paths. Authenticated and admin
        // previews may instead carry a direct presigned object-storage URL.
        const candidate = /^https?:\/\//i.test(trimmed)
            ? new URL(trimmed)
            : new URL(trimmed, apiBase);
        if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') return null;
        return candidate.toString();
    } catch {
        return null;
    }
}

async function parseError(response: Response, fallback: string): Promise<ArticleApiError> {
    const payload = (await response.json().catch(() => null)) as {
        message?: unknown;
        error?: unknown;
        code?: unknown;
        publicErrorMessage?: unknown;
        errorCode?: unknown;
    } | null;
    const message =
        typeof payload?.publicErrorMessage === 'string'
            ? payload.publicErrorMessage
            : typeof payload?.message === 'string'
              ? payload.message
              : typeof payload?.error === 'string'
                ? payload.error
                : fallback;
    const code =
        typeof payload?.errorCode === 'string'
            ? payload.errorCode
            : typeof payload?.code === 'string'
              ? payload.code
              : undefined;
    return new ArticleApiError(response.status, message, code);
}

function normalizeSharedSubmission(value: unknown): ArticleSharedSubmission | null {
    if (!value || typeof value !== 'object') return null;
    const raw = value as Record<string, unknown>;
    const id = Number(raw.id);
    const submittedAt = typeof raw.submittedAt === 'string' ? raw.submittedAt : '';
    const status =
        raw.status === 'PROCESSING' || raw.status === 'EVALUATED' || raw.status === 'ERROR'
            ? raw.status
            : null;
    if (!Number.isSafeInteger(id) || id <= 0 || !submittedAt || !status) return null;

    const score =
        (typeof raw.score === 'number' || typeof raw.score === 'string') && String(raw.score).trim()
            ? Number(raw.score)
            : Number.NaN;
    const rawMetric = raw.metric;
    const metric =
        typeof rawMetric === 'string' && rawMetric.trim()
            ? rawMetric.trim()
            : Number.isFinite(rawMetric)
              ? Number(rawMetric)
              : null;

    return {
        id,
        submittedAt,
        status,
        score: Number.isFinite(score) ? score : null,
        metric,
        sourceFileName:
            typeof raw.sourceFileName === 'string' && raw.sourceFileName.trim()
                ? raw.sourceFileName.trim()
                : null,
        sourceDownloadUrl: normalizeApiResourceUrl(raw.sourceDownloadUrl),
        recommended: raw.recommended === true,
    };
}

function normalizeArticle(raw: ArticleTransport): ArticleSummary {
    const problem = normalizeProblemReference(raw.problem, raw.problemId, raw.problemTitle);
    const problemAuthorIds = new Set(
        problem?.authors.flatMap((author) => (author.userId ? [author.userId] : [])) ?? [],
    );
    const authors = normalizeAuthors(raw.authors).map((author) => ({
        ...author,
        isProblemAuthor: author.isProblemAuthor === true || problemAuthorIds.has(author.userId),
    }));

    return {
        id: Number(raw.id),
        slug: raw.slug ?? '',
        language:
            typeof raw.language === 'string' && SUPPORTED_LOCALES.includes(raw.language as Locale)
                ? (raw.language as Locale)
                : DEFAULT_LOCALE,
        title: raw.title ?? '',
        excerpt: raw.excerpt ?? '',
        kind: raw.kind ?? 'GENERAL',
        // Public DTOs intentionally omit status because these endpoints only ever
        // expose published revisions. Editor DTOs always carry their real status.
        publicationStatus: raw.publicationStatus ?? raw.status ?? 'PUBLISHED',
        publishedAt: raw.publishedAt ?? null,
        updatedAt: raw.updatedAt ?? raw.publishedAt ?? new Date(0).toISOString(),
        authors,
        problem,
    };
}

function normalizeProblemOption(value: unknown): ArticleProblemOption | null {
    if (!value || typeof value !== 'object') return null;
    const raw = value as Record<string, unknown>;
    const problem = normalizeProblemReference(raw);
    if (!problem) return null;

    return {
        ...problem,
        isCurrentUserAuthor: raw.isCurrentUserAuthor === true,
    };
}

function normalizeEditorialOpportunityProblem(value: unknown): EditorialOpportunityProblem | null {
    if (!value || typeof value !== 'object') return null;
    const raw = value as Record<string, unknown>;
    const problem = normalizeProblemReference(raw);
    if (!problem) return null;

    const publishedEditorials = Array.isArray(raw.publishedEditorials)
        ? raw.publishedEditorials.flatMap((candidate) => {
              if (!candidate || typeof candidate !== 'object') return [];
              const editorial = candidate as Record<string, unknown>;
              const id = Number(editorial.id);
              const slug = typeof editorial.slug === 'string' ? editorial.slug.trim() : '';
              const title = typeof editorial.title === 'string' ? editorial.title.trim() : '';
              if (!Number.isFinite(id) || id <= 0 || !slug || !title) return [];

              return [
                  {
                      id,
                      slug,
                      language:
                          typeof editorial.language === 'string' &&
                          SUPPORTED_LOCALES.includes(editorial.language as Locale)
                              ? (editorial.language as Locale)
                              : DEFAULT_LOCALE,
                      title,
                      publishedAt:
                          typeof editorial.publishedAt === 'string' ? editorial.publishedAt : null,
                      updatedAt:
                          typeof editorial.updatedAt === 'string' ? editorial.updatedAt : null,
                  },
              ];
          })
        : [];

    return { ...problem, publishedEditorials };
}

function normalizeEditorialOpportunityOverview(value: unknown): EditorialOpportunityOverview {
    const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    const withoutPublishedEditorial = Array.isArray(raw.withoutPublishedEditorial)
        ? raw.withoutPublishedEditorial.flatMap((problem) => {
              const normalized = normalizeEditorialOpportunityProblem(problem);
              return normalized ? [normalized] : [];
          })
        : [];
    const withPublishedEditorial = Array.isArray(raw.withPublishedEditorial)
        ? raw.withPublishedEditorial.flatMap((problem) => {
              const normalized = normalizeEditorialOpportunityProblem(problem);
              return normalized ? [normalized] : [];
          })
        : [];

    const safeCount = (candidate: unknown, fallback: number) => {
        const count = Number(candidate);
        return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : fallback;
    };
    const withoutPublishedEditorialCount = safeCount(
        raw.withoutPublishedEditorialCount,
        withoutPublishedEditorial.length,
    );
    const withPublishedEditorialCount = safeCount(
        raw.withPublishedEditorialCount,
        withPublishedEditorial.length,
    );

    return {
        totalProblems: safeCount(
            raw.totalProblems,
            withoutPublishedEditorialCount + withPublishedEditorialCount,
        ),
        withoutPublishedEditorialCount,
        withPublishedEditorialCount,
        withoutPublishedEditorial,
        withPublishedEditorial,
    };
}

function normalizeArticleDetail(raw: ArticleTransport): ArticleDetail {
    return {
        ...normalizeArticle(raw),
        sanitizedHtml: raw.sanitizedHtml ?? raw.renderedHtml ?? raw.html ?? '',
        sharedSubmission: normalizeSharedSubmission(raw.sharedSubmission),
    };
}

function normalizeArticleImage(value: unknown): ArticleImage | null {
    if (!value || typeof value !== 'object') return null;
    const raw = value as ArticleImageTransport;
    const idCandidate = raw.id ?? raw.imageId;
    const id = typeof idCandidate === 'string' ? idCandidate.trim() : String(idCandidate ?? '');
    const urlCandidate = raw.markdownUrl ?? raw.url;
    const markdownUrl = typeof urlCandidate === 'string' ? urlCandidate.trim() : '';
    if (!id || !markdownUrl) return null;

    const nullableDimension = (candidate: unknown): number | null => {
        const value = Number(candidate);
        return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
    };
    const size = Number(raw.sizeBytes ?? raw.byteSize ?? raw.size);

    return {
        id,
        markdownUrl,
        previewUrl: typeof raw.previewUrl === 'string' ? raw.previewUrl : markdownUrl,
        contentType:
            typeof (raw.contentType ?? raw.mimeType) === 'string'
                ? String(raw.contentType ?? raw.mimeType)
                : '',
        sizeBytes: Number.isFinite(size) && size >= 0 ? Math.trunc(size) : 0,
        width: nullableDimension(raw.width),
        height: nullableDimension(raw.height),
        altText: typeof raw.altText === 'string' ? raw.altText : null,
        referencedInCurrent: raw.referencedInCurrent === true,
        referencedInPublished: raw.referencedInPublished === true,
        // Older backend deployments omit the field; those images formed the
        // editable working set and must remain quota-counted during rollout.
        countsTowardsDraftLimit:
            typeof raw.countsTowardsDraftLimit === 'boolean' ? raw.countsTowardsDraftLimit : true,
    };
}

function normalizeArticleImageList(value: unknown): ArticleImageList {
    const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    const candidates = Array.isArray(value)
        ? value
        : Array.isArray(raw.images)
          ? raw.images
          : Array.isArray(raw.items)
            ? raw.items
            : [];
    const images = candidates.flatMap((candidate) => {
        const image = normalizeArticleImage(candidate);
        return image ? [image] : [];
    });
    const maxImages = Number(raw.maxImages ?? raw.limit);
    return {
        images,
        imageCount: images.filter((image) => image.countsTowardsDraftLimit).length,
        maxImages: Number.isFinite(maxImages) && maxImages > 0 ? Math.trunc(maxImages) : 5,
    };
}

function normalizeOwnedArticle(raw: ArticleTransport): OwnedArticle {
    const change = raw.latestChangeRequest ?? raw.pendingChange;
    const latestChangeRequest = change
        ? {
              id: Number(change.id ?? change.changeRequestId),
              version: Number.isFinite(change.version) ? Number(change.version) : 0,
              operation: change.operation ?? change.type ?? 'UPDATE',
              status: change.status ?? 'PENDING',
              submittedAt: change.submittedAt ?? change.createdAt ?? new Date(0).toISOString(),
              updatedAt: change.updatedAt ?? null,
              reviewerMessage:
                  change.reviewerMessage ?? change.reviewMessage ?? change.reviewerNote ?? null,
          }
        : null;
    const pending = latestChangeRequest?.status === 'PENDING';
    const changesRequested = latestChangeRequest?.status === 'CHANGES_REQUESTED';
    const activeReview = pending || changesRequested;
    const archived = (raw.publicationStatus ?? raw.status) === 'ARCHIVED';
    const structureLocked = Boolean(raw.publishedRevision);
    const hasUnpublishedChanges =
        !raw.publishedRevision ||
        raw.currentRevision?.revisionId !== raw.publishedRevision.revisionId;
    const currentRevisionHasSharedSubmission =
        raw.currentRevision !== undefined &&
        Object.prototype.hasOwnProperty.call(raw.currentRevision, 'sharedSubmission');
    const editableSharedSubmission = currentRevisionHasSharedSubmission
        ? raw.currentRevision?.sharedSubmission
        : raw.sharedSubmission;
    const editableSourceSharingConsent =
        typeof raw.currentRevision?.sourceSharingConsent === 'boolean'
            ? raw.currentRevision.sourceSharingConsent
            : raw.sourceSharingConsent === true;
    const normalizedEditableSharedSubmission = normalizeSharedSubmission(editableSharedSubmission);

    return {
        ...normalizeArticle({
            ...raw,
            title: raw.currentRevision?.title ?? raw.title,
            excerpt: raw.currentRevision?.excerpt ?? raw.excerpt,
            authors: raw.currentRevision?.authors ?? raw.authors,
        }),
        markdown: raw.currentRevision?.markdown ?? raw.markdown ?? '',
        images: Array.isArray(raw.images)
            ? raw.images.flatMap((candidate) => {
                  const image = normalizeArticleImage(candidate);
                  return image ? [image] : [];
              })
            : [],
        sharedSubmission: normalizedEditableSharedSubmission,
        sourceSharingConsent:
            normalizedEditableSharedSubmission !== null && editableSourceSharingConsent,
        version: Number.isFinite(raw.version) ? Number(raw.version) : 0,
        structureLocked,
        hasUnpublishedChanges,
        latestChangeRequest,
        permissions: raw.permissions ?? {
            canEdit: !archived && !pending,
            canSubmit: !archived && !pending && !changesRequested && hasUnpublishedChanges,
            canRequestDelete: !archived && !activeReview,
            canCancelRequest: !archived && activeReview,
            canResubmit: !archived && changesRequested,
        },
    };
}

function normalizePage(raw: SpringPage<ArticleTransport>, fallbackSize: number): ArticlePage {
    const rows = Array.isArray(raw.items) ? raw.items : raw.content;
    const content = Array.isArray(rows) ? rows.map(normalizeArticle) : [];
    const nestedPage = typeof raw.page === 'object' ? raw.page : undefined;
    const number =
        (typeof raw.page === 'number' ? raw.page : nestedPage?.number) ?? raw.number ?? 0;
    const size = nestedPage?.size ?? raw.size ?? fallbackSize;
    const totalElements = nestedPage?.totalElements ?? raw.totalElements ?? content.length;
    const totalPages =
        nestedPage?.totalPages ??
        raw.totalPages ??
        (totalElements === 0 ? 0 : Math.ceil(totalElements / Math.max(size, 1)));

    return {
        content,
        page: { number, size, totalElements, totalPages },
    };
}

export async function getPublishedArticles({
    page = 0,
    size = 12,
    kind,
    problemId,
    authorId,
    locale,
}: {
    page?: number;
    size?: number;
    kind?: ArticleSummary['kind'];
    problemId?: number;
    authorId?: string;
    locale?: Locale;
} = {}): Promise<ArticlePage> {
    const url = apiUrl('/articles');
    url.searchParams.set('page', String(Math.max(0, page)));
    url.searchParams.set('size', String(Math.max(1, size)));
    if (kind) url.searchParams.set('kind', kind);
    if (problemId != null) url.searchParams.set('problemId', String(problemId));
    if (authorId) url.searchParams.set('authorId', authorId);

    // Publication and withdrawal are moderation decisions. Until the backend
    // can trigger on-demand Next.js invalidation, do not retain a public
    // pre-moderation snapshot after an archive or unpublish action.
    const response = await fetchPublicApi(url, {
        cache: 'no-store',
        headers: locale ? { 'accept-language': locale } : undefined,
    });
    if (!response.ok) throw await parseError(response, 'Unable to load published articles');

    return normalizePage((await response.json()) as SpringPage<ArticleTransport>, size);
}

export async function searchArticleProblemOptions(
    search = '',
    size = 20,
): Promise<ArticleProblemOption[]> {
    const url = apiUrl('/me/articles/problem-options');
    const normalizedSearch = search.trim();
    if (normalizedSearch) url.searchParams.set('search', normalizedSearch.slice(0, 180));
    url.searchParams.set('size', String(Math.min(30, Math.max(1, Math.trunc(size)))));

    const response = await fetchApi(url);
    if (!response.ok) throw await parseError(response, 'Problems could not be loaded');

    const payload = (await response.json().catch(() => null)) as { items?: unknown } | null;
    if (!Array.isArray(payload?.items)) return [];

    return payload.items.flatMap((item) => {
        const option = normalizeProblemOption(item);
        return option ? [option] : [];
    });
}

export async function getArticleSubmissionOptions(
    problemId: number,
): Promise<ArticleSubmissionOption[]> {
    if (!Number.isSafeInteger(problemId) || problemId <= 0) return [];
    const url = apiUrl('/me/articles/submission-options');
    url.searchParams.set('problemId', String(problemId));

    const response = await fetchApi(url);
    if (!response.ok) throw await parseError(response, 'Submissions could not be loaded');

    const payload = (await response.json().catch(() => null)) as { items?: unknown } | null;
    if (!Array.isArray(payload?.items)) return [];

    return payload.items.flatMap((item) => {
        const option = normalizeSharedSubmission(item);
        return option ? [option] : [];
    });
}

export async function getArticleProblemOption(
    problemId: number,
    locale?: Locale,
): Promise<ArticleProblemOption | null> {
    if (!Number.isSafeInteger(problemId) || problemId <= 0) return null;
    const url = apiUrl('/me/articles/problem-options');
    url.searchParams.set('problemId', String(problemId));
    url.searchParams.set('size', '1');

    const response = await fetchApi(url, {
        headers: locale ? { 'accept-language': locale } : undefined,
    });
    if (response.status === 404) return null;
    if (!response.ok) throw await parseError(response, 'Problem could not be loaded');

    const payload = (await response.json().catch(() => null)) as { items?: unknown } | null;
    if (!Array.isArray(payload?.items)) return null;
    return normalizeProblemOption(payload.items[0]);
}

export async function getMyEditorialOpportunities(
    locale?: Locale,
): Promise<EditorialOpportunityOverview> {
    const response = await fetchApi(apiUrl('/me/articles/editorial-opportunities'), {
        headers: locale ? { 'accept-language': locale } : undefined,
    });
    if (!response.ok) {
        throw await parseError(response, 'Editorial opportunities could not be loaded');
    }
    return normalizeEditorialOpportunityOverview(await response.json().catch(() => null));
}

export const getPublishedArticle = cache(
    async (slug: string, locale?: Locale): Promise<ArticleDetail> => {
        const response = await fetchPublicApi(apiUrl(`/articles/${encodeURIComponent(slug)}`), {
            cache: 'no-store',
            headers: locale ? { 'accept-language': locale } : undefined,
        });
        if (!response.ok) throw await parseError(response, 'Unable to load the article');
        return normalizeArticleDetail((await response.json()) as ArticleTransport);
    },
);

export async function getProblemArticles(
    problemId: number,
    { page = 0, size = 12, locale }: { page?: number; size?: number; locale?: Locale } = {},
): Promise<ArticlePage> {
    const url = apiUrl(`/problems/${encodeURIComponent(problemId)}/articles`);
    url.searchParams.set('page', String(Math.max(0, page)));
    url.searchParams.set('size', String(Math.max(1, size)));
    const response = await fetchPublicApi(url, {
        cache: 'no-store',
        headers: locale ? { 'accept-language': locale } : undefined,
    });
    if (!response.ok) throw await parseError(response, 'Unable to load problem editorials');
    const payload = (await response.json()) as ArticleTransport[] | SpringPage<ArticleTransport>;
    if (Array.isArray(payload)) {
        return {
            content: payload.map(normalizeArticle),
            page: {
                number: 0,
                size: payload.length,
                totalElements: payload.length,
                totalPages: payload.length > 0 ? 1 : 0,
            },
        };
    }
    return normalizePage(payload, size);
}

export async function getProfileArticles(
    profileId: string,
    { page = 0, size = 12, locale }: { page?: number; size?: number; locale?: Locale } = {},
): Promise<ArticlePage> {
    const url = apiUrl(`/profile/${encodeURIComponent(profileId)}/articles`);
    url.searchParams.set('page', String(Math.max(0, page)));
    url.searchParams.set('size', String(Math.max(1, size)));
    const response = await fetchPublicApi(url, {
        cache: 'no-store',
        headers: locale ? { 'accept-language': locale } : undefined,
    });
    if (!response.ok) throw await parseError(response, 'Unable to load authored articles');
    const payload = (await response.json()) as ArticleTransport[] | SpringPage<ArticleTransport>;
    if (Array.isArray(payload)) {
        return {
            content: payload.map(normalizeArticle),
            page: {
                number: 0,
                size: payload.length,
                totalElements: payload.length,
                totalPages: payload.length > 0 ? 1 : 0,
            },
        };
    }
    return normalizePage(payload, size);
}

export async function getMyArticles({
    page = 0,
    size = 20,
}: {
    page?: number;
    size?: number;
} = {}): Promise<OwnedArticlePage> {
    const url = apiUrl('/me/articles');
    url.searchParams.set('page', String(Math.max(0, page)));
    url.searchParams.set('size', String(Math.max(1, size)));
    const response = await fetchApi(url);
    if (!response.ok) throw await parseError(response, 'Unable to load your writing');
    const payload = (await response.json()) as ArticleTransport[] | SpringPage<ArticleTransport>;
    const rows = Array.isArray(payload) ? payload : (payload.items ?? payload.content ?? []);
    const content = rows.map(normalizeOwnedArticle);
    if (Array.isArray(payload)) {
        return {
            content,
            page: {
                number: 0,
                size: content.length,
                totalElements: content.length,
                totalPages: content.length > 0 ? 1 : 0,
            },
        };
    }
    const nestedPage = typeof payload.page === 'object' ? payload.page : undefined;
    return {
        content,
        page: {
            number:
                (typeof payload.page === 'number' ? payload.page : nestedPage?.number) ??
                payload.number ??
                page,
            size: nestedPage?.size ?? payload.size ?? size,
            totalElements: nestedPage?.totalElements ?? payload.totalElements ?? content.length,
            totalPages:
                nestedPage?.totalPages ?? payload.totalPages ?? (content.length > 0 ? 1 : 0),
        },
    };
}

export async function getMyArticle(articleId: ArticleSummary['id']): Promise<OwnedArticle> {
    const response = await fetchApi(apiUrl(`/me/articles/${encodeURIComponent(articleId)}`));
    if (!response.ok) throw await parseError(response, 'Unable to load this draft');
    return normalizeOwnedArticle((await response.json()) as ArticleTransport);
}

export async function getArticleImages(articleId: ArticleSummary['id']): Promise<ArticleImageList> {
    const response = await fetchApi(apiUrl(`/me/articles/${encodeURIComponent(articleId)}/images`));
    if (!response.ok) throw await parseError(response, 'Unable to load article images');
    return normalizeArticleImageList(await response.json().catch(() => null));
}

export async function uploadArticleImage(
    articleId: ArticleSummary['id'],
    file: File,
): Promise<ArticleImage> {
    const body = new FormData();
    body.append('file', file, file.name);
    const response = await fetchApi(
        apiUrl(`/me/articles/${encodeURIComponent(articleId)}/images`),
        { method: 'POST', body },
    );
    if (!response.ok) throw await parseError(response, 'Unable to upload this image');
    const payload = await response.json().catch(() => null);
    const nested =
        payload && typeof payload === 'object' && 'image' in payload
            ? (payload as { image?: unknown }).image
            : payload;
    const image = normalizeArticleImage(nested);
    if (!image) throw new ArticleApiError(502, 'The image service returned an invalid response');
    return image;
}

export async function deleteArticleImage(
    articleId: ArticleSummary['id'],
    imageId: ArticleImage['id'],
): Promise<void> {
    const response = await fetchApi(
        apiUrl(
            `/me/articles/${encodeURIComponent(articleId)}/images/${encodeURIComponent(imageId)}`,
        ),
        { method: 'DELETE' },
    );
    if (!response.ok) throw await parseError(response, 'Unable to delete this image');
}

export async function getAdminArticlePreview(
    articleId: ArticleSummary['id'],
    revision: AdminArticlePreviewRevision,
): Promise<ArticleDetail> {
    const url = apiUrl(`/admin/articles/${encodeURIComponent(articleId)}/public-preview`);
    url.searchParams.set('revision', revision);
    const response = await fetchApi(url);
    if (!response.ok) throw await parseError(response, 'Unable to load the article preview');
    return normalizeArticleDetail((await response.json()) as ArticleTransport);
}

export async function getAdminArticleReviewPreview(
    requestId: number,
    revision: AdminArticleReviewPreviewRevision,
): Promise<ArticleDetail> {
    const url = apiUrl(
        `/admin/article-change-requests/${encodeURIComponent(requestId)}/public-preview`,
    );
    url.searchParams.set('revision', revision);
    const response = await fetchApi(url);
    if (!response.ok) throw await parseError(response, 'Unable to load the review preview');
    return normalizeArticleDetail((await response.json()) as ArticleTransport);
}

export async function createArticleDraft(input: ArticleDraftInput): Promise<OwnedArticle> {
    const response = await fetchApi(apiUrl('/me/articles'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!response.ok) throw await parseError(response, 'Unable to create the draft');
    return normalizeOwnedArticle((await response.json()) as ArticleTransport);
}

export async function saveArticleDraft(
    articleId: ArticleSummary['id'],
    input: ArticleDraftInput,
): Promise<OwnedArticle> {
    const response = await fetchApi(apiUrl(`/me/articles/${encodeURIComponent(articleId)}/draft`), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!response.ok) throw await parseError(response, 'Unable to save the draft');
    return normalizeOwnedArticle((await response.json()) as ArticleTransport);
}

async function runArticleAction(
    article: OwnedArticle,
    action: 'submit' | 'request-delete' | 'cancel' | 'resubmit',
    rationale?: string,
): Promise<OwnedArticle> {
    const requestId = article.latestChangeRequest?.id;
    const path =
        action === 'cancel' || action === 'resubmit'
            ? `/me/articles/change-requests/${encodeURIComponent(requestId ?? '')}/${action}`
            : `/me/articles/${encodeURIComponent(article.id)}/${action}`;
    if ((action === 'cancel' || action === 'resubmit') && !requestId) {
        throw new ArticleApiError(409, 'This article has no active change request');
    }
    const response = await fetchApi(apiUrl(path), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            version:
                action === 'cancel' || action === 'resubmit'
                    ? article.latestChangeRequest?.version
                    : article.version,
            ...(rationale ? { rationale } : {}),
        }),
    });
    if (!response.ok) throw await parseError(response, 'Unable to update the review request');
    // Action endpoints may return either the updated editor detail or a review
    // record. Re-reading the ownership-scoped detail gives the editor one stable
    // response shape and the newest optimistic-lock version in both cases.
    await response.json().catch(() => null);
    return getMyArticle(article.id);
}

export const submitArticleForReview = (article: OwnedArticle, rationale?: string) =>
    runArticleAction(article, 'submit', rationale);

export const requestArticleDeletion = (article: OwnedArticle, rationale?: string) =>
    runArticleAction(article, 'request-delete', rationale);

export const cancelArticleRequest = (article: OwnedArticle) => runArticleAction(article, 'cancel');

export const resubmitArticleRequest = (article: OwnedArticle) =>
    runArticleAction(article, 'resubmit');

export async function previewArticleMarkdown(
    markdown: string,
    articleId?: ArticleSummary['id'],
): Promise<MarkdownPreview> {
    const response = await fetchApi(apiUrl('/me/articles/preview'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ markdown, ...(articleId ? { articleId } : {}) }),
    });
    if (!response.ok) throw await parseError(response, 'Unable to render the preview');
    const payload = (await response.json()) as Partial<MarkdownPreview> & {
        html?: string;
        renderedHtml?: string;
    };
    return { sanitizedHtml: payload.sanitizedHtml ?? payload.renderedHtml ?? payload.html ?? '' };
}

export const getArticleInvitation = cache(
    async (token: string): Promise<ArticleInvitationPreview> => {
        const response = await fetchPublicApi(apiUrl('/article-invitations/preview'), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token }),
            cache: 'no-store',
        });
        if (!response.ok) throw await parseError(response, 'Unable to load this invitation');
        const payload = (await response.json()) as InvitationTransport;
        const status = payload.status ?? 'INVALID';
        return {
            valid:
                payload.valid ??
                ['ACTIVE', 'PENDING', 'SENT'].includes(status.toLocaleUpperCase('en-US')),
            status,
            maskedEmail: payload.maskedEmail ?? null,
            problem: normalizeProblemReference(payload.problem),
            article: payload.article ?? null,
            expiresAt: payload.expiresAt ?? null,
            message: payload.message ?? null,
        };
    },
);

export async function redeemStoredArticleInvitation(handle: string): Promise<OwnedArticle> {
    const response = await fetch(`/api/article-invitations/${encodeURIComponent(handle)}/redeem`, {
        method: 'POST',
        credentials: 'same-origin',
    });
    if (!response.ok) throw await parseError(response, 'Unable to accept this invitation');
    return normalizeOwnedArticle((await response.json()) as ArticleTransport);
}
