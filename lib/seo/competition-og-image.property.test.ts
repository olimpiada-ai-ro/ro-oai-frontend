/**
 * Property-Based Tests for Competition OG Image URL Generation
 *
 * **Property 2: Competition OG Image URL Generation**
 * **Validates: Requirements 1.4**
 *
 * For any competition with name, status, and dates, the OG image URL generator SHALL produce a valid URL containing:
 * - The base URL of the OG image API endpoint
 * - URL-encoded competition name parameter
 * - Competition status parameter
 * - Start and end date parameters
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateCompetitionOgImageUrl } from './config';

/**
 * Arbitrary generator for competition name
 */
const arbitraryCompetitionName = (): fc.Arbitrary<string> => {
    return fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);
};

/**
 * Arbitrary generator for competition status
 */
const arbitraryStatus = (): fc.Arbitrary<string> => {
    return fc.constantFrom('UPCOMING', 'ACTIVE', 'ENDED');
};

/**
 * Arbitrary generator for date strings
 */
const arbitraryDateString = (): fc.Arbitrary<string> => {
    return fc
        .integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31
        .map((timestamp) => new Date(timestamp).toISOString());
};

describe('Competition OG Image URL Property Tests', () => {
    describe('Property 2: Competition OG Image URL Generation', () => {
        /**
         * **Feature: seo-gtm-social-sharing, Property 2: Competition OG Image URL Generation**
         * **Validates: Requirements 1.4**
         */
        it('should generate URL containing the OG image API endpoint', () => {
            fc.assert(
                fc.property(
                    arbitraryCompetitionName(),
                    arbitraryStatus(),
                    arbitraryDateString(),
                    arbitraryDateString(),
                    (name, status, startDate, endDate) => {
                        const url = generateCompetitionOgImageUrl(name, status, {
                            start: startDate,
                            end: endDate,
                        });

                        // URL should contain the OG image API endpoint
                        expect(url).toContain('/api/og');
                    },
                ),
                { numRuns: 100 },
            );
        });

        it('should generate URL with type=competition parameter', () => {
            fc.assert(
                fc.property(
                    arbitraryCompetitionName(),
                    arbitraryStatus(),
                    arbitraryDateString(),
                    arbitraryDateString(),
                    (name, status, startDate, endDate) => {
                        const url = generateCompetitionOgImageUrl(name, status, {
                            start: startDate,
                            end: endDate,
                        });

                        // URL should contain type=competition
                        expect(url).toContain('type=competition');
                    },
                ),
                { numRuns: 100 },
            );
        });

        it('should generate URL with URL-encoded competition name parameter', () => {
            fc.assert(
                fc.property(
                    arbitraryCompetitionName(),
                    arbitraryStatus(),
                    arbitraryDateString(),
                    arbitraryDateString(),
                    (name, status, startDate, endDate) => {
                        const url = generateCompetitionOgImageUrl(name, status, {
                            start: startDate,
                            end: endDate,
                        });

                        // URL should contain title parameter with encoded name
                        expect(url).toContain('title=');

                        // Parse the URL and verify the title parameter
                        const urlObj = new URL(url);
                        const titleParam = urlObj.searchParams.get('title');
                        expect(titleParam).toBe(
                            Array.from(name.normalize('NFC').trim().replace(/\s+/g, ' '))
                                .slice(0, 96)
                                .join(''),
                        );
                    },
                ),
                { numRuns: 100 },
            );
        });

        it('should generate URL with competition status parameter', () => {
            fc.assert(
                fc.property(
                    arbitraryCompetitionName(),
                    arbitraryStatus(),
                    arbitraryDateString(),
                    arbitraryDateString(),
                    (name, status, startDate, endDate) => {
                        const url = generateCompetitionOgImageUrl(name, status, {
                            start: startDate,
                            end: endDate,
                        });

                        // Parse the URL and verify the status parameter
                        const urlObj = new URL(url);
                        const statusParam = urlObj.searchParams.get('status');
                        expect(statusParam).toBe(status);
                    },
                ),
                { numRuns: 100 },
            );
        });

        it('should generate URL with start and end date parameters', () => {
            fc.assert(
                fc.property(
                    arbitraryCompetitionName(),
                    arbitraryStatus(),
                    arbitraryDateString(),
                    arbitraryDateString(),
                    (name, status, startDate, endDate) => {
                        const url = generateCompetitionOgImageUrl(name, status, {
                            start: startDate,
                            end: endDate,
                        });

                        // Parse the URL and verify the date parameters
                        const urlObj = new URL(url);
                        const startDateParam = urlObj.searchParams.get('startDate');
                        const endDateParam = urlObj.searchParams.get('endDate');

                        expect(startDateParam).toBe(startDate);
                        expect(endDateParam).toBe(endDate);
                    },
                ),
                { numRuns: 100 },
            );
        });

        it('should generate a valid URL that can be parsed', () => {
            fc.assert(
                fc.property(
                    arbitraryCompetitionName(),
                    arbitraryStatus(),
                    arbitraryDateString(),
                    arbitraryDateString(),
                    (name, status, startDate, endDate) => {
                        const url = generateCompetitionOgImageUrl(name, status, {
                            start: startDate,
                            end: endDate,
                        });

                        // URL should be parseable without throwing
                        expect(() => new URL(url)).not.toThrow();

                        // URL should have http or https protocol
                        const urlObj = new URL(url);
                        expect(['http:', 'https:']).toContain(urlObj.protocol);
                    },
                ),
                { numRuns: 100 },
            );
        });
    });
});
