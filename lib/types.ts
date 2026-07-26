export type Page<T> = {
    content: T[];
    page: {
        totalPages: number;
        totalElements: number;
        size: number;
        number: number;
    };
};

// Category System Types
/**
 * Category for problem classification
 * Used for filtering and organizing problems by topic
 */
export type Category = {
    id: number;
    name: string;
    description: string | null;
    problemCount: number;
};

/**
 * Difficulty levels for problems
 */
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

/**
 * Attempted status filter options
 */
export type AttemptedStatus = 'attempted' | 'unattempted' | null;

/**
 * Filter state for problems page
 * Used for search, difficulty, category, competition, and attempted status filtering
 */
export type ProblemFilters = {
    search: string;
    difficulty: Difficulty[];
    categoryIds: number[];
    competitionIds: number[];
    attemptedStatus: AttemptedStatus;
};

/**
 * Competition option for filter dropdown
 */
export type CompetitionFilterOption = {
    id: number;
    name: string;
    nameEn?: string | null;
    nameDe?: string | null;
    nameBg?: string | null;
    nameSr?: string | null;
    nameUk?: string | null;
    nameHu?: string | null;
    problemCount: number;
};

/**
 * Public attribution snapshot for a problem author.
 *
 * Names are stored with the problem so attribution remains stable even when a
 * linked account later changes its profile. `userId` is null for authors who
 * do not have a platform account.
 */
export type ProblemAuthor = {
    userId: string | null;
    firstName: string | null;
    lastName: string | null;
    displayName: string;
    username?: string | null;
    avatar?: string | null;
    displayOrder?: number;
};

/**
 * Public preview artwork attached to a problem.
 *
 * Generated artwork is exposed through a relative backend path, while uploaded
 * artwork may use an absolute object-storage URL.
 */
export type ProblemPreviewImage = {
    url: string;
    source: 'GENERATED' | 'UPLOADED';
    automatic: boolean;
    contentType: string;
    width: number;
    height: number;
};

export type Problem = {
    id: number;
    title: string;
    shortDescription: string;
    longDescription?: string;
    difficulty: Difficulty;
    /** Legacy single-author label retained during the structured-author rollout. */
    author: string;
    authors?: ProblemAuthor[];
    previewImage?: ProblemPreviewImage | null;
    lastAttemptedScore: number | null;
    topScore?: number;
    partialTopScore: number;
    datasetUrl?: string;
    inputFormat?: string;
    outputFormat?: string;
    subtasks: null | { metricName: string; subtaskName: string }[];
    selectionLimit?: number;
    competitionId?: number;
    competitionName?: string;
    competitionType?: CompetitionType;
    isInOngoingCompetition: boolean;
    competitionStartTime?: string;
    competitionEndTime?: string;
    maxSubmissionsPerCompetition?: number;
    selectedSubmissionIds: number[];
    metricPreference: 'SMALLER_IS_BETTER' | 'BIGGER_IS_BETTER' | 'FASTER_SUBMISSION_IS_BETTER';
    // Categories for filtering (optional for backward compatibility)
    categories?: Category[];
    // English translation fields (optional)
    titleEn?: string | null;
    shortDescriptionEn?: string | null;
    longDescriptionEn?: string | null;
    // German translation fields (optional)
    titleDe?: string | null;
    shortDescriptionDe?: string | null;
    longDescriptionDe?: string | null;
    // Bulgarian translation fields (optional)
    titleBg?: string | null;
    shortDescriptionBg?: string | null;
    longDescriptionBg?: string | null;
    // Serbian translation fields (optional)
    titleSr?: string | null;
    shortDescriptionSr?: string | null;
    longDescriptionSr?: string | null;
    // Ukrainian translation fields (optional)
    titleUk?: string | null;
    shortDescriptionUk?: string | null;
    longDescriptionUk?: string | null;
    // Hungarian translation fields (optional)
    titleHu?: string | null;
    shortDescriptionHu?: string | null;
    longDescriptionHu?: string | null;
};

export type RawSubmission = {
    id: number;
    submittedAt: string;
    score: number | null;
    finalScore: number | null;
    metric: number | null;
    finalMetric: number | null;
    status: 'PROCESSING' | 'EVALUATED' | 'ERROR';
    evaluationMessage: string;
    signedFileUrl: string;
    signedSourceFileUrl: string | null;
    problemId: number;
    problemTitle: string;
    stdout: string | null;
    stderr: string | null;
    subtasks:
        | null
        | {
              score: number;
              metric: number;
              finalScore: number | null;
              finalMetric: number | null;
          }[];
    subtasksNames:
        | null
        | {
              metricName: number;
              subtaskName: number;
          }[];
};

