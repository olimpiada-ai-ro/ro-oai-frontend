import { getSession as getServerAuthSession, handleLogout } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { Page, RawSubmission, Submission } from '@/lib/types';
import { detectLocale } from '@/lib/i18n-config';
import { normalizeCountyRankingsPayload } from '@/lib/county-rankings';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { fetchPublicApi } from '@/lib/public-api';
import type { Session } from 'next-auth';

let clientSessionRequest: Promise<Session | null> | null = null;

async function getClientSession(): Promise<Session | null> {
    if (clientSessionRequest) return clientSessionRequest;

    const request = import('next-auth/react').then(({ getSession }) =>
        getSession({ broadcast: false }),
    );
    clientSessionRequest = request;

    try {
        return await request;
    } finally {
        if (clientSessionRequest === request) clientSessionRequest = null;
    }
}

function fetchApiRequest(input: string | URL, init: RequestInit): Promise<Response> {
    const method = (init.method ?? 'GET').toUpperCase();
    return method === 'GET' || method === 'HEAD'
        ? fetchWithTimeout(input, init)
        : fetch(input, init);
}

/**
 * Isomorphic helper to call backend APIs with an up-to-date access token.
 * - On the server: uses getServerSession to ensure token refresh and adds Authorization.
 * - On the client: uses next-auth/react getSession to read the token and adds Authorization.
 * - Defaults to no-store cache and includes Accept header.
 */
export async function fetchApi(input: string | URL, init?: RequestInit): Promise<Response> {
    // Client-side branch: avoid calling server-only APIs
    if (typeof window !== 'undefined') {
        const url = input.toString();
        const isAuthRoute = url.includes('/api/auth/') || url.includes('/login');

        const buildHeadersWithToken = (session: Session | null) => {
            const headers = new Headers(init?.headers as HeadersInit);
            if (session?.accessToken) {
                headers.set('Authorization', `Bearer ${session.accessToken}`);
            }
            headers.set('accept', headers.get('accept') ?? '*/*');
            headers.set('accept-language', headers.get('accept-language') ?? detectLocale());
            return headers;
        };

        const doFetch = (session: Session | null): Promise<Response> => {
            const headers = buildHeadersWithToken(session);
            return fetchApiRequest(url, {
                ...init,
                headers,
                // include cookies if any cross-origin or same-site scenarios
                cache: init?.cache ?? 'no-store',
            });
        };

        let session: Session | null = null;
        try {
            session = await getClientSession();
        } catch (error) {
            // If next-auth/react isn't available for some reason, continue without Authorization.
            console.warn('fetchApi(client): unable to load session for auth header', error);
        }

        // First attempt
        let response = await doFetch(session);

        // Only an authenticated request may trigger a refresh/logout flow. Public 401 responses
        // must remain ordinary API errors instead of bouncing anonymous visitors through Keycloak.
        if (response.status === 401 && !isAuthRoute && session?.accessToken) {
            try {
                // Trigger a session check (JWT callback may refresh if needed)
                const refreshedSession = await getClientSession();
                // Retry once with possibly refreshed token
                response = await doFetch(refreshedSession);
                if (response.status === 401) {
                    // Still unauthorized: the shared logout latch prevents concurrent requests
                    // from starting competing navigation flows.
                    await handleLogout();
                }
            } catch (error) {
                console.warn('fetchApi(client): error during 401 refresh attempt', error);
            }
        }

        return response;
    }

    // Server-side branch
    const session = await getServerAuthSession();
    const headers = new Headers(init?.headers as HeadersInit);

    if (session) {
        const nowSec = Math.floor(Date.now() / 1000);
        const expired = typeof session.expiresAt === 'number' && session.expiresAt <= nowSec;
        if (session.error || expired || !session.accessToken) {
            console.warn('Redirect to logout from middleware');
            redirect('/logout');
        }
        headers.set('Authorization', `Bearer ${session.accessToken}`);
    }

    headers.set('accept', headers.get('accept') ?? '*/*');

    return fetchApiRequest(input, {
        ...init,
        headers,
        cache: init?.cache ?? 'no-store',
    });
}

