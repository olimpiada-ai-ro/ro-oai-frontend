import type { ProblemProposal } from '@/lib/problem-proposals';

export type CompetitionHostingRequestStatus =
    | 'DRAFT'
    | 'PENDING'
    | 'CHANGES_REQUESTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'CANCELLED';

export type HostedCompetitionLifecycle = 'UPCOMING' | 'ONGOING' | 'ENDED';
export type HostedCompetitionAccess = 'PRIVATE' | 'PUBLIC';
export type HostedCompetitionMode = 'CLASSIC' | 'CASUAL';
export type CompetitionHostingRequestMode = 'COMPETITION_ONLY' | 'WITH_PROBLEMS';

export type CompetitionHostingPermissions = {
    canEdit: boolean;
    canSubmit: boolean;
    canResubmit: boolean;
    canCancelReview: boolean;
    canDeleteDraft: boolean;
    canAddProblems: boolean;
};

export type CompetitionHostingRequest = {
    id: number;
    name: string;
    shortDescription: string;
    description: string;
    rules: string;
    startTime: string;
    endTime: string;
    requestMode: CompetitionHostingRequestMode;
    competitionType: HostedCompetitionMode;
    access: HostedCompetitionAccess;
    allowPublicQuestions: boolean;
    commentsEnabled: boolean;
    selectionLimit: number;
    status: CompetitionHostingRequestStatus;
    reviewerMessage: string | null;
    approvedCompetitionId: number | null;
    problemProposals: ProblemProposal[];
    permissions: CompetitionHostingPermissions;
    version: number;
    createdAt: string;
    updatedAt: string;
};

export type CompetitionHostingRequestInput = {
    name: string;
    shortDescription: string;
    description: string;
    rules: string;
    startTime: string;
    endTime: string;
    requestMode: CompetitionHostingRequestMode;
    competitionType: HostedCompetitionMode;
    access: HostedCompetitionAccess;
    allowPublicQuestions: boolean;
    commentsEnabled: boolean;
    selectionLimit: number;
    version?: number;
};

export type HostedCompetitionPermissions = {
    approvedHosting: boolean;
    canEditContent: boolean;
    canEditSchedule: boolean;
    canSubmitProblems: boolean;
    canManageParticipants: boolean;
    canInviteParticipants: boolean;
};

export type HostedCompetitionProblem = {
    id: number;
    proposalId: number | null;
    title: string;
    status: string;
    evaluationType: string | null;
    updatedAt: string | null;
};

export type HostedCompetition = {
    id: number;
    name: string;
    shortDescription: string;
    description: string;
    rules: string;
    startTime: string;
    endTime: string;
    competitionType: HostedCompetitionMode;
    access: HostedCompetitionAccess;
    lifecycle: HostedCompetitionLifecycle;
    allowPublicQuestions: boolean;
    commentsEnabled: boolean;
    selectionLimit: number;
    participantCount: number;
    pendingInvitationCount: number;
    problemCount: number;
    problems: HostedCompetitionProblem[];
    permissions: HostedCompetitionPermissions;
    version: number;
    createdAt: string | null;
    updatedAt: string | null;
};

export type HostedCompetitionInput = Pick<
    CompetitionHostingRequestInput,
    | 'name'
    | 'shortDescription'
    | 'description'
    | 'rules'
    | 'startTime'
    | 'endTime'
    | 'competitionType'
    | 'access'
    | 'allowPublicQuestions'
    | 'commentsEnabled'
    | 'selectionLimit'
> & { version: number };

export type HostedCompetitionParticipant = {
    id: number;
    username: string | null;
    displayName: string;
    sharePersonalDataWithOrganizer: boolean;
    consentedAt: string | null;
    decisionUpdatedAt: string | null;
    consentNoticeVersion: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    grade: string | null;
    institution: string | null;
    avatar: string | null;
    joinedAt: string | null;
    disabled: boolean;
    hasSubmissions: boolean;
    canRemove: boolean;
};

export type CompetitionParticipantInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export type CompetitionInvitationDeliveryStatus = 'QUEUED' | 'SENT' | 'FAILED';

export type CompetitionParticipantInvitation = {
    id: string;
    recipientType: 'PLATFORM_USER' | 'EMAIL';
    userId: string | null;
    username: string | null;
    displayName: string | null;
    email: string | null;
    maskedEmail: string | null;
    status: CompetitionParticipantInvitationStatus;
    expiresAt: string | null;
    createdAt: string | null;
    lastSentAt: string | null;
    deliveryStatus: CompetitionInvitationDeliveryStatus | null;
    deliveryAttemptedAt: string | null;
    deliveryAttemptCount: number;
    version: number;
    canResend: boolean;
    canRevoke: boolean;
};

export type CompetitionInviteeOption = {
    userId: string;
    username: string;
    displayName: string;
    avatar: string | null;
};

export type CompetitionInvitationPreview = {
    sharedLink?: boolean;
    requiredFields?: string[];
    validGrades?: string[];
    valid: boolean;
    thirdPartyHosted: boolean;
    status: string;
    maskedEmail: string | null;
    competition: { id: number; name: string } | null;
    organizerName: string | null;
    expiresAt: string | null;
    message: string | null;
    consentNoticeVersion: string | null;
};

export type CompetitionOrganizerDataConsent = {
    thirdPartyHosted: boolean;
    organizerDisplayName: string | null;
    noticeVersion: string | null;
    joined: boolean;
    sharePersonalDataWithOrganizer: boolean | null;
    consentedAt: string | null;
    decisionUpdatedAt: string | null;
};

export type CompetitionHostingPage<T> = {
    content: T[];
    page: {
        number: number;
        size: number;
        totalElements: number;
        totalPages: number;
    };
};