export type Submission = {
    id: number;
    submittedAt: Date;
    score: number | null;
    finalScore: number | null;
    metric: number | null;
    finalMetric: number | null;
    status: 'PROCESSING' | 'EVALUATED' | 'ERROR';
    evaluationMessage: string;
    signedFileUrl: string;
    signedSourceFileUrl: string | null;
    problemId: number;
    problemTitle: string;
    stdout: string | null;
    stderr: string | null;
    subtasks:
        | null
        | {
              score: number;
              metric: number;
              finalScore: number | null;
              finalMetric: number | null;
          }[];
    subtasksNames:
        | null
        | {
              metricName: number;
              subtaskName: number;
          }[];
};

export type SubmissionNotification = Submission & { dismissed: boolean; timestamp: Date };

export type SimpleLeaderboardEntry = {
    rank: number;
    awardRank?: number;
    userId: string;
    username: string;
    score: number;
    metric?: number;
    attainedAt?: string;
    avatar?: string | null;
    problemScores?: Record<number, number>;
    country?: Country; // Inherited from institution
};

export type GenericLeaderboardEntry = {
    rank: number;
    userId: string;
    username: string;
    avatarInitials?: string | null;
    totalScore: number;
    metric?: number;
    attainedAt?: string;
    solvedCount?: number;
    averageScore?: number;
    awardRank?: number;
    avatar?: string | null;
    problemScores?: Record<number, number>;
    country?: Country; // Inherited from institution
    level?: number; // User's level (1-50)
    tier?: string; // User's level tier (NOVICE, APPRENTICE, EXPERT, MASTER, LEGEND)
};

export type CompetitionType = 'CLASSIC' | 'CASUAL';

export type CompetitionUserListResponse = {
    id: number;
    name: string;
    startTime: string;
    endTime: string;
    competitionType: CompetitionType;
    joined: boolean;
    shortDescription: string;
    highlighted: boolean;
    antiCheatEnabled?: boolean;
    parentCompetitionId?: number | null;
    disabled?: boolean;
    disqualified?: boolean;
    // English translation fields (optional)
    nameEn?: string | null;
    shortDescriptionEn?: string | null;
    // German translation fields (optional)
    nameDe?: string | null;
    shortDescriptionDe?: string | null;
    // Bulgarian translation fields (optional)
    nameBg?: string | null;
    shortDescriptionBg?: string | null;
    // Serbian translation fields (optional)
    nameSr?: string | null;
    shortDescriptionSr?: string | null;
    // Ukrainian translation fields (optional)
    nameUk?: string | null;
    shortDescriptionUk?: string | null;
    // Hungarian translation fields (optional)
    nameHu?: string | null;
    shortDescriptionHu?: string | null;
};

export type CompetitionUserResponse = {
    id: number;
    name: string;
    startTime: string;
    endTime: string;
    competitionType: CompetitionType;
    joined: boolean;
    problems: Problem[];
    rules: string;
    description: string;
    hasEditorial?: boolean;
    showAwardRank: boolean;
    showFinalLeaderboard?: boolean;
    shortDescription?: string;
    antiCheatEnabled?: boolean;
    antiCheatHeartbeatTimeout?: number;
    antiCheatHeartbeatGracePeriod?: number;
    dnsBlockingEnabled?: boolean;
    sebRequired?: boolean;
    missingRequiredFields?: boolean;
    anticheatSessionNotOk?: boolean;
    sessionNotOk?: boolean;
    requiredRecordingLink?: boolean;
    recordingLink?: string;
    disabled?: boolean;
    // Disqualification fields
    disqualified?: boolean;
    disqualificationReason?: string | null;
    disqualifiedAt?: string | null;
    requiredFields?: string[];
    submissionSelectionNotAcknowledged: boolean;
    submissionSelectionRequiredCount: number;
    diplomaUrl?: string | null;
    validationRequired?: boolean;
    // English translation fields (optional)
    nameEn?: string | null;
    shortDescriptionEn?: string | null;
    descriptionEn?: string | null;
    rulesEn?: string | null;
    // German translation fields (optional)
    nameDe?: string | null;
    shortDescriptionDe?: string | null;
    descriptionDe?: string | null;
    rulesDe?: string | null;
    // Bulgarian translation fields (optional)
    nameBg?: string | null;
    shortDescriptionBg?: string | null;
    descriptionBg?: string | null;
    rulesBg?: string | null;
    // Serbian translation fields (optional)
    nameSr?: string | null;
    shortDescriptionSr?: string | null;
    descriptionSr?: string | null;
    rulesSr?: string | null;
    // Ukrainian translation fields (optional)
    nameUk?: string | null;
    shortDescriptionUk?: string | null;
    descriptionUk?: string | null;
    rulesUk?: string | null;
    // Hungarian translation fields (optional)
    nameHu?: string | null;
    shortDescriptionHu?: string | null;
    descriptionHu?: string | null;
    rulesHu?: string | null;
    appealDeadline?: string | null;
    hasAppeal?: boolean;
};