export async function getSubmissions(
    problemId: string | number,
    page: number = 0,
    size: number = 10,
): Promise<Page<Submission>> {
    const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/problems/${encodeURIComponent(problemId)}/submissions?page=${page}&size=${size}`;
    const resp = await fetchApi(url);

    const data = (await resp.json()) as Page<RawSubmission>;
    return {
        content: data.content.map((s) => ({
            ...s,
            submittedAt: new Date(s.submittedAt),
        })),
        page: data.page,
    };
}

// ============================================================================
// Comment System API Methods - User Operations
// ============================================================================

/**
 * Create a new question for a problem.
 *
 * @param problemId - The ID of the problem to ask about
 * @param request - The question content
 * @throws {Error} If the request fails due to validation, authentication, or network errors
 * @returns {Promise<Comment>} The created comment
 */
export async function createQuestion(
    problemId: number,
    request: import('./types').CreateCommentRequest,
): Promise<import('./types').Comment> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/problems/${problemId}/comments`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 400) {
                const error = await response.json().catch(() => ({ message: 'Invalid request' }));
                throw new Error(error.message || 'Please enter a valid question');
            }
            if (response.status === 403) {
                throw new Error('Comments are disabled for this problem');
            }
            throw new Error(`Failed to create question: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return {
            ...data,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
        };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get all visible comments for a problem.
 * Returns public comments and the user's own private comments.
 *
 * @param problemId - The ID of the problem
 * @throws {Error} If the request fails due to authentication or network errors
 * @returns {Promise<CommentThread[]>} Array of comment threads
 */
export async function getComments(problemId: number): Promise<import('./types').CommentThread[]> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/problems/${problemId}/comments`,
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            throw new Error(`Failed to fetch comments: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return (data || []).map((thread: any) => ({
            question: {
                ...thread.question,
                createdAt: new Date(thread.question.createdAt),
                updatedAt: new Date(thread.question.updatedAt),
            },
            answer: thread.answer
                ? {
                      ...thread.answer,
                      createdAt: new Date(thread.answer.createdAt),
                      updatedAt: new Date(thread.answer.updatedAt),
                  }
                : null,
            isPublic: thread.isPublic,
        }));
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get all comments created by the authenticated user across all problems.
 *
 * @param status - Filter by answered/unanswered status
 * @param page - Page number (0-indexed)
 * @param size - Number of items per page
 * @throws {Error} If the request fails due to authentication or network errors
 * @returns {Promise<PaginatedCommentsResponse>} Paginated list of user's comments
 */
export async function getUserComments(
    status?: import('./types').CommentStatus,
    page: number = 0,
    size: number = 20,
): Promise<import('./types').PaginatedCommentsResponse> {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            size: size.toString(),
        });

        if (status && status !== 'all') {
            params.append('status', status);
        }

        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/comments/me?${params.toString()}`,
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            throw new Error(
                `Failed to fetch user comments: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return {
            ...data,
            content: (data.content || []).map((comment: any) => ({
                ...comment,
                createdAt: new Date(comment.createdAt),
                updatedAt: new Date(comment.updatedAt),
            })),
        };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get the count of unanswered questions for the authenticated user.
 *
 * @throws {Error} If the request fails due to authentication or network errors
 * @returns {Promise<number>} Count of unanswered questions
 */
export async function getUnreadCount(): Promise<number> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/comments/me/unread-count`,
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            throw new Error(
                `Failed to fetch unread count: ${response.status} ${response.statusText}`,
            );
        }

        const data: import('./types').UnreadCountResponse = await response.json();
        return data.count;
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

// ============================================================================
// Comment System API Methods - Moderation Operations
// ============================================================================

/**
 * Get all comments for moderation with filtering.
 * Requires moderator or admin permissions.
 *
 * @param filter - Filter criteria for comments
 * @param page - Page number (0-indexed)
 * @param size - Number of items per page
 * @throws {Error} If the request fails due to authentication, authorization, or network errors
 * @returns {Promise<PaginatedCommentsResponse>} Paginated list of comments for moderation
 */
export async function getCommentsForModeration(
    filter?: import('./types').CommentFilter,
    page: number = 0,
    size: number = 20,
): Promise<import('./types').PaginatedCommentsResponse> {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            size: size.toString(),
        });

        if (filter?.problemId) {
            params.append('problemId', filter.problemId.toString());
        }
        if (filter?.competitionId) {
            params.append('competitionId', filter.competitionId.toString());
        }
        if (filter?.status) {
            params.append('status', filter.status);
        }
        if (filter?.visibility) {
            params.append('visibility', filter.visibility);
        }
        if (filter?.searchQuery) {
            params.append('searchQuery', filter.searchQuery);
        }

        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/comments?${params.toString()}`,
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to access moderation features');
            }
            throw new Error(
                `Failed to fetch comments for moderation: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return {
            ...data,
            content: (data.content || []).map((comment: any) => ({
                ...comment,
                createdAt: new Date(comment.createdAt),
                updatedAt: new Date(comment.updatedAt),
            })),
        };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Answer a question as a moderator.
 * Requires moderator or admin permissions for the problem.
 *
 * @param commentId - The ID of the question to answer
 * @param request - The answer content and visibility settings
 * @throws {Error} If the request fails due to validation, authentication, authorization, or network errors
 * @returns {Promise<Comment>} The created answer comment
 */
export async function answerQuestion(
    commentId: number,
    request: import('./types').AnswerCommentRequest,
): Promise<import('./types').Comment> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/comments/${commentId}/answer`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to answer this question');
            }
            if (response.status === 400) {
                const error = await response.json().catch(() => ({ message: 'Invalid request' }));
                throw new Error(error.message || 'Please enter a valid answer');
            }
            if (response.status === 404) {
                throw new Error('Question not found');
            }
            throw new Error(`Failed to answer question: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return {
            ...data,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
        };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Update the visibility of a comment thread (question and answer).
 * Requires moderator or admin permissions for the problem.
 *
 * @param commentId - The ID of the comment to update
 * @param request - The new visibility setting
 * @throws {Error} If the request fails due to validation, authentication, authorization, or network errors
 * @returns {Promise<Comment>} The updated comment
 */
export async function updateCommentVisibility(
    commentId: number,
    request: import('./types').UpdateVisibilityRequest,
): Promise<import('./types').Comment> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/comments/${commentId}/visibility`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to update this comment');
            }
            if (response.status === 404) {
                throw new Error('Comment not found');
            }
            throw new Error(
                `Failed to update comment visibility: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return {
            ...data,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
        };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get moderation statistics including pending counts and response times.
 * Requires moderator or admin permissions.
 *
 * @throws {Error} If the request fails due to authentication, authorization, or network errors
 * @returns {Promise<CommentStatsResponse>} Moderation statistics
 */
export async function getModerationStats(): Promise<import('./types').CommentStatsResponse> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/comments/stats`,
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to access moderation statistics');
            }
            throw new Error(
                `Failed to fetch moderation stats: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();
        return data;
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

// ============================================================================
// Institution and County Management API Methods
// ============================================================================

/**
 * Get all counties with optional statistics.
 *
 * @param includeStats - Whether to include statistics for each county
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<CountyResponse[]>} List of counties
 */
export async function getCounties(
    includeStats: boolean = false,
): Promise<import('./types').CountyResponse[]> {
    try {
        const params = new URLSearchParams();
        if (includeStats) {
            params.append('includeStats', 'true');
        }

        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/counties${params.toString() ? '?' + params.toString() : ''}`,
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch counties: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get county details by ID with statistics.
 *
 * @param countyId - The ID of the county
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<CountyResponse>} County details with statistics
 */
export async function getCountyById(countyId: number): Promise<import('./types').CountyResponse> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/counties/${countyId}`,
        );

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('County not found');
            }
            throw new Error(`Failed to fetch county: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get institutions with filtering and pagination.
 *
 * @param filters - Filter criteria
 * @param page - Page number (0-indexed)
 * @param size - Number of items per page
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<PaginatedInstitutionsResponse>} Paginated list of institutions
 */
export async function getInstitutions(
    filters?: {
        type?: import('./types').InstitutionType;
        countyId?: number;
        countryCode?: string;
        search?: string;
        sort?: 'name' | 'country' | 'county' | 'memberCount' | 'type';
        direction?: 'asc' | 'desc';
    },
    page: number = 0,
    size: number = 20,
): Promise<import('./types').PaginatedInstitutionsResponse> {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            size: size.toString(),
        });

        if (filters?.type) {
            params.append('type', filters.type);
        }
        if (filters?.countyId) {
            params.append('countyId', filters.countyId.toString());
        }
        if (filters?.countryCode) {
            params.append('countryCode', filters.countryCode);
        }
        if (filters?.search) {
            params.append('search', filters.search);
        }
        if (filters?.sort) {
            params.append('sort', filters.sort);
        }
        if (filters?.direction) {
            params.append('direction', filters.direction);
        }

        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/institutions?${params.toString()}`,
        );

        if (!response.ok) {
            throw new Error(
                `Failed to fetch institutions: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects and flatten pagination structure
        return {
            content: (data.content || []).map((institution: any) => ({
                ...institution,
                createdAt: new Date(institution.createdAt),
            })),
            totalElements: data.page?.totalElements || 0,
            totalPages: data.page?.totalPages || 0,
            size: data.page?.size || size,
            number: data.page?.number || page,
        };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get institution details by ID.
 *
 * @param institutionId - The ID of the institution
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<InstitutionResponse>} Institution details
 */
export async function getInstitutionById(
    institutionId: number,
): Promise<import('./types').InstitutionResponse> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/institutions/${institutionId}`,
        );

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Institution not found');
            }
            throw new Error(
                `Failed to fetch institution: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return {
            ...data,
            createdAt: new Date(data.createdAt),
            moderators: (data.moderators || []).map((mod: any) => ({
                ...mod,
                assignedAt: new Date(mod.assignedAt),
            })),
        };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Create a membership request to join an institution.
 * Requires authentication.
 *
 * @param institutionId - The ID of the institution to join
 * @throws {Error} If the request fails due to validation, authentication, or network errors
 * @returns {Promise<MembershipRequest>} The created membership request
 */
export async function createMembershipRequest(
    institutionId: number,
): Promise<import('./types').MembershipRequest> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/membership-requests`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ institutionId }),
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 409) {
                const error = await response.json().catch(() => ({ message: 'Duplicate request' }));
                throw new Error(
                    error.message || 'You already have a pending request for this institution',
                );
            }
            if (response.status === 400) {
                const error = await response.json().catch(() => ({ message: 'Invalid request' }));
                throw new Error(error.message || 'Invalid institution');
            }
            throw new Error(
                `Failed to create membership request: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return {
            ...data,
            requestedAt: new Date(data.requestedAt),
            processedAt: data.processedAt ? new Date(data.processedAt) : undefined,
            institution: {
                ...data.institution,
                createdAt: new Date(data.institution.createdAt),
            },
        };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get the authenticated user's membership requests.
 * Requires authentication.
 *
 * @throws {Error} If the request fails due to authentication or network errors
 * @returns {Promise<MembershipRequest[]>} List of user's membership requests
 */
export async function getMyMembershipRequests(): Promise<import('./types').MembershipRequest[]> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/membership-requests/my-requests`,
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            throw new Error(
                `Failed to fetch membership requests: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return (data || []).map((request: any) => ({
            ...request,
            requestedAt: new Date(request.requestedAt),
            processedAt: request.processedAt ? new Date(request.processedAt) : undefined,
            institution: {
                ...request.institution,
                createdAt: new Date(request.institution.createdAt),
            },
        }));
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Cancel a pending membership request.
 * Requires authentication and ownership of the request.
 *
 * @param requestId - The ID of the request to cancel
 * @throws {Error} If the request fails due to authentication, authorization, or network errors
 * @returns {Promise<void>}
 */
export async function cancelMembershipRequest(requestId: number): Promise<void> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/membership-requests/${requestId}`,
            {
                method: 'DELETE',
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to cancel this request');
            }
            if (response.status === 404) {
                throw new Error('Request not found');
            }
            throw new Error(
                `Failed to cancel membership request: ${response.status} ${response.statusText}`,
            );
        }
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Leave the current institution.
 * Requires authentication.
 *
 * @throws {Error} If the request fails due to authentication or network errors
 * @returns {Promise<void>}
 */
export async function leaveInstitution(): Promise<void> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/membership-requests/leave-institution`,
            {
                method: 'POST',
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 400) {
                const error = await response.json().catch(() => ({ message: 'Bad request' }));
                throw new Error(
                    error.message || 'You are not currently a member of any institution',
                );
            }
            throw new Error(
                `Failed to leave institution: ${response.status} ${response.statusText}`,
            );
        }
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get institution rankings by member count.
 *
 * @param filters - Filter criteria
 * @param limit - Maximum number of results
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<InstitutionRanking[]>} List of ranked institutions
 */
export async function getInstitutionRankings(
    filters?: {
        type?: import('./types').InstitutionType;
        countyId?: number;
    },
    limit: number = 100,
): Promise<import('./types').InstitutionRanking[]> {
    try {
        const params = new URLSearchParams({
            limit: limit.toString(),
        });

        if (filters?.type) {
            params.append('type', filters.type);
        }
        if (filters?.countyId) {
            params.append('countyId', filters.countyId.toString());
        }

        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/rankings/institutions?${params.toString()}`,
        );

        if (!response.ok) {
            throw new Error(
                `Failed to fetch institution rankings: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform flat structure to nested structure with institution object
        return (data || []).map((ranking: any) => ({
            rank: ranking.rank,
            memberCount: ranking.memberCount,
            totalScore: ranking.totalScore,
            institution: {
                id: ranking.institutionId,
                name: ranking.institutionName,
                type: ranking.institutionType,
                county: {
                    id: ranking.countyId,
                    name: ranking.countyName,
                    code: ranking.countyCode,
                },
                country: {
                    code: ranking.countryCode,
                    name: ranking.countryName,
                    flagEmoji: ranking.countryFlagEmoji,
                },
                memberCount: ranking.memberCount,
                createdAt: new Date(),
            },
        }));
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get county rankings by user count.
 *
 * @param limit - Maximum number of results
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<CountyRanking[]>} List of ranked counties
 */
export async function getCountyRankings(
    limit: number = 50,
): Promise<import('./types').CountyRanking[]> {
    try {
        const params = new URLSearchParams({
            limit: limit.toString(),
        });

        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/rankings/counties?${params.toString()}`,
        );

        if (!response.ok) {
            throw new Error(
                `Failed to fetch county rankings: ${response.status} ${response.statusText}`,
            );
        }

        const data: unknown = await response.json();
        return normalizeCountyRankingsPayload(data);
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

// ============================================================================
// Country API Methods
// ============================================================================

/**
 * Get all countries.
 *
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<Country[]>} List of countries
 */
export async function getCountries(): Promise<import('./types').Country[]> {
    try {
        const response = await fetchApi(`${process.env.NEXT_PUBLIC_API_BASE_URL}/countries`);

        if (!response.ok) {
            throw new Error(`Failed to fetch countries: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data || [];
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get enabled countries with institution and member statistics.
 */
export async function getCountryOverviews(): Promise<import('./types').CountryOverview[]> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/countries/overview`,
        );

        if (!response.ok) {
            throw new Error(
                `Failed to fetch country overviews: ${response.status} ${response.statusText}`,
            );
        }

        return (await response.json()) || [];
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get one enabled country with institution and member statistics.
 */
export async function getCountryOverview(
    countryCode: string,
): Promise<import('./types').CountryOverview> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/countries/${encodeURIComponent(countryCode)}/overview`,
        );

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Country not found');
            }
            throw new Error(
                `Failed to fetch country overview: ${response.status} ${response.statusText}`,
            );
        }

        return await response.json();
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get the county breakdown for a country. Romania currently provides the only
 * county-level directory; other countries return an empty list.
 */
export async function getCountryCounties(
    countryCode: string,
    includeStats: boolean = false,
): Promise<import('./types').CountyResponse[]> {
    try {
        const params = new URLSearchParams();
        if (includeStats) {
            params.set('includeStatistics', 'true');
        }

        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/countries/${encodeURIComponent(countryCode)}/counties${params.size ? `?${params.toString()}` : ''}`,
        );

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Country not found');
            }
            throw new Error(
                `Failed to fetch country counties: ${response.status} ${response.statusText}`,
            );
        }

        return (await response.json()) || [];
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get one county from a country's public hierarchy.
 */
export async function getCountryCountyById(
    countryCode: string,
    countyId: number,
): Promise<import('./types').CountyResponse> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/countries/${encodeURIComponent(countryCode)}/counties/${countyId}`,
        );

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('County not found');
            }
            throw new Error(
                `Failed to fetch country county: ${response.status} ${response.statusText}`,
            );
        }

        return await response.json();
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get country rankings by aggregate score.
 *
 * @param limit - Maximum number of results
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<CountryRanking[]>} List of ranked countries
 */
export async function getCountryRankings(
    limit: number = 50,
): Promise<import('./types').CountryRanking[]> {
    try {
        const params = new URLSearchParams({
            limit: limit.toString(),
        });

        const response = await fetchPublicApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/rankings/countries?${params.toString()}`,
        );

        if (!response.ok) {
            throw new Error(
                `Failed to fetch country rankings: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();
        return data || [];
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

// ============================================================================
// Institution Management API Methods
// ============================================================================

/**
 * Create a new institution.
 * Requires admin or county moderator permissions.
 *
 * @param request - The institution data
 * @throws {Error} If the request fails due to validation, authentication, authorization, or network errors
 * @returns {Promise<InstitutionResponse>} The created institution
 */
export async function createInstitution(request: {
    name: string;
    type: import('./types').InstitutionType;
    countyId: number;
    address?: string;
    description?: string;
    website?: string;
}): Promise<import('./types').InstitutionResponse> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/institutions`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to create institutions');
            }
            if (response.status === 400) {
                const error = await response.json().catch(() => ({ message: 'Invalid request' }));
                throw new Error(error.message || 'Please provide valid institution data');
            }
            if (response.status === 409) {
                const error = await response
                    .json()
                    .catch(() => ({ message: 'Duplicate institution' }));
                throw new Error(
                    error.message || 'An institution with this name already exists in this county',
                );
            }
            throw new Error(
                `Failed to create institution: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return {
            ...data,
            createdAt: new Date(data.createdAt),
            moderators: (data.moderators || []).map((mod: any) => ({
                ...mod,
                assignedAt: new Date(mod.assignedAt),
            })),
        };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Update an existing institution.
 * Requires admin or county moderator permissions.
 *
 * @param institutionId - The ID of the institution to update
 * @param request - The updated institution data
 * @throws {Error} If the request fails due to validation, authentication, authorization, or network errors
 * @returns {Promise<InstitutionResponse>} The updated institution
 */
export async function updateInstitution(
    institutionId: number,
    request: {
        name?: string;
        type?: import('./types').InstitutionType;
        countyId?: number;
        address?: string;
        description?: string;
        website?: string;
    },
): Promise<import('./types').InstitutionResponse> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/institutions/${institutionId}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to update this institution');
            }
            if (response.status === 404) {
                throw new Error('Institution not found');
            }
            if (response.status === 400) {
                const error = await response.json().catch(() => ({ message: 'Invalid request' }));
                throw new Error(error.message || 'Please provide valid institution data');
            }
            throw new Error(
                `Failed to update institution: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return {
            ...data,
            createdAt: new Date(data.createdAt),
            moderators: (data.moderators || []).map((mod: any) => ({
                ...mod,
                assignedAt: new Date(mod.assignedAt),
            })),
        };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Delete an institution.
 * Requires admin permissions. Only institutions with no members can be deleted.
 *
 * @param institutionId - The ID of the institution to delete
 * @throws {Error} If the request fails due to authentication, authorization, or network errors
 * @returns {Promise<void>}
 */
export async function deleteInstitution(institutionId: number): Promise<void> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/institutions/${institutionId}`,
            {
                method: 'DELETE',
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to delete institutions');
            }
            if (response.status === 404) {
                throw new Error('Institution not found');
            }
            if (response.status === 409) {
                const error = await response
                    .json()
                    .catch(() => ({ message: 'Cannot delete institution' }));
                throw new Error(error.message || 'Cannot delete institution with existing members');
            }
            throw new Error(
                `Failed to delete institution: ${response.status} ${response.statusText}`,
            );
        }
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Assign a moderator to an institution.
 * Requires admin or county moderator permissions.
 *
 * @param institutionId - The ID of the institution
 * @param userId - The ID of the user to assign as moderator
 * @throws {Error} If the request fails due to authentication, authorization, or network errors
 * @returns {Promise<void>}
 */
export async function assignInstitutionModerator(
    institutionId: number,
    userId: string,
): Promise<void> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/institutions/${institutionId}/moderators`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId }),
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to assign institution moderators');
            }
            if (response.status === 404) {
                throw new Error('Institution or user not found');
            }
            if (response.status === 409) {
                const error = await response
                    .json()
                    .catch(() => ({ message: 'Duplicate assignment' }));
                throw new Error(error.message || 'User is already a moderator of this institution');
            }
            throw new Error(
                `Failed to assign institution moderator: ${response.status} ${response.statusText}`,
            );
        }
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Remove a moderator from an institution.
 * Requires admin or county moderator permissions.
 *
 * @param institutionId - The ID of the institution
 * @param userId - The ID of the user to remove as moderator
 * @throws {Error} If the request fails due to authentication, authorization, or network errors
 * @returns {Promise<void>}
 */
