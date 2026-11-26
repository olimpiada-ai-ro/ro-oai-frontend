/**
 * Article API contract boundary.
 *
 * Keep transport-facing article types in this folder until the backend OpenAPI
 * contract is final. UI components should import from `@/lib/articles` only.
 */

import type { IdentityPresentation } from '@/lib/identity-presentation';
import type { Locale, ProblemAuthor } from '@/lib/types';

export type ArticleKind = 'GENERAL' | 'PROBLEM_EDITORIAL';

export type ArticleLanguage = Locale;

export type ArticlePublicationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type ArticleChangeRequestStatus =
    | 'PENDING'
    | 'CHANGES_REQUESTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'CANCELLED';

export type ArticleChangeOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export type ArticleId = number;

export type ArticleAuthor = {
    userId: string;
    username?: string | null;
    displayName?: string | null;
    avatar?: string | null;
    role?: string | null;
    displayOrder?: number;
    isProblemAuthor?: boolean;
    identityPresentation?: IdentityPresentation | null;
};

export type ArticleProblemReference = {
    id: number;
    title: string;
    authors: ProblemAuthor[];
};

export type ArticleProblemOption = ArticleProblemReference & {
    isCurrentUserAuthor: boolean;
};

export type ArticleSubmissionStatus = 'PROCESSING' | 'EVALUATED' | 'ERROR';

/**
 * The intentionally small submission shape exposed through article endpoints.
 * Evaluation logs and private submission artifacts must never cross this boundary.
 */
export type ArticleSharedSubmission = {
    id: number;
    submittedAt: string;
    status: ArticleSubmissionStatus;
    score: number | null;
    metric: number | string | null;
    sourceFileName: string | null;
    sourceDownloadUrl: string | null;
    recommended: boolean;
};

export type ArticleSubmissionOption = ArticleSharedSubmission;

export type PublishedEditorialReference = {
    id: ArticleId;
    slug: string;
    language: ArticleLanguage;
    title: string;
    publishedAt: string | null;
    updatedAt: string | null;
};

export type EditorialOpportunityProblem = ArticleProblemReference & {
    publishedEditorials: PublishedEditorialReference[];
};

export type EditorialOpportunityOverview = {
    totalProblems: number;
    withoutPublishedEditorialCount: number;
    withPublishedEditorialCount: number;
    withoutPublishedEditorial: EditorialOpportunityProblem[];
    withPublishedEditorial: EditorialOpportunityProblem[];
};

export type ArticleSummary = {
    id: ArticleId;
    slug: string;
    language: ArticleLanguage;
    title: string;
    excerpt: string;
    kind: ArticleKind;
    publicationStatus: ArticlePublicationStatus;
    publishedAt: string | null;
    updatedAt: string;
    authors: ArticleAuthor[];
    problem: ArticleProblemReference | null;
};

export type ArticleDetail = ArticleSummary & {
    /** HTML rendered and sanitized by the backend. */
    sanitizedHtml: string;
    /** Present only when the published revision explicitly shares a submission. */
    sharedSubmission: ArticleSharedSubmission | null;
};

export type ArticlePage = {
    content: ArticleSummary[];
    page: {
        number: number;
        size: number;
        totalElements: number;
        totalPages: number;
    };
};

export type ArticleChangeRequest = {
    id: number;
    version: number;
    operation: ArticleChangeOperation;
    status: ArticleChangeRequestStatus;
    submittedAt: string;
    updatedAt?: string | null;
    reviewerMessage?: string | null;
};

export type OwnedArticlePermissions = {
    canEdit: boolean;
    canSubmit: boolean;
    canRequestDelete: boolean;
    canCancelRequest: boolean;
    canResubmit: boolean;
};

export type OwnedArticle = ArticleSummary & {
    markdown: string;
    images: ArticleImage[];
    /** The submission selected on the editable revision, not necessarily the published revision. */
    sharedSubmission: ArticleSharedSubmission | null;
    sourceSharingConsent: boolean;
    version: number;
    structureLocked: boolean;
    hasUnpublishedChanges: boolean;
    latestChangeRequest: ArticleChangeRequest | null;
    permissions: OwnedArticlePermissions;
};

export type OwnedArticlePage = {
    content: OwnedArticle[];
    page: {
        number: number;
        size: number;
        totalElements: number;
        totalPages: number;
    };
};

export type ArticleDraftInput = {
    slug?: string;
    language: ArticleLanguage;
    title: string;
    excerpt: string;
    kind: ArticleKind;
    problemId: number | null;
    sharedSubmissionId: number | null;
    sourceSharingConsent: boolean;
    markdown: string;
    version?: number;
};

export type ArticleInvitationPreview = {
    valid: boolean;
    status: string;
    maskedEmail: string | null;
    problem: ArticleProblemReference | null;
    article: { id: ArticleId; title: string } | null;
    expiresAt: string | null;
    message: string | null;
};

export type MarkdownPreview = {
    sanitizedHtml: string;
};

export const MAX_ARTICLE_IMAGES = 5;
export const MAX_ARTICLE_IMAGE_BYTES = 1024 * 1024;

/** Metadata for an image owned by an article draft. */
export type ArticleImage = {
    id: string;
    /** Stable same-origin Markdown URL, e.g. `/article-media/{uuid}`. */
    markdownUrl: string;
    previewUrl: string;
    contentType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    altText: string | null;
    referencedInCurrent: boolean;
    referencedInPublished: boolean;
    countsTowardsDraftLimit: boolean;
};

export type ArticleImageList = {
    images: ArticleImage[];
    imageCount: number;
    maxImages: number;
};

export type AdminArticlePreviewRevision = 'current' | 'published';
export type AdminArticleReviewPreviewRevision = 'current' | 'proposed';
