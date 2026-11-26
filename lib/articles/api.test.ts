import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchApiMock, fetchPublicApiMock } = vi.hoisted(() => ({
    fetchApiMock: vi.fn(),
    fetchPublicApiMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }));
vi.mock('@/lib/public-api', () => ({ fetchPublicApi: fetchPublicApiMock }));

import {
    cancelArticleRequest,
    deleteArticleImage,
    getAdminArticlePreview,
    getAdminArticleReviewPreview,
    getArticleImages,
    getArticleProblemOption,
    getArticleSubmissionOptions,
    getArticleInvitation,
    getMyArticle,
    getMyArticles,
    getMyEditorialOpportunities,
    getProblemArticles,
    getProfileArticles,
    getPublishedArticle,
    getPublishedArticles,
    previewArticleMarkdown,
    redeemStoredArticleInvitation,
    searchArticleProblemOptions,
    submitArticleForReview,
    uploadArticleImage,
    type OwnedArticle,
} from '@/lib/articles';

function jsonResponse(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

function ownedArticle(): OwnedArticle {
    return {
        id: 42,
        slug: 'trees-and-boosting',
        language: 'ro',
        kind: 'GENERAL',
        publicationStatus: 'PUBLISHED',
        problem: null,
        title: 'Trees and boosting',
        excerpt: 'A practical guide',
        markdown: '# Start',
        images: [],
        sharedSubmission: null,
        sourceSharingConsent: false,
        authors: [],
        publishedAt: '2026-07-10T08:00:00Z',
        updatedAt: '2026-07-11T08:00:00Z',
        version: 12,
        structureLocked: true,
        hasUnpublishedChanges: true,
        latestChangeRequest: {
            id: 99,
            version: 4,
            operation: 'UPDATE',
            status: 'PENDING',
            submittedAt: '2026-07-11T08:00:00Z',
            reviewerMessage: null,
        },
        permissions: {
            canEdit: false,
            canSubmit: false,
            canRequestDelete: false,
            canCancelRequest: true,
            canResubmit: false,
        },
    };
}

const editorDetail = {
    id: 42,
    slug: 'trees-and-boosting',
    kind: 'GENERAL',
    status: 'PUBLISHED',
    problem: null,
    currentRevision: {
        revisionId: 8,
        revisionNumber: 3,
        title: 'Trees and boosting',
        excerpt: 'A practical guide',
        markdown: '# Start',
        authors: [],
        createdBy: 'user-1',
        createdAt: '2026-07-11T08:00:00Z',
    },
    publishedRevision: null,
    contributors: [],
    pendingChange: null,
    publishedAt: '2026-07-10T08:00:00Z',
    updatedAt: '2026-07-11T08:00:00Z',
    version: 13,
};

describe('article API adapter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test';
    });

    it('normalizes the flat public page and infers published status', async () => {
        fetchPublicApiMock.mockResolvedValue(
            jsonResponse({
                items: [
                    {
                        id: 3,
                        slug: 'calibration',
                        language: 'en',
                        kind: 'GENERAL',
                        problem: null,
                        title: 'Model calibration',
                        excerpt: 'Know what a probability means.',
                        authors: [],
                        publishedAt: '2026-07-10T08:00:00Z',
                        updatedAt: '2026-07-11T08:00:00Z',
                    },
                ],
                page: 1,
                size: 12,
                totalElements: 13,
                totalPages: 2,
            }),
        );

        const result = await getPublishedArticles({
            page: 1,
            size: 12,
            kind: 'GENERAL',
            authorId: 'user-1',
            locale: 'fr',
        });

        expect(result.page).toEqual({ number: 1, size: 12, totalElements: 13, totalPages: 2 });
        expect(result.content[0]?.publicationStatus).toBe('PUBLISHED');
        expect(result.content[0]?.language).toBe('en');
        const requestedUrl = String(fetchPublicApiMock.mock.calls[0]?.[0]);
        expect(requestedUrl).toContain('page=1');
        expect(requestedUrl).toContain('kind=GENERAL');
        expect(requestedUrl).toContain('authorId=user-1');
        expect(
            new Headers(fetchPublicApiMock.mock.calls[0]?.[1]?.headers).get('accept-language'),
        ).toBe('fr');
    });

    it('normalizes a null backend username without exposing an unsafe value', async () => {
        fetchPublicApiMock.mockResolvedValue(
            jsonResponse({
                items: [
                    {
                        id: 3,
                        slug: 'safe-author',
                        title: 'Safe author',
                        authors: [{ userId: 'user-1', username: null, avatar: null }],
                    },
                ],
                page: 0,
                size: 12,
                totalElements: 1,
                totalPages: 1,
            }),
        );

        const result = await getPublishedArticles({});

        expect(result.content[0]?.authors[0]).toMatchObject({
            userId: 'user-1',
            username: null,
        });
        expect(result.content[0]?.language).toBe('ro');
    });

    it('loads lightweight problem options with current-author priority metadata', async () => {
        fetchApiMock.mockResolvedValue(
            jsonResponse({
                items: [
                    {
                        id: 289,
                        title: 'Grid Search',
                        isCurrentUserAuthor: true,
                        authors: [
                            {
                                userId: 'user-1',
                                firstName: 'Pixel',
                                lastName: 'Testerson',
                                displayName: 'old_username',
                                displayOrder: 0,
                            },
                            {
                                userId: null,
                                firstName: 'Ana',
                                lastName: 'Popescu',
                                displayName: 'Ana Popescu',
                                displayOrder: 1,
                            },
                        ],
                    },
                ],
            }),
        );

        const options = await searchArticleProblemOptions('  grid  ', 200);

        expect(options).toEqual([
            {
                id: 289,
                title: 'Grid Search',
                isCurrentUserAuthor: true,
                authors: [
                    expect.objectContaining({
                        userId: 'user-1',
                        displayName: 'Pixel Testerson',
                    }),
                    expect.objectContaining({ userId: null, displayName: 'Ana Popescu' }),
                ],
            },
        ]);
        const requestedUrl = String(fetchApiMock.mock.calls[0]?.[0]);
        expect(requestedUrl).toContain('/me/articles/problem-options');
        expect(requestedUrl).toContain('search=grid');
        expect(requestedUrl).toContain('size=30');
    });

    it('loads article-safe submission options without turning a null score into zero', async () => {
        fetchApiMock.mockResolvedValue(
            jsonResponse({
                items: [
                    {
                        id: 81,
                        submittedAt: '2026-07-17T10:30:00Z',
                        status: 'EVALUATED',
                        score: null,
                        metric: '0.9123',
                        sourceFileName: 'solution.ipynb',
                        sourceDownloadUrl: null,
                        recommended: true,
                    },
                    {
                        id: 'invalid',
                        submittedAt: '2026-07-17T10:30:00Z',
                        status: 'EVALUATED',
                    },
                ],
            }),
        );

        const options = await getArticleSubmissionOptions(289);

        expect(options).toEqual([
            {
                id: 81,
                submittedAt: '2026-07-17T10:30:00Z',
                status: 'EVALUATED',
                score: null,
                metric: '0.9123',
                sourceFileName: 'solution.ipynb',
                sourceDownloadUrl: null,
                recommended: true,
            },
        ]);
        expect(String(fetchApiMock.mock.calls[0]?.[0])).toBe(
            'https://api.example.test/me/articles/submission-options?problemId=289',
        );
    });

    it('normalizes public relative source paths while preserving absolute presigned URLs', async () => {
        fetchPublicApiMock
            .mockResolvedValueOnce(
                jsonResponse({
                    id: 91,
                    slug: 'shared-solution',
                    title: 'Shared solution',
                    sanitizedHtml: '<p>Explanation</p>',
                    sharedSubmission: {
                        id: 81,
                        submittedAt: '2026-07-17T10:30:00Z',
                        status: 'EVALUATED',
                        score: 91.2,
                        metric: null,
                        sourceFileName: 'solution.ipynb',
                        sourceDownloadUrl: '/articles/shared-solution/source',
                        recommended: false,
                    },
                }),
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    id: 92,
                    slug: 'preview-solution',
                    title: 'Preview solution',
                    sanitizedHtml: '<p>Preview</p>',
                    sharedSubmission: {
                        id: 82,
                        submittedAt: '2026-07-17T10:30:00Z',
                        status: 'EVALUATED',
                        score: 92,
                        metric: null,
                        sourceFileName: 'solution.py',
                        sourceDownloadUrl:
                            'https://objects.example.test/private/source.py?signature=kept',
                        recommended: true,
                    },
                }),
            );

        const published = await getPublishedArticle('shared-solution', 'it');
        const preview = await getPublishedArticle('preview-solution');

        expect(published.sharedSubmission?.sourceDownloadUrl).toBe(
            'https://api.example.test/articles/shared-solution/source',
        );
        expect(preview.sharedSubmission?.sourceDownloadUrl).toBe(
            'https://objects.example.test/private/source.py?signature=kept',
        );
        expect(
            new Headers(fetchPublicApiMock.mock.calls[0]?.[1]?.headers).get('accept-language'),
        ).toBe('it');
    });

    it('reads the editable revision submission and explicit consent', async () => {
        fetchApiMock.mockResolvedValue(
            jsonResponse({
                ...editorDetail,
                currentRevision: {
                    ...editorDetail.currentRevision,
                    sharedSubmission: {
                        id: 81,
                        submittedAt: '2026-07-17T10:30:00Z',
                        status: 'EVALUATED',
                        score: 91.2,
                        metric: null,
                        sourceFileName: 'solution.py',
                        sourceDownloadUrl:
                            'https://objects.example.test/private/source.py?signature=kept',
                        recommended: true,
                    },
                    sourceSharingConsent: true,
                },
            }),
        );

        const result = await getMyArticle(42);

        expect(result.sourceSharingConsent).toBe(true);
        expect(result.sharedSubmission).toMatchObject({
            id: 81,
            sourceFileName: 'solution.py',
        });
    });

    it('does not inherit a published attachment when the editable revision removes consent', async () => {
        const publishedSubmission = {
            id: 81,
            submittedAt: '2026-07-17T10:30:00Z',
            status: 'EVALUATED',
            score: 91.2,
            metric: null,
            sourceFileName: 'solution.py',
            sourceDownloadUrl: '/articles/shared/source',
            recommended: true,
        };
        fetchApiMock.mockResolvedValue(
            jsonResponse({
                ...editorDetail,
                sharedSubmission: publishedSubmission,
                sourceSharingConsent: true,
                currentRevision: {
                    ...editorDetail.currentRevision,
                    sharedSubmission: null,
                    sourceSharingConsent: false,
                },
            }),
        );

        const result = await getMyArticle(42);

        expect(result.sharedSubmission).toBeNull();
        expect(result.sourceSharingConsent).toBe(false);
    });

    it('derives problem-author article badges from the linked problem snapshots', async () => {
        fetchPublicApiMock.mockResolvedValue(
            jsonResponse({
                items: [
                    {
                        id: 3,
                        slug: 'grid-search-explained',
                        title: 'Grid Search explained',
                        authors: [
                            { userId: 'user-1', displayName: 'Pixel Testerson' },
                            { userId: 'user-2', displayName: 'Ana Popescu' },
                        ],
                        problem: {
                            id: 289,
                            title: 'Grid Search',
                            authors: [
                                {
                                    userId: 'user-1',
                                    firstName: 'Pixel',
                                    lastName: 'Testerson',
                                    displayName: 'Pixel Testerson',
                                },
                            ],
                        },
                    },
                ],
            }),
        );

        const result = await getPublishedArticles();

        expect(result.content[0]?.authors).toEqual([
            expect.objectContaining({ userId: 'user-1', isProblemAuthor: true }),
            expect.objectContaining({ userId: 'user-2', isProblemAuthor: false }),
        ]);
    });

    it('loads one exact public problem for a preselected editorial', async () => {
        fetchApiMock.mockResolvedValue(
            jsonResponse({
                items: [
                    {
                        id: 289,
                        title: 'Grid Search',
                        isCurrentUserAuthor: true,
                        authors: [
                            {
                                userId: 'user-1',
                                firstName: 'Pixel',
                                lastName: 'Testerson',
                                displayName: 'Pixel Testerson',
                            },
                        ],
                    },
                ],
            }),
        );

        await expect(getArticleProblemOption(289, 'ro')).resolves.toMatchObject({
            id: 289,
            title: 'Grid Search',
            isCurrentUserAuthor: true,
        });
        expect(String(fetchApiMock.mock.calls[0]?.[0])).toContain('problemId=289');
        expect(fetchApiMock.mock.calls[0]?.[1]).toMatchObject({
            headers: { 'accept-language': 'ro' },
        });
    });

    it('normalizes editorial opportunity groups and their published editorial links', async () => {
        fetchApiMock.mockResolvedValue(
            jsonResponse({
                totalProblems: 2,
                withoutPublishedEditorialCount: 1,
                withPublishedEditorialCount: 1,
                withoutPublishedEditorial: [
                    {
                        id: 101,
                        title: 'A problem to explain',
                        authors: [],
                        publishedEditorials: [],
                    },
                ],
                withPublishedEditorial: [
                    {
                        id: 289,
                        title: 'Grid Search',
                        authors: [],
                        publishedEditorials: [
                            {
                                id: 77,
                                slug: 'grid-search-explained',
                                language: 'ro',
                                title: 'Grid Search explicat',
                                publishedAt: '2026-07-15T08:00:00Z',
                                updatedAt: '2026-07-15T09:00:00Z',
                            },
                        ],
                    },
                ],
            }),
        );

        const overview = await getMyEditorialOpportunities('ro');

        expect(overview).toMatchObject({
            totalProblems: 2,
            withoutPublishedEditorialCount: 1,
            withPublishedEditorialCount: 1,
        });
        expect(overview.withoutPublishedEditorial[0]).toMatchObject({
            id: 101,
            publishedEditorials: [],
        });
        expect(overview.withPublishedEditorial[0]?.publishedEditorials[0]).toMatchObject({
            id: 77,
            language: 'ro',
            slug: 'grid-search-explained',
        });
        expect(String(fetchApiMock.mock.calls[0]?.[0])).toContain(
            '/me/articles/editorial-opportunities',
        );
        expect(fetchApiMock.mock.calls[0]?.[1]).toMatchObject({
            headers: { 'accept-language': 'ro' },
        });
    });

    it('preserves contributor pagination and change-request review data', async () => {
        fetchApiMock.mockResolvedValue(
            jsonResponse({
                items: [
                    {
                        ...editorDetail,
                        status: 'DRAFT',
                        pendingChange: {
                            id: 18,
                            type: 'UPDATE',
                            status: 'CHANGES_REQUESTED',
                            reviewerNote: 'Add a reproducible example.',
                            createdAt: '2026-07-12T08:00:00Z',
                            updatedAt: '2026-07-13T08:00:00Z',
                            version: 6,
                        },
                    },
                ],
                page: 2,
                size: 20,
                totalElements: 43,
                totalPages: 3,
            }),
        );

        const result = await getMyArticles({ page: 2, size: 20 });

        expect(result.page).toEqual({ number: 2, size: 20, totalElements: 43, totalPages: 3 });
        expect(result.content[0]?.latestChangeRequest).toMatchObject({
            id: 18,
            version: 6,
            status: 'CHANGES_REQUESTED',
            reviewerMessage: 'Add a reproducible example.',
        });
        expect(result.content[0]?.permissions).toMatchObject({
            canEdit: true,
            canResubmit: true,
            canCancelRequest: true,
            canRequestDelete: false,
        });
    });

    it('normalizes the backend latest terminal review into the writer contract', async () => {
        fetchApiMock.mockResolvedValue(
            jsonResponse({
                items: [
                    {
                        ...editorDetail,
                        status: 'DRAFT',
                        latestChangeRequest: {
                            id: 21,
                            type: 'CREATE',
                            status: 'REJECTED',
                            reviewerNote: 'Explain how the result was reproduced.',
                            createdAt: '2026-07-12T08:00:00Z',
                            updatedAt: '2026-07-13T08:00:00Z',
                            version: 7,
                        },
                    },
                ],
                page: 0,
                size: 20,
                totalElements: 1,
                totalPages: 1,
            }),
        );

        const result = await getMyArticles();

        expect(result.content[0]?.latestChangeRequest).toEqual({
            id: 21,
            version: 7,
            operation: 'CREATE',
            status: 'REJECTED',
            submittedAt: '2026-07-12T08:00:00Z',
            updatedAt: '2026-07-13T08:00:00Z',
            reviewerMessage: 'Explain how the result was reproduced.',
        });
    });

    it.each([
        {
            label: 'an unpublished article whose current revision is the published revision',
            currentRevision: { revisionId: 8 },
            publishedRevision: { revisionId: 8 },
            expected: false,
        },
        {
            label: 'a never-published draft',
            currentRevision: { revisionId: 8 },
            publishedRevision: null,
            expected: true,
        },
        {
            label: 'a draft with edits after its published revision',
            currentRevision: { revisionId: 9 },
            publishedRevision: { revisionId: 8 },
            expected: true,
        },
    ])(
        'computes unpublished changes for $label',
        async ({ currentRevision, publishedRevision, expected }) => {
            fetchApiMock.mockResolvedValue(
                jsonResponse({
                    items: [
                        {
                            ...editorDetail,
                            status: 'DRAFT',
                            currentRevision: {
                                ...editorDetail.currentRevision,
                                ...currentRevision,
                            },
                            publishedRevision,
                        },
                    ],
                    page: 0,
                    size: 20,
                    totalElements: 1,
                    totalPages: 1,
                }),
            );

            const result = await getMyArticles();

            expect(result.content[0]?.hasUnpublishedChanges).toBe(expected);
        },
    );

    it('preserves problem article pagination and requests a bounded page', async () => {
        fetchPublicApiMock.mockResolvedValue(
            jsonResponse({
                items: [{ id: 3, slug: 'bounded', title: 'Bounded', authors: [] }],
                page: 0,
                size: 12,
                totalElements: 14,
                totalPages: 2,
            }),
        );

        const result = await getProblemArticles(289, { page: 0, size: 12, locale: 'de' });

        expect(result.page.totalElements).toBe(14);
        const requestedUrl = String(fetchPublicApiMock.mock.calls[0]?.[0]);
        expect(requestedUrl).toContain('/problems/289/articles');
        expect(requestedUrl).toContain('page=0');
        expect(requestedUrl).toContain('size=12');
        expect(
            new Headers(fetchPublicApiMock.mock.calls[0]?.[1]?.headers).get('accept-language'),
        ).toBe('de');
    });

    it('requests the compact profile portfolio page and preserves its total count', async () => {
        fetchPublicApiMock.mockResolvedValue(
            jsonResponse({
                items: [{ id: 3, slug: 'profile-article', title: 'Profile article', authors: [] }],
                page: 0,
                size: 3,
                totalElements: 8,
                totalPages: 3,
            }),
        );

        const result = await getProfileArticles('author/one', { size: 3, locale: 'es' });

        expect(result.page.totalElements).toBe(8);
        const requestedUrl = String(fetchPublicApiMock.mock.calls[0]?.[0]);
        expect(requestedUrl).toContain('/profile/author%2Fone/articles');
        expect(requestedUrl).toContain('size=3');
        expect(
            new Headers(fetchPublicApiMock.mock.calls[0]?.[1]?.headers).get('accept-language'),
        ).toBe('es');
    });

    it('reads the backend public error contract', async () => {
        fetchApiMock.mockResolvedValue(
            jsonResponse(
                {
                    errorCode: 'ARTICLE_VERSION_CONFLICT',
                    publicErrorMessage: 'Reload the latest article version.',
                },
                409,
            ),
        );

        await expect(getMyArticles()).rejects.toMatchObject({
            status: 409,
            code: 'ARTICLE_VERSION_CONFLICT',
            message: 'Reload the latest article version.',
        });
    });

    it('uses the change-request version for cancellation and refreshes editor detail', async () => {
        fetchApiMock
            .mockResolvedValueOnce(jsonResponse({ id: 99, status: 'CANCELLED' }))
            .mockResolvedValueOnce(jsonResponse(editorDetail));

        const result = await cancelArticleRequest(ownedArticle());

        expect(String(fetchApiMock.mock.calls[0]?.[0])).toContain(
            '/me/articles/change-requests/99/cancel',
        );
        expect(JSON.parse(String(fetchApiMock.mock.calls[0]?.[1]?.body))).toEqual({ version: 4 });
        expect(String(fetchApiMock.mock.calls[1]?.[0])).toContain('/me/articles/42');
        expect(result.version).toBe(13);
    });

    it('uses the article version for submission', async () => {
        const article = { ...ownedArticle(), latestChangeRequest: null };
        fetchApiMock
            .mockResolvedValueOnce(jsonResponse({ id: 101, status: 'PENDING' }))
            .mockResolvedValueOnce(jsonResponse(editorDetail));

        await submitArticleForReview(article, 'Ready for review');

        expect(String(fetchApiMock.mock.calls[0]?.[0])).toContain('/me/articles/42/submit');
        expect(JSON.parse(String(fetchApiMock.mock.calls[0]?.[1]?.body))).toEqual({
            version: 12,
            rationale: 'Ready for review',
        });
    });

    it('accepts problem-scoped invitations without an existing article', async () => {
        fetchPublicApiMock.mockResolvedValue(
            jsonResponse({
                status: 'PENDING',
                maskedEmail: 'r***@example.com',
                problem: { id: 289, title: 'Grid Search', authors: [] },
                article: null,
                message: null,
                expiresAt: '2026-07-20T08:00:00Z',
            }),
        );

        const invitation = await getArticleInvitation('token-1');

        expect(invitation.valid).toBe(true);
        expect(invitation.article).toBeNull();
        expect(invitation.problem?.id).toBe(289);
        expect(String(fetchPublicApiMock.mock.calls[0]?.[0])).toBe(
            'https://api.example.test/article-invitations/preview',
        );
        expect(fetchPublicApiMock.mock.calls[0]?.[1]).toMatchObject({
            method: 'POST',
            body: JSON.stringify({ token: 'token-1' }),
        });
    });

    it('redeems an HttpOnly invitation through the same-origin exchange without a token', async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse(editorDetail));
        vi.stubGlobal('fetch', fetchMock);

        const result = await redeemStoredArticleInvitation('safe-handle');

        expect(fetchMock).toHaveBeenCalledWith('/api/article-invitations/safe-handle/redeem', {
            method: 'POST',
            credentials: 'same-origin',
        });
        expect(result.id).toBe(42);
        vi.unstubAllGlobals();
    });

    it('reads backend-sanitized HTML from markdown preview responses', async () => {
        fetchApiMock.mockResolvedValue(jsonResponse({ html: '<p>Safe</p>' }));

        await expect(previewArticleMarkdown('Safe', 42)).resolves.toEqual({
            sanitizedHtml: '<p>Safe</p>',
        });
        expect(JSON.parse(String(fetchApiMock.mock.calls[0]?.[1]?.body))).toEqual({
            articleId: 42,
            markdown: 'Safe',
        });
    });

    it('uploads article images as multipart data and normalizes the stable Markdown URL', async () => {
        fetchApiMock.mockResolvedValue(
            jsonResponse({
                id: '8e1327fe-5678-4abc-9abc-123456789012',
                markdownUrl: '/article-media/8e1327fe-5678-4abc-9abc-123456789012',
                previewUrl: '/article-media/8e1327fe-5678-4abc-9abc-123456789012',
                contentType: 'image/png',
                byteSize: 2048,
                width: 640,
                height: 360,
                referencedInCurrent: false,
                referencedInPublished: false,
                countsTowardsDraftLimit: true,
            }),
        );
        const file = new File(['image'], 'diagram.png', { type: 'image/png' });

        const result = await uploadArticleImage(42, file);

        expect(result).toMatchObject({
            markdownUrl: '/article-media/8e1327fe-5678-4abc-9abc-123456789012',
            sizeBytes: 2048,
            width: 640,
            height: 360,
            referencedInCurrent: false,
            referencedInPublished: false,
            countsTowardsDraftLimit: true,
        });
        const request = fetchApiMock.mock.calls[0];
        expect(String(request?.[0])).toContain('/me/articles/42/images');
        expect(request?.[1]).toMatchObject({ method: 'POST' });
        expect(request?.[1]?.body).toBeInstanceOf(FormData);
        expect(new Headers(request?.[1]?.headers).has('content-type')).toBe(false);
    });

    it('lists and deletes images through the ownership-scoped article endpoints', async () => {
        fetchApiMock
            .mockResolvedValueOnce(
                jsonResponse({
                    images: [
                        {
                            id: '8e1327fe-5678-4abc-9abc-123456789012',
                            url: '/article-media/8e1327fe-5678-4abc-9abc-123456789012',
                            contentType: 'image/jpeg',
                            byteSize: 99,
                        },
                        {
                            id: '23456789-abcd-4def-8abc-234567890123',
                            markdownUrl: '/article-media/23456789-abcd-4def-8abc-234567890123',
                            contentType: 'image/png',
                            byteSize: 199,
                            referencedInCurrent: false,
                            referencedInPublished: true,
                            countsTowardsDraftLimit: false,
                        },
                    ],
                    imageCount: 2,
                    maxImages: 5,
                }),
            )
            .mockResolvedValueOnce(new Response(null, { status: 204 }));

        const result = await getArticleImages(42);
        await deleteArticleImage(42, result.images[0]!.id);

        expect(result.imageCount).toBe(1);
        expect(result.images[0]).toMatchObject({
            sizeBytes: 99,
            previewUrl: result.images[0]?.markdownUrl,
            countsTowardsDraftLimit: true,
        });
        expect(result.images[1]).toMatchObject({
            referencedInCurrent: false,
            referencedInPublished: true,
            countsTowardsDraftLimit: false,
        });
        expect(String(fetchApiMock.mock.calls[1]?.[0])).toContain(
            '/me/articles/42/images/8e1327fe-5678-4abc-9abc-123456789012',
        );
        expect(fetchApiMock.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
    });

    it('uses the protected public-detail preview endpoints for articles and review requests', async () => {
        fetchApiMock
            .mockResolvedValueOnce(
                jsonResponse({ id: 42, slug: 'draft', title: 'Draft', sanitizedHtml: '<p>D</p>' }),
            )
            .mockResolvedValueOnce(
                jsonResponse({ id: 42, slug: 'draft', title: 'Draft', sanitizedHtml: '<p>P</p>' }),
            );

        await getAdminArticlePreview(42, 'current');
        await getAdminArticleReviewPreview(99, 'proposed');

        expect(String(fetchApiMock.mock.calls[0]?.[0])).toContain(
            '/admin/articles/42/public-preview?revision=current',
        );
        expect(String(fetchApiMock.mock.calls[1]?.[0])).toContain(
            '/admin/article-change-requests/99/public-preview?revision=proposed',
        );
    });
});