export async function removeInstitutionModerator(
    institutionId: number,
    userId: string,
): Promise<void> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/institutions/${institutionId}/moderators/${userId}`,
            {
                method: 'DELETE',
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to remove institution moderators');
            }
            if (response.status === 404) {
                throw new Error('Institution moderator assignment not found');
            }
            throw new Error(
                `Failed to remove institution moderator: ${response.status} ${response.statusText}`,
            );
        }
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get membership requests for moderation.
 * Requires admin, county moderator, or institution moderator permissions.
 *
 * @param filters - Filter criteria
 * @param page - Page number (0-indexed)
 * @param size - Number of items per page
 * @throws {Error} If the request fails due to authentication, authorization, or network errors
 * @returns {Promise<PaginatedMembershipRequestsResponse>} Paginated list of membership requests
 */
export async function getMembershipRequests(
    filters?: {
        institutionId?: number;
        countyId?: number;
        status?: import('./types').RequestStatus;
    },
    page: number = 0,
    size: number = 20,
): Promise<import('./types').PaginatedMembershipRequestsResponse> {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            size: size.toString(),
        });

        if (filters?.institutionId) {
            params.append('institutionId', filters.institutionId.toString());
        }
        if (filters?.countyId) {
            params.append('countyId', filters.countyId.toString());
        }
        if (filters?.status) {
            params.append('status', filters.status);
        }

        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/membership-requests?${params.toString()}`,
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to view membership requests');
            }
            throw new Error(
                `Failed to fetch membership requests: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return {
            ...data,
            content: (data.content || []).map((request: any) => ({
                ...request,
                requestedAt: new Date(request.requestedAt),
                processedAt: request.processedAt ? new Date(request.processedAt) : undefined,
                institution: {
                    ...request.institution,
                    createdAt: new Date(request.institution.createdAt),
                },
            })),
        };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Approve a membership request.
 * Requires admin, county moderator, or institution moderator permissions.
 *
 * @param requestId - The ID of the request to approve
 * @param notes - Optional notes about the approval
 * @throws {Error} If the request fails due to authentication, authorization, or network errors
 * @returns {Promise<MembershipRequest>} The approved membership request
 */
export async function approveMembershipRequest(
    requestId: number,
    notes?: string,
): Promise<import('./types').MembershipRequest> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/membership-requests/${requestId}/approve`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ notes }),
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to approve this request');
            }
            if (response.status === 404) {
                throw new Error('Membership request not found');
            }
            if (response.status === 400) {
                const error = await response.json().catch(() => ({ message: 'Invalid request' }));
                throw new Error(error.message || 'Cannot approve this request');
            }
            throw new Error(
                `Failed to approve membership request: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return {
            ...data,
            requestedAt: new Date(data.requestedAt),
            processedAt: data.processedAt ? new Date(data.processedAt) : undefined,
            institution: {
                ...data.institution,
                createdAt: new Date(data.institution.createdAt),
            },
        };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Decline a membership request.
 * Requires admin, county moderator, or institution moderator permissions.
 *
 * @param requestId - The ID of the request to decline
 * @param notes - Required notes explaining the decline reason
 * @throws {Error} If the request fails due to authentication, authorization, or network errors
 * @returns {Promise<MembershipRequest>} The declined membership request
 */
export async function declineMembershipRequest(
    requestId: number,
    notes: string,
): Promise<import('./types').MembershipRequest> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/membership-requests/${requestId}/decline`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ notes }),
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to decline this request');
            }
            if (response.status === 404) {
                throw new Error('Membership request not found');
            }
            if (response.status === 400) {
                const error = await response.json().catch(() => ({ message: 'Invalid request' }));
                throw new Error(error.message || 'Please provide a reason for declining');
            }
            throw new Error(
                `Failed to decline membership request: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return {
            ...data,
            requestedAt: new Date(data.requestedAt),
            processedAt: data.processedAt ? new Date(data.processedAt) : undefined,
            institution: {
                ...data.institution,
                createdAt: new Date(data.institution.createdAt),
            },
        };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Assign a moderator to a county.
 * Requires admin permissions.
 *
 * @param countyId - The ID of the county
 * @param userId - The ID of the user to assign as moderator
 * @throws {Error} If the request fails due to authentication, authorization, or network errors
 * @returns {Promise<void>}
 */
export async function assignCountyModerator(countyId: number, userId: string): Promise<void> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/counties/${countyId}/moderators`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId }),
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to assign county moderators');
            }
            if (response.status === 404) {
                throw new Error('County or user not found');
            }
            if (response.status === 409) {
                const error = await response
                    .json()
                    .catch(() => ({ message: 'Duplicate assignment' }));
                throw new Error(error.message || 'User is already a moderator of this county');
            }
            throw new Error(
                `Failed to assign county moderator: ${response.status} ${response.statusText}`,
            );
        }
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Remove a moderator from a county.
 * Requires admin permissions.
 *
 * @param countyId - The ID of the county
 * @param userId - The ID of the user to remove as moderator
 * @throws {Error} If the request fails due to authentication, authorization, or network errors
 * @returns {Promise<void>}
 */
