/**
 * Property-Based Tests for SEO Title Length Validation
 *
 * **Property 11: SEO Title Length Validation**
 * **Validates: Requirements 7.1**
 *
 * Generated page titles stay concise, preserve their content, and include the
 * MLCompete brand no more than once.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock the i18n-server module before importing the function under test
vi.mock('@/lib/i18n-server', () => ({
    getMessages: vi.fn().mockResolvedValue({
        seo: {
            home: {
                title: 'MLCompete - Machine Learning Competition Platform',
                description:
                    'Evaluate your machine learning models and compete with others in exciting challenges. Join our community of data scientists and ML enthusiasts.',
            },
            problems: {
                title: 'Problems - MLCompete Platform',
                description:
                    'Explore and solve machine learning challenges. Test your models against real-world datasets.',
            },
            competitions: {
                title: 'Competitions - MLCompete Platform',
                description:
                    'Join machine learning competitions and test your skills against other data scientists.',
            },
            leaderboard: {
                title: 'Leaderboard - MLCompete Platform',
                description:
                    'See the top competitors in machine learning challenges. Track your ranking.',
            },
            achievements: {
                title: 'Achievements - MLCompete Platform',
                description:
                    'Earn achievements by solving problems and competing. Showcase your accomplishments.',
            },
        },
        hero: {
            title: 'MLCompete',
            subtitle: 'Machine learning competition platform',
        },
        problems: {
            title: 'Problems',
            subtitle: 'Explore and solve machine learning challenges',
            difficulty: 'Difficulty',
            author: 'Author',
        },
        navigation: {
            leaderboard: 'Leaderboard',
        },
        leaderboard: {
            description: 'View the top performers in machine learning competitions',
        },
        competitions: {
            title: 'Competitions',
            subtitle: 'Join machine learning competitions',
        },
        achievements: {
            pageTitle: 'Achievements',
            pageDescription: 'Earn achievements by solving problems',
        },
        auth: {
            signIn: 'Sign In',
            signInDescription: 'Sign in to access the platform',
        },
        settings: {
            title: 'Settings',
            description: 'Manage your account settings',
        },
        legal: {
            privacy: {
                metaTitle: 'Privacy Policy',
                metaDescription: 'Privacy policy and data protection',
            },
            terms: {
                metaTitle: 'Terms & Conditions',
                metaDescription: 'Terms and conditions for using the platform',
            },
        },
        institutions: {
            title: 'Institutions',
            description: 'Browse and join educational institutions',
        },
        counties: {
            title: 'Counties',
            description: 'Browse Romanian counties and their statistics',
        },
        rankings: {
            institutionRankings: 'Institution Rankings',
            institutionRankingsDescription: 'View institutions ranked by member count',
            countyRankings: 'County Rankings',
            countyRankingsDescription: 'View counties ranked by user count',
        },
        myRequests: {
            title: 'My Membership Requests',
            description: 'View and manage your institution membership requests',
        },
        roadmap: {
            title: 'Roadmap',
            description: 'What we are building next',
        },
        myQuestions: {
            title: 'My Questions',
            description: 'View and manage your questions',
        },
    }),
}));

// Import after mocking
import {
    generateHomeMetadata,
    generateLeaderboardMetadata,
    generateProblemsListMetadata,
    generateCompetitionsListMetadata,
    generateAchievementsMetadata,
    generateLoginMetadata,
    generateSettingsMetadata,
    generatePrivacyMetadata,
    generateTermsMetadata,
    generateInstitutionsMetadata,
    generateCountriesMetadata,
    generateCountiesMetadata,
    generateInstitutionRankingsMetadata,
    generateCountyRankingsMetadata,
    generateMyRequestsMetadata,
    generateRoadmapMetadata,
    generateMyQuestionsMetadata,
} from './page-metadata';
import { SEO_LIMITS } from './config';

/**
 * Arbitrary generator for Locale values
 */
const arbitraryLocale = (): fc.Arbitrary<string> => {
    return fc.constantFrom('en', 'ro');
};

describe('SEO Title Length Property Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Property 11: SEO Title Length Validation', () => {
        const generators = [
            ['home', generateHomeMetadata],
            ['leaderboard', generateLeaderboardMetadata],
            ['problems list', generateProblemsListMetadata],
            ['competitions list', generateCompetitionsListMetadata],
            ['achievements', generateAchievementsMetadata],
            ['login', generateLoginMetadata],
            ['settings', generateSettingsMetadata],
            ['privacy', generatePrivacyMetadata],
            ['terms', generateTermsMetadata],
            ['institutions', generateInstitutionsMetadata],
            ['countries', generateCountriesMetadata],
            ['counties', generateCountiesMetadata],
            ['institution rankings', generateInstitutionRankingsMetadata],
            ['county rankings', generateCountyRankingsMetadata],
            ['my requests', generateMyRequestsMetadata],
            ['roadmap', generateRoadmapMetadata],
            ['my questions', generateMyQuestionsMetadata],
        ] as const;

        it.each(generators)(
            'should generate a concise, singly branded %s page title',
            async (_page, generatePageMetadata) => {
                await fc.assert(
                    fc.asyncProperty(arbitraryLocale(), async (locale) => {
                        const metadata = await generatePageMetadata(locale);
                        const brandMatches = metadata.title.match(/MLCompete/giu) ?? [];

                        expect(metadata.title.trim().length).toBeGreaterThan(0);
                        expect(metadata.title.length).toBeLessThanOrEqual(SEO_LIMITS.title.max);
                        expect(brandMatches).toHaveLength(1);
                    }),
                    { numRuns: 10 },
                );
            },
        );
    });
});