export type BasicCompetitionUserResponse = {
    id: number;
    name: string;
    isPrivate: boolean;
    antiCheatEnabled: boolean;
    dnsBlockingEnabled?: boolean;
    sebRequired?: boolean;
    requiredFields?: string[];
    validGrades?: string[];
    hasInstitution: boolean;
    validationRequired?: boolean;
    joined: boolean;
};

export type NotificationType =
    | 'MEMBERSHIP_APPROVED'
    | 'MEMBERSHIP_DECLINED'
    | 'INSTITUTION_UNASSIGNED'
    | 'NEW_ACHIEVEMENT'
    | 'NEW_MODERATION';

export type Notification = {
    id: number;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    relatedEntityType: string | null;
    relatedEntityId: number | null;
    isRead: boolean;
    createdAt: string;
    readAt: string | null;
};

export type UserProfile = {
    userId: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    joinedAt: Date;
    avatar: string | null;
    bio: string | null;
    location: string | null;
    website: string | null;
    github: string | null;
    totalScore: number;
    problemsSolved: number;
    averageScore: number;
    rank: number;
    leaderboardPlaced: boolean;
    institution?: Institution;
    institutionJoinedAt?: Date;
    onboardingDismissed?: boolean;
    country?: Country; // Inherited from institution
};

export type UserProfileSettingsResponse = {
    userId: string;
    avatar?: string | null;
    username: string;
    firstName?: string;
    lastName?: string;
    email: string;
    location?: string;
    website?: string;
    github?: string;
    bio?: string;
    countryCode?: string | null; // User-selected country code
    institutionCountryCode?: string | null; // Institution's country code (read-only)
    isPublic: boolean;
    visibleInLeaderboards: boolean;
    publicSubmissionHistory: boolean;
    emailPublic: boolean;
    namePublic: boolean;
    language?: string;
    consentGeneralAnouncements?: boolean;
    consentOlympiadAnouncements?: boolean;
};

export type UserProfileSettingsUpdateRequest = {
    avatar?: string | null;
    username?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    location?: string;
    website?: string;
    github?: string;
    bio?: string;
    countryCode?: string | null | undefined; // User can set/clear their country
    isPublic?: boolean;
    visibleInLeaderboards?: boolean;
    publicSubmissionHistory?: boolean;
    emailPublic?: boolean;
    namePublic?: boolean;
    consentGeneralAnouncements?: boolean;
    consentOlympiadAnouncements?: boolean;
};

// Comment System Types
export type Comment = {
    id: number;
    problemId: number;
    userId: string;
    username: string;
    avatar?: string | null; // User's avatar URL
    content: string;
    isPublic: boolean;
    isAnswer: boolean;
    answeredBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    problemTitle?: string; // Optional: included when fetching user's comments
    level?: number; // User's level (1-50)
    tier?: string; // User's level tier
};

export type CommentThread = {
    question: Comment;
    answer: Comment | null;
    isPublic: boolean;
};

export type CommentStatus = 'answered' | 'unanswered' | 'all';

export type CreateCommentRequest = {
    content: string;
};

export type AnswerCommentRequest = {
    content: string;
    makePublic: boolean;
};

export type UpdateVisibilityRequest = {
    isPublic: boolean;
};

export type UnreadCountResponse = {
    count: number;
};

export type CommentFilter = {
    problemId?: number;
    competitionId?: number;
    status?: 'answered' | 'pending';
    visibility?: 'public' | 'private';
    searchQuery?: string;
};