export async function removeCountyModerator(countyId: number, userId: string): Promise<void> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/counties/${countyId}/moderators/${userId}`,
            {
                method: 'DELETE',
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to remove county moderators');
            }
            if (response.status === 404) {
                throw new Error('County moderator assignment not found');
            }
            throw new Error(
                `Failed to remove county moderator: ${response.status} ${response.statusText}`,
            );
        }
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get detailed statistics for a county.
 *
 * @param countyId - The ID of the county
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<CountyStatistics>} County statistics
 */
export async function getCountyStatistics(
    countyId: number,
): Promise<import('./types').CountyStatistics> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/statistics/counties/${countyId}`,
        );

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('County not found');
            }
            throw new Error(
                `Failed to fetch county statistics: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects for institutions
        return {
            ...data,
            topInstitutions: (data.topInstitutions || []).map((institution: any) => ({
                ...institution,
                createdAt: new Date(institution.createdAt),
            })),
        };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get detailed statistics for an institution.
 *
 * @param institutionId - The ID of the institution
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<any>} Institution statistics
 */
export async function getInstitutionStatistics(institutionId: number): Promise<any> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/statistics/institutions/${institutionId}`,
        );

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Institution not found');
            }
            throw new Error(
                `Failed to fetch institution statistics: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();
        return data;
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get all notifications for the authenticated user.
 *
 * @throws {Error} If the request fails
 * @returns {Promise<Notification[]>} List of notifications
 */
export async function getNotifications(): Promise<import('./types').Notification[]> {
    try {
        const response = await fetchApi(`${process.env.NEXT_PUBLIC_API_BASE_URL}/notifications`, {
            method: 'GET',
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch notifications');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching notifications:', error);
        throw error;
    }
}

/**
 * Get unread notifications for the authenticated user.
 *
 * @throws {Error} If the request fails
 * @returns {Promise<Notification[]>} List of unread notifications
 */
export async function getUnreadNotifications(): Promise<import('./types').Notification[]> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/notifications/unread`,
            {
                method: 'GET',
            },
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch unread notifications');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching unread notifications:', error);
        throw error;
    }
}

