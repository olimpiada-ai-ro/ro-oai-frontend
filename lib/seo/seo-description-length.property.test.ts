/**
 * Property-Based Tests for SEO Description Length Validation
 *
 * **Property 12: SEO Description Length Validation**
 * **Validates: Requirements 7.2**
 *
 * For any generated page description, the description length SHALL be between 120 and 160 characters
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock the i18n-server module before importing the function under test
vi.mock('@/lib/i18n-server', () => ({
    getMessages: vi.fn().mockResolvedValue({
        hero: {
            title: 'MLCompete',
            subtitle:
                'Machine learning competition platform for testing your ML models and competing with others on challenging problems.',
        },
        problems: {
            title: 'Problems',
            subtitle:
                'Explore and solve machine learning challenges. Test your models on real-world datasets and improve your skills.',
            difficulty: 'Difficulty',
            author: 'Author',
        },
        navigation: {
            leaderboard: 'Leaderboard',
        },
        leaderboard: {
            description:
                'View the top performers in machine learning competitions. See rankings, scores, and achievements of the best data scientists.',
        },
        competitions: {
            title: 'Competitions',
            subtitle:
                'Join machine learning competitions and test your skills against others. Compete for prizes and recognition.',
        },
        achievements: {
            pageTitle: 'Achievements',
            pageDescription:
                'Earn achievements by solving problems, competing in challenges, and engaging with the MLCompete platform community.',
        },
        auth: {
            signIn: 'Sign In',
            signInDescription:
                'Sign in to MLCompete to access competitions, track your progress, and compete with others on ML challenges.',
        },
        settings: {
            title: 'Settings',
            description:
                'Manage your account settings, profile information, and preferences on the MLCompete machine learning platform.',
        },
        legal: {
            privacy: {
                metaTitle: 'Privacy Policy',
                metaDescription:
                    'Privacy policy and personal data protection information for the MLCompete machine learning competition platform.',
            },
            terms: {
                metaTitle: 'Terms & Conditions',
                metaDescription:
                    'Terms and conditions for using the MLCompete machine learning competition platform. Read before participating.',
            },
        },
        institutions: {
            title: 'Institutions',
            description:
                'Browse and join educational institutions on MLCompete. Connect with schools and universities in your area.',
        },
        counties: {
            title: 'Counties',
            description:
                'Browse Romanian counties and their statistics on MLCompete. See regional performance and rankings.',
        },
        rankings: {
            institutionRankings: 'Institution Rankings',
            institutionRankingsDescription:
                'View institutions ranked by member count and performance. See the top schools and universities.',
            countyRankings: 'County Rankings',
            countyRankingsDescription:
                'View counties ranked by user count and performance. See regional competition statistics.',
        },
        myRequests: {
            title: 'My Membership Requests',
            description:
                'View and manage your institution membership requests on MLCompete. Track pending and approved applications.',
        },
        roadmap: {
            title: 'Roadmap',
            description:
                'What we are building next and our vision for the MLCompete platform. See upcoming features and improvements.',
        },
        myQuestions: {
            title: 'My Questions',
            description:
                'View and manage your questions about problems on MLCompete. Track responses and get help from the community.',
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

describe('SEO Description Length Property Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Property 12: SEO Description Length Validation', () => {
        /**
         * **Feature: seo-gtm-social-sharing, Property 12: SEO Description Length Validation**
         * **Validates: Requirements 7.2**
         */
        it('should generate home page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generateHomeMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });

        it('should generate leaderboard page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generateLeaderboardMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });

        it('should generate problems list page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generateProblemsListMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });

        it('should generate competitions list page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generateCompetitionsListMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });

        it('should generate achievements page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generateAchievementsMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });

        it('should generate login page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generateLoginMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });

        it('should generate settings page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generateSettingsMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });

        it('should generate privacy page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generatePrivacyMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });

        it('should generate terms page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generateTermsMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });

        it('should generate institutions page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generateInstitutionsMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });

        it('should generate counties page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generateCountiesMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });

        it('should generate countries page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generateCountriesMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });

        it('should generate institution rankings page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generateInstitutionRankingsMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });

        it('should generate county rankings page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generateCountyRankingsMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });

        it('should generate my requests page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generateMyRequestsMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });

        it('should generate roadmap page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generateRoadmapMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });

        it('should generate my questions page description within SEO limits (120-160 characters)', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryLocale(), async (locale) => {
                    const metadata = await generateMyQuestionsMetadata(locale);

                    expect(metadata.description).toBeDefined();
                    expect(metadata.description.length).toBeGreaterThanOrEqual(
                        SEO_LIMITS.description.min,
                    );
                    expect(metadata.description.length).toBeLessThanOrEqual(
                        SEO_LIMITS.description.max,
                    );
                }),
                { numRuns: 10 },
            );
        });
    });
});