export type CommentStatsResponse = {
    totalPending: number;
    answeredToday: number;
    averageResponseTime: number; // in hours
    pendingByProblem: Record<number, number>; // Map of problem ID to pending count
};

export type PaginatedCommentsResponse = {
    content: Comment[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
};

// Institution and County Management Types
export type InstitutionType = 'GIMNAZIU' | 'LICEU' | 'FACULTATE';

export type County = {
    id: number;
    name: string;
    code: string;
};

export type Country = {
    code: string;
    name: string;
    nameRo?: string;
    flagEmoji: string;
};

export type CountryStatistics = {
    totalUsers: number;
    totalInstitutions: number;
    usersByType: Record<InstitutionType, number>;
    institutionsByType: Record<InstitutionType, number>;
    topInstitutions: Institution[];
};

export type CountryOverview = {
    country: Country;
    statistics: CountryStatistics;
    hasCountyBreakdown: boolean;
};

export type CountryRanking = {
    rank: number;
    countryCode: string;
    countryName: string;
    flagEmoji: string;
    totalParticipants: number;
    totalScore: number;
    institutionCount: number;
};

export type CountyStatistics = {
    totalUsers: number;
    totalInstitutions: number;
    usersByType: Record<InstitutionType, number>;
    institutionsByType: Record<InstitutionType, number>;
    topInstitutions: Institution[];
};

export type CountyResponse = County & {
    statistics?: CountyStatistics;
};

export type Institution = {
    id: number;
    name: string;
    type: InstitutionType;
    county: County;
    country: Country;
    address?: string;
    description?: string;
    website?: string;
    memberCount: number;
    autoApproveRequests?: boolean;
    createdAt: Date;
};

export type InstitutionResponse = Institution & {
    moderators?: ModeratorResponse[];
};

export type ModeratorResponse = {
    userId: string;
    username: string;
    assignedAt: Date;
};

export type RequestStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED';

export type MembershipRequest = {
    id: number;
    userId: string;
    userName: string;
    institution: InstitutionResponse;
    status: RequestStatus;
    requestedAt: Date;
    processedAt?: Date;
    processedBy?: string;
    notes?: string;
};

export type InstitutionRanking = {
    rank: number;
    institution: Institution;
    memberCount: number;
    totalScore: number;
    averageScore?: number;
};

export type CountyRanking = {
    rank: number;
    county: County;
    totalUsers: number;
    institutionCount: number;
    averageUsersPerInstitution: number;
};

export type PaginatedInstitutionsResponse = {
    content: Institution[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
};

export type PaginatedMembershipRequestsResponse = {
    content: MembershipRequest[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
};

// i18n Types
export type Locale =
    // Existing locales
    | 'en'
    | 'ro'
    | 'de'
    | 'bg'
    | 'sr'
    | 'uk'
    | 'hu'
    // New locales
    | 'ru'
    | 'kk'
    | 'ka'
    | 'fr'
    | 'nl'
    | 'et'
    | 'fi'
    | 'sv'
    | 'lv'
    | 'lt'
    | 'hr'
    | 'sk'
    | 'sl'
    | 'cs'
    | 'da'
    | 'it'
    | 'es'
    | 'pt'
    | 'pl'
    | 'no'
    // Additional new locales (zh-CN, ar, he)
    | 'zh-CN'
    | 'ar'
    | 'he';

export interface LocaleConfig {
    code: Locale;
    name: string;
    nativeName: string;
    flag: string;
    direction: 'ltr' | 'rtl';
}

export const LOCALES: Record<Locale, LocaleConfig> = {
    // Existing locales
    en: {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        flag: '🇬🇧',
        direction: 'ltr',
    },
    ro: {
        code: 'ro',
        name: 'Romanian',
        nativeName: 'Română',
        flag: '🇷🇴',
        direction: 'ltr',
    },
    de: {
        code: 'de',
        name: 'German',
        nativeName: 'Deutsch',
        flag: '🇩🇪',
        direction: 'ltr',
    },
    bg: {
        code: 'bg',
        name: 'Bulgarian',
        nativeName: 'Български',
        flag: '🇧🇬',
        direction: 'ltr',
    },
    sr: {
        code: 'sr',
        name: 'Serbian',
        nativeName: 'Српски',
        flag: '🇷🇸',
        direction: 'ltr',
    },
    uk: {
        code: 'uk',
        name: 'Ukrainian',
        nativeName: 'Українська',
        flag: '🇺🇦',
        direction: 'ltr',
    },
    hu: {
        code: 'hu',
        name: 'Hungarian',
        nativeName: 'Magyar',
        flag: '🇭🇺',
        direction: 'ltr',
    },
    // New locales
    ru: {
        code: 'ru',
        name: 'Russian',
        nativeName: 'Русский',
        flag: '🇷🇺',
        direction: 'ltr',
    },
    kk: {
        code: 'kk',
        name: 'Kazakh',
        nativeName: 'Қазақша',
        flag: '🇰🇿',
        direction: 'ltr',
    },
    ka: {
        code: 'ka',
        name: 'Georgian',
        nativeName: 'ქართული',
        flag: '🇬🇪',
        direction: 'ltr',
    },
    fr: {
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        flag: '🇫🇷',
        direction: 'ltr',
    },
    nl: {
        code: 'nl',
        name: 'Dutch',
        nativeName: 'Nederlands',
        flag: '🇳🇱',
        direction: 'ltr',
    },
    et: {
        code: 'et',
        name: 'Estonian',
        nativeName: 'Eesti',
        flag: '🇪🇪',
        direction: 'ltr',
    },
    fi: {
        code: 'fi',
        name: 'Finnish',
        nativeName: 'Suomi',
        flag: '🇫🇮',
        direction: 'ltr',
    },
    sv: {
        code: 'sv',
        name: 'Swedish',
        nativeName: 'Svenska',
        flag: '🇸🇪',
        direction: 'ltr',
    },
    lv: {
        code: 'lv',
        name: 'Latvian',
        nativeName: 'Latviešu',
        flag: '🇱🇻',
        direction: 'ltr',
    },
    lt: {
        code: 'lt',
        name: 'Lithuanian',
        nativeName: 'Lietuvių',
        flag: '🇱🇹',
        direction: 'ltr',
    },
    hr: {
        code: 'hr',
        name: 'Croatian',
        nativeName: 'Hrvatski',
        flag: '🇭🇷',
        direction: 'ltr',
    },
    sk: {
        code: 'sk',
        name: 'Slovak',
        nativeName: 'Slovenčina',
        flag: '🇸🇰',
        direction: 'ltr',
    },
    sl: {
        code: 'sl',
        name: 'Slovenian',
        nativeName: 'Slovenščina',
        flag: '🇸🇮',
        direction: 'ltr',
    },
    cs: {
        code: 'cs',
        name: 'Czech',
        nativeName: 'Čeština',
        flag: '🇨🇿',
        direction: 'ltr',
    },
    da: {
        code: 'da',
        name: 'Danish',
        nativeName: 'Dansk',
        flag: '🇩🇰',
        direction: 'ltr',
    },
    it: {
        code: 'it',
        name: 'Italian',
        nativeName: 'Italiano',
        flag: '🇮🇹',
        direction: 'ltr',
    },
    es: {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        flag: '🇪🇸',
        direction: 'ltr',
    },
    pt: {
        code: 'pt',
        name: 'Portuguese',
        nativeName: 'Português',
        flag: '🇵🇹',
        direction: 'ltr',
    },
    pl: {
        code: 'pl',
        name: 'Polish',
        nativeName: 'Polski',
        flag: '🇵🇱',
        direction: 'ltr',
    },
    no: {
        code: 'no',
        name: 'Norwegian',
        nativeName: 'Norsk',
        flag: '🇳🇴',
        direction: 'ltr',
    },
    // Additional new locales (zh-CN, ar, he)
    'zh-CN': {
        code: 'zh-CN',
        name: 'Chinese (Simplified)',
        nativeName: '中文',
        flag: '🇨🇳',
        direction: 'ltr',
    },
    ar: {
        code: 'ar',
        name: 'Arabic',
        nativeName: 'العربية',
        flag: '🇸🇦',
        direction: 'rtl',
    },
    he: {
        code: 'he',
        name: 'Hebrew',
        nativeName: 'עברית',
        flag: '🇮🇱',
        direction: 'rtl',
    },
};

export const DEFAULT_LOCALE: Locale = 'ro';

export const SUPPORTED_LOCALES: Locale[] = [
    // Romanian is always first (default language)
    'ro',
    'en',
    'de',
    'bg',
    'sr',
    'uk',
    'hu',
    // New
    'ru',
    'kk',
    'ka',
    'fr',
    'nl',
    'et',
    'fi',
    'sv',
    'lv',
    'lt',
    'hr',
    'sk',
    'sl',
    'cs',
    'da',
    'it',
    'es',
    'pt',
    'pl',
    'no',
    // Additional new locales
    'zh-CN',
    'ar',
    'he',
];

export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
    en: 'English',
    ro: 'Română',
    de: 'Deutsch',
    bg: 'Български',
    sr: 'Српски',
    uk: 'Українська',
    hu: 'Magyar',
    ru: 'Русский',
    kk: 'Қазақша',
    ka: 'ქართული',
    fr: 'Français',
    nl: 'Nederlands',
    et: 'Eesti',
    fi: 'Suomi',
    sv: 'Svenska',
    lv: 'Latviešu',
    lt: 'Lietuvių',
    hr: 'Hrvatski',
    sk: 'Slovenčina',
    sl: 'Slovenščina',
    cs: 'Čeština',
    da: 'Dansk',
    it: 'Italiano',
    es: 'Español',
    pt: 'Português',
    pl: 'Polski',
    no: 'Norsk',
    'zh-CN': '中文',
    ar: 'العربية',
    he: 'עברית',
};

export const RTL_LOCALES: Locale[] = ['ar', 'he'];

// Editorial Types
export type SourceFileResponse = {
    id: number;
    fileName: string;
    fileLabel: string;
    language: string;
    downloadUrl: string;
};

export type EditorialAuthorResponse = {
    id: number;
    userId: string;
    username: string;
    avatar?: string | null;
    competitionRank?: number;
    role: string;
    hasSourceCode: boolean;
};

export type FeaturedSolutionResponse = {
    id: number;
    userId: string;
    username: string;
    avatar?: string | null;
    competitionRank?: number;
    description: string;
    sourceFiles: SourceFileResponse[];
};

export type EditorialResponse = {
    competitionId: number;
    competitionName: string;
    content: string;
    authors: EditorialAuthorResponse[];
    featuredSolutions: FeaturedSolutionResponse[];
    updatedAt: string;
};

export type EditorialContribution = {
    competitionId: number;
    competitionName: string;
    competitionEndDate: string;
    competitionRank?: number;
    role: string;
    hasSourceCode: boolean;
    editorialUrl: string;
};

// Achievement System Types
export type AchievementRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export type AchievementCategory =
    | 'PROBLEM_SOLVING'
    | 'COMPETITION'
    | 'ENGAGEMENT'
    | 'SOCIAL'
    | 'SPECIAL';

export type Achievement = {
    id: number;
    code: string;
    name: string;
    description: string;
    iconUrl?: string;
    category: AchievementCategory;
    rarity: AchievementRarity;
    xpReward: number;
    targetValue: number;
    isSecret: boolean;
    unlockedPercentage: number;
    isActive?: boolean;
};

export type UserAchievement = {
    id: number;
    achievement: Achievement;
    unlockedAt: Date;
    isShowcased: boolean;
    showcaseOrder?: number;
};

export type AchievementProgress = {
    achievementId: number;
    achievement: Achievement;
    currentValue: number;
    targetValue: number;
    percentComplete: number;
    lastUpdated: Date;
};

export type AchievementStats = {
    totalEarned: number;
    totalAvailable: number;
    completionPercentage: number;
    totalXp: number;
    byCategory: Record<AchievementCategory, number>;
    byRarity: Record<AchievementRarity, number>;
    currentStreak: number;
    longestStreak: number;
};

export type AchievementLeaderboardEntry = {
    rank: number;
    userId: string;
    username: string;
    avatarUrl?: string | null;
    totalAchievements: number;
    totalXp: number;
    level?: number;
    tier?: string;
};

export type PaginatedAchievementLeaderboardResponse = {
    content: AchievementLeaderboardEntry[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
};

// Competition Required Fields Types
export type RequiredFieldsUpdateRequest = {
    firstName?: string;
    lastName?: string;
    grade?: string;
    phone?: string;
    coordinatorTeacher?: string;
    schoolTeacher?: string;
};

export type RequiredFieldsStatusResponse = {
    allCompleted: boolean;
    missingFields: string[];
    validGrades?: string[];
    completedFields: RequiredFieldsUpdateRequest;
};