/**
 * Get unread notification count for the authenticated user.
 *
 * @throws {Error} If the request fails
 * @returns {Promise<number>} Count of unread notifications
 */
export async function getUnreadNotificationCount(): Promise<number> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/notifications/unread/count`,
            {
                method: 'GET',
            },
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch unread notification count');
        }

        const data = await response.json();
        return data.count;
    } catch (error) {
        console.error('Error fetching unread notification count:', error);
        throw error;
    }
}

/**
 * Mark a notification as read.
 *
 * @param notificationId - The notification ID
 * @throws {Error} If the request fails
 * @returns {Promise<void>}
 */
export async function markNotificationAsRead(notificationId: number): Promise<void> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/notifications/${notificationId}/read`,
            {
                method: 'POST',
            },
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to mark notification as read');
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
}

/**
 * Mark all notifications as read for the authenticated user.
 *
 * @throws {Error} If the request fails
 * @returns {Promise<void>}
 */
export async function markAllNotificationsAsRead(): Promise<void> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/notifications/read-all`,
            {
                method: 'POST',
            },
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to mark all notifications as read');
        }
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
}

// ============================================================================
// Onboarding API Methods
// ============================================================================

/**
 * Update the onboarding dismissed status for the authenticated user.
 * Requires authentication.
 *
 * @param userId - The ID of the user
 * @param dismissed - Whether the onboarding wizard has been dismissed
 * @throws {Error} If the request fails due to authentication, authorization, or network errors
 * @returns {Promise<void>}
 */
export async function updateOnboardingDismissed(userId: string, dismissed: boolean): Promise<void> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/profile/${userId}/onboarding-dismissed`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ dismissed }),
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to update this profile');
            }
            if (response.status === 404) {
                throw new Error('User profile not found');
            }
            throw new Error(
                `Failed to update onboarding status: ${response.status} ${response.statusText}`,
            );
        }
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Update user profile settings for the authenticated user.
 * Requires authentication.
 *
 * @param updates - Partial profile updates (username, bio, location, etc.)
 * @throws {Error} If the request fails due to authentication, authorization, or network errors
 * @returns {Promise<void>}
 */
export async function updateUserProfile(updates: {
    username?: string;
    firstName?: string;
    lastName?: string;
    bio?: string;
    location?: string;
    website?: string;
    github?: string;
    countryCode?: string | null;
    isPublic?: boolean;
    visibleInLeaderboards?: boolean;
    publicSubmissionHistory?: boolean;
    emailPublic?: boolean;
}): Promise<void> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/profile/settings`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates),
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You do not have permission to update this profile');
            }
            if (response.status === 409) {
                throw new Error('Username already exists. Please choose a different username.');
            }
            throw new Error(`Failed to update profile: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

// ============================================================================
// Editorial API Methods
// ============================================================================

/**
 * Fetch editorial for a competition.
 * Only returns editorial if competition has ended and editorial is visible.
 *
 * @param competitionId - The ID of the competition
 * @throws {Error} If the request fails due to network errors or editorial not available
 * @returns {Promise<EditorialResponse>} The editorial response
 */
export async function fetchEditorial(
    competitionId: number,
): Promise<import('./types').EditorialResponse> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${competitionId}/editorial`,
        );

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('Editorial not yet available - competition has not ended');
            }
            if (response.status === 404) {
                throw new Error('Editorial not found or not visible');
            }
            throw new Error(`Failed to fetch editorial: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Fetch editorial contributions for a user profile.
 * Returns the user's contributions to competition editorials.
 *
 * @param userId - The ID of the user
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<EditorialContribution[]>} List of editorial contributions
 */
export async function fetchEditorialContributions(
    userId: string,
): Promise<import('./types').EditorialContribution[]> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/profile/${userId}/editorial-contributions`,
        );

        if (!response.ok) {
            if (response.status === 404) {
                // User not found or no contributions - return empty array
                return [];
            }
            throw new Error(
                `Failed to fetch editorial contributions: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();
        return data || [];
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

// ============================================================================
// Achievement System API Methods
// ============================================================================

/**
 * Get all active achievements.
 *
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<Achievement[]>} List of all active achievements
 */
export async function fetchAchievements(): Promise<import('./types').Achievement[]> {
    try {
        const response = await fetchApi(`${process.env.NEXT_PUBLIC_API_BASE_URL}/achievements`);

        if (!response.ok) {
            throw new Error(
                `Failed to fetch achievements: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();
        return data || [];
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get achievement details by ID.
 *
 * @param achievementId - The ID of the achievement
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<Achievement>} Achievement details
 */
export async function fetchAchievementById(
    achievementId: number,
): Promise<import('./types').Achievement> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/achievements/${achievementId}`,
        );

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Achievement not found');
            }
            throw new Error(
                `Failed to fetch achievement: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();
        return data;
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get all achievements earned by a user.
 *
 * @param userId - The user's ID
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<UserAchievement[]>} List of user's earned achievements
 */
export async function fetchUserAchievements(
    userId: string,
): Promise<import('./types').UserAchievement[]> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/users/${userId}/achievements`,
        );

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('User not found');
            }
            throw new Error(
                `Failed to fetch user achievements: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return (data || []).map((ua: any) => ({
            ...ua,
            unlockedAt: new Date(ua.unlockedAt),
        }));
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get user's progress on all achievements.
 *
 * @param userId - The user's ID
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<AchievementProgress[]>} List of achievement progress records
 */
export async function fetchUserProgress(
    userId: string,
): Promise<import('./types').AchievementProgress[]> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/users/${userId}/achievements/progress`,
        );

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('User not found');
            }
            throw new Error(
                `Failed to fetch user progress: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return (data || []).map((progress: any) => ({
            ...progress,
            lastUpdated: new Date(progress.lastUpdated),
        }));
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get user's showcased achievements.
 *
 * @param userId - The user's ID
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<UserAchievement[]>} List of showcased achievements (up to 5)
 */
export async function fetchUserShowcase(
    userId: string,
): Promise<import('./types').UserAchievement[]> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/users/${userId}/achievements/showcase`,
        );

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('User not found');
            }
            throw new Error(
                `Failed to fetch user showcase: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return (data || []).map((ua: any) => ({
            ...ua,
            unlockedAt: new Date(ua.unlockedAt),
        }));
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Update user's achievement showcase.
 * Requires authentication. Only the user themselves can update their showcase.
 *
 * @param userId - The user's ID
 * @param achievementIds - List of achievement IDs to showcase (max 5)
 * @throws {Error} If the request fails due to validation, authentication, or network errors
 * @returns {Promise<void>}
 */
export async function updateShowcase(userId: string, achievementIds: number[]): Promise<void> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/users/${userId}/achievements/showcase`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ achievementIds }),
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You can only update your own showcase');
            }
            if (response.status === 400) {
                const error = await response.json().catch(() => ({ message: 'Invalid request' }));
                throw new Error(error.message || 'Invalid showcase selection');
            }
            throw new Error(`Failed to update showcase: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get user's unnotified achievements.
 * Requires authentication. Only the user themselves can access their unnotified achievements.
 *
 * @param userId - The user's ID
 * @throws {Error} If the request fails due to authentication or network errors
 * @returns {Promise<UserAchievement[]>} List of unnotified achievements
 */
export async function fetchUnnotifiedAchievements(
    userId: string,
): Promise<import('./types').UserAchievement[]> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/users/${userId}/achievements/unnotified`,
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You can only access your own unnotified achievements');
            }
            throw new Error(
                `Failed to fetch unnotified achievements: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Transform ISO date strings to Date objects
        return (data || []).map((ua: any) => ({
            ...ua,
            unlockedAt: new Date(ua.unlockedAt),
        }));
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Mark achievements as notified.
 * Requires authentication. Only the user themselves can mark their achievements as notified.
 *
 * @param userId - The user's ID
 * @param achievementIds - List of achievement IDs to mark as notified
 * @throws {Error} If the request fails due to authentication or network errors
 * @returns {Promise<void>}
 */
export async function markAchievementsNotified(
    userId: string,
    achievementIds: number[],
): Promise<void> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/users/${userId}/achievements/notify`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ achievementIds }),
            },
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('You can only mark your own achievements as notified');
            }
            throw new Error(
                `Failed to mark achievements as notified: ${response.status} ${response.statusText}`,
            );
        }
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get user's achievement statistics.
 *
 * @param userId - The user's ID
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<AchievementStats>} User's achievement statistics
 */
export async function fetchAchievementStats(
    userId: string,
): Promise<import('./types').AchievementStats> {
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/users/${userId}/achievements/stats`,
        );

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('User not found');
            }
            throw new Error(
                `Failed to fetch achievement stats: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();
        return data;
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

/**
 * Get achievement leaderboard.
 *
 * @param page - Page number (0-indexed)
 * @param size - Number of items per page
 * @param sortBy - Sort criterion: "achievements" or "xp"
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<PaginatedAchievementLeaderboardResponse>} Paginated leaderboard entries
 */
export async function fetchAchievementLeaderboard(
    page: number = 0,
    size: number = 20,
    sortBy: 'achievements' | 'xp' = 'achievements',
): Promise<import('./types').PaginatedAchievementLeaderboardResponse> {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            size: size.toString(),
            sortBy,
        });

        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/achievements/leaderboard?${params.toString()}`,
        );

        if (!response.ok) {
            throw new Error(
                `Failed to fetch achievement leaderboard: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();

        // Handle Spring Boot Page response format
        return {
            content: data.content || [],
            totalElements: data.totalElements || data.page?.totalElements || 0,
            totalPages: data.totalPages || data.page?.totalPages || 0,
            size: data.size || data.page?.size || size,
            number: data.number || data.page?.number || page,
        };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

// ============================================================================
// Sitemap API Methods
// ============================================================================

/**
 * Public profile entry for sitemap generation
 */
export interface PublicProfileSitemapEntry {
    username: string;
    lastModified: string | null;
}

/**
 * Fetch all public profiles for sitemap generation.
 * This endpoint is public and doesn't require authentication.
 *
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<PublicProfileSitemapEntry[]>} List of public profile entries
 */
export async function fetchPublicProfilesForSitemap(): Promise<PublicProfileSitemapEntry[]> {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/sitemap/profiles`, {
            cache: 'no-store',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            console.warn(`[API] Failed to fetch public profiles for sitemap: ${response.status}`);
            return [];
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[API] Error fetching public profiles for sitemap:', error);
        return [];
    }
}

// ============================================================================
// Category API Methods
// ============================================================================

/**
 * Fetch all categories with problem counts.
 * This endpoint is public and returns categories for filtering.
 *
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<Category[]>} List of categories with problem counts
 */
export async function getCategories(): Promise<import('./types').Category[]> {
    try {
        const response = await fetchApi(`${process.env.NEXT_PUBLIC_API_BASE_URL}/categories`);

        if (!response.ok) {
            throw new Error(
                `Failed to fetch categories: ${response.status} ${response.statusText}`,
            );
        }

        const data = await response.json();
        return data || [];
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

// ============================================================================
// Problem Filtering API Methods
// ============================================================================

/**
 * Paginated response for problems with filtering
 */
export type PaginatedProblemsResponse = {
    content: import('./types').Problem[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
};

/**
 * Fetch problems with optional filtering parameters.
 * Supports search, difficulty, and category filtering.
 *
 * @param filters - Optional filter parameters
 * @param page - Page number (0-indexed)
 * @param size - Number of items per page
 * @throws {Error} If the request fails due to network errors
 * @returns {Promise<PaginatedProblemsResponse>} Paginated list of problems
 */
export async function getProblemsWithFilters(
    filters?: import('./types').ProblemFilters,
    page: number = 0,
    size: number = 20,
): Promise<PaginatedProblemsResponse> {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            size: size.toString(),
        });

        // Add filter parameters if provided
        if (filters) {
            if (filters.search.trim()) {
                params.set('search', filters.search.trim());
            }

            filters.difficulty.forEach((d) => {
                params.append('difficulty', d);
            });

            filters.categoryIds.forEach((id) => {
                params.append('categoryIds', id.toString());
            });
        }

        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/problems?${params.toString()}`,
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch problems: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Handle Spring Boot Page response format
        return {
            content: data.content || [],
            totalElements: data.totalElements || data.page?.totalElements || 0,
            totalPages: data.totalPages || data.page?.totalPages || 0,
            size: data.size || data.page?.size || size,
            number: data.number || data.page?.number || page,
        };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(
                'Network error: Unable to connect to the server. Please check your connection.',
            );
        }
        throw error;
    }
}

// ============================================================================
// Competition Required Fields API Methods
// ============================================================================

/**
 * Get the status of required fields for a competition for the current user.
 *
 * @param competitionId - The ID of the competition
 * @returns {Promise<RequiredFieldsStatusResponse>} The status of required fields
 */
export async function getRequiredFieldsStatus(
    competitionId: number,
): Promise<import('./types').RequiredFieldsStatusResponse> {
    const response = await fetchApi(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${competitionId}/required-fields-status`,
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch required fields status: ${response.status} ${response.statusText}`,
        );
    }

    return await response.json();
}

/**
 * Update the required fields for a competition for the current user.
 *
 * @param competitionId - The ID of the competition
 * @param request - The fields to update
 */
export async function updateRequiredFields(
    competitionId: number,
    request: import('./types').RequiredFieldsUpdateRequest,
): Promise<void> {
    const response = await fetchApi(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${competitionId}/required-fields`,
        {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify(request),
        },
    );

    if (!response.ok) {
        throw new Error(
            `Failed to update required fields: ${response.status} ${response.statusText}`,
        );
    }
}

/**
 * Acknowledge that the user knows they need to select submissions for each problem.
 *
 * @param competitionId - The ID of the competition
 * @param password - The password for validation
 */
export async function acknowledgeSubmissionSelection(
    competitionId: number,
    password?: string,
): Promise<void> {
    const response = await fetchApi(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${competitionId}/acknowledge-submission-selection`,
        {
            method: 'POST',
            headers: password
                ? {
                      'content-type': 'application/json',
                  }
                : undefined,
            body: password
                ? JSON.stringify({
                      password,
                  })
                : undefined,
        },
    );

    if (!response.ok) {
        let publicErrorMessage: string | undefined;
        try {
            const errorData = await response.json();
            publicErrorMessage = errorData.publicErrorMessage;
        } catch {
            // response body is not JSON or doesn't have publicErrorMessage
        }
        throw new Error(
            publicErrorMessage ||
                `Failed to acknowledge submission selection: ${response.status} ${response.statusText}`,
        );
    }
}

/**
 * Fetch the basic competition data.
 *
 * @param competitionId - The ID of the competition
 * @returns {Promise<import('./types').BasicCompetitionUserResponse>} Basic competition data
 */
export async function getBasicCompetition(
    competitionId: number,
): Promise<import('./types').BasicCompetitionUserResponse> {
    const response = await fetchApi(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${competitionId}/basic`,
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch basic competition: ${response.status} ${response.statusText}`,
        );
    }

    return await response.json();
}

/**
 * Fetch the problems for a competition, which also refreshes the user's
 * missingRequiredFields and anticheatSessionNotOk status.
 *
 * @param competitionId - The ID of the competition
 * @returns {Promise<import('./types').CompetitionUserResponse>} Updated competition data
 */
export async function refreshCompetitionProblems(
    competitionId: number,
): Promise<import('./types').CompetitionUserResponse> {
    const response = await fetchApi(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${competitionId}/problems`,
    );

    if (!response.ok) {
        throw new Error(
            `Failed to refresh competition problems: ${response.status} ${response.statusText}`,
        );
    }

    return await response.json();
}

/**
 * Updates the participant's recording link for a competition.
 *
 * @param competitionId - The ID of the competition
 * @param recordingLink - The recording link to save
 */
export async function updateRecordingLink(
    competitionId: number,
    recordingLink: string,
): Promise<void> {
    const response = await fetchApi(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${competitionId}/recording-link`,
        {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({ recordingLink }),
        },
    );

    if (!response.ok) {
        throw new Error(
            `Failed to update recording link: ${response.status} ${response.statusText}`,
        );
    }
}

/**
 * Fetch a single problem by ID.
 *
 * @param problemId - The ID of the problem
 * @returns {Promise<import('./types').Problem>} The problem data
 */
export async function getProblem(problemId: number): Promise<import('./types').Problem> {
    const response = await fetchApi(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/problems/${encodeURIComponent(problemId)}`,
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch problem: ${response.status} ${response.statusText}`);
    }

    return await response.json();
}

export type AppealResponse = {
    id: number;
    competitionId: number;
    userId: string;
    problemId: number;
    problemTitle: string | null;
    explanation: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    adminResponse: string | null;
    createdAt: string;
    updatedAt: string | null;
};

export async function createAppeal(
    competitionId: number,
    problemId: number,
    explanation: string,
): Promise<AppealResponse> {
    const response = await fetchApi(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${competitionId}/appeals`,
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ problemId, explanation }),
        },
    );
    if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.publicErrorMessage || 'Failed to submit appeal');
    }
    return response.json();
}

export async function getMyAppeal(competitionId: number): Promise<AppealResponse | null> {
    const response = await fetchApi(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${competitionId}/appeals/mine`,
    );
    if (response.status === 204) return null;
    if (!response.ok) throw new Error('Failed to fetch appeal');
    return response.json();
}

export async function createAppeals(
    competitionId: number,
    appeals: { problemId: number; explanation: string }[],
): Promise<AppealResponse[]> {
    const results = await Promise.all(
        appeals.map((a) => createAppeal(competitionId, a.problemId, a.explanation)),
    );
    return results;
}

export async function getMyAppeals(competitionId: number): Promise<AppealResponse[]> {
    const response = await fetchApi(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${competitionId}/appeals/mine`,
    );
    if (response.status === 204) return [];
    if (!response.ok) throw new Error('Failed to fetch appeals');
    const data = await response.json();
    return Array.isArray(data) ? data : [data];
}
