/**
 * Property-Based Tests for JSON-LD Validity and Sanitization
 *
 * **Property 9: JSON-LD Validity and Sanitization**
 * **Validates: Requirements 7.1, 7.4**
 *
 * For any generated schema, the output SHALL be valid JSON-LD with @context set to
 * "https://schema.org", @type set correctly, and all string values SHALL be sanitized
 * to prevent XSS attacks.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    validateStructuredData,
    sanitizeStructuredData,
    containsXSSVectors,
    serializeStructuredData,
    generateOrganizationSchema,
    generateWebSiteSchema,
    generateBreadcrumbSchema,
    generateQuizSchema,
    generateCompetitionSchema,
    generateArticleSchema,
    generateImageObjectSchema,
} from './structured-data';
import type { BreadcrumbItem } from './types';

/**
 * Arbitrary generator for XSS attack vectors
 */
const arbitraryXSSVector = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
        '<script>alert("xss")</script>',
        '<script src="evil.js"></script>',
        'javascript:alert(1)',
        'javascript: alert(1)',
        'JAVASCRIPT:alert(1)',
        'vbscript:msgbox(1)',
        '<img onerror="alert(1)" src="x">',
        '<div onclick="alert(1)">click</div>',
        '<body onload="alert(1)">',
        'data:text/html,<script>alert(1)</script>',
        '<script>document.cookie</script>',
        '"><script>alert(1)</script>',
        "'-alert(1)-'",
        '<svg onload="alert(1)">',
        'expression(alert(1))',
    );
};

/**
 * Arbitrary generator for safe strings
 */
const arbitrarySafeString = (): fc.Arbitrary<string> => {
    return fc.string({ minLength: 1, maxLength: 100 }).filter((s) => {
        // Filter out strings that look like XSS vectors
        return !containsXSSVectors(s) && s.trim().length > 0;
    });
};

/**
 * Arbitrary generator for valid schema types
 */
const arbitrarySchemaType = (): fc.Arbitrary<string> => {
    return fc.constantFrom(
        'Organization',
        'WebSite',
        'Article',
        'Event',
        'Quiz',
        'Person',
        'BreadcrumbList',
        'ImageObject',
    );
};

/**
 * Arbitrary generator for valid structured data objects
 */
const arbitraryValidSchema = (): fc.Arbitrary<object> => {
    return fc.record({
        '@context': fc.constant('https://schema.org'),
        '@type': arbitrarySchemaType(),
        name: arbitrarySafeString(),
    });
};

/**
 * Arbitrary generator for invalid structured data objects (missing @context or @type)
 */
const arbitraryInvalidSchema = (): fc.Arbitrary<object> => {
    return fc.oneof(
        // Missing @context
        fc.record({
            '@type': arbitrarySchemaType(),
            name: arbitrarySafeString(),
        }),
        // Missing @type
        fc.record({
            '@context': fc.constant('https://schema.org'),
            name: arbitrarySafeString(),
        }),
        // Wrong @context
        fc.record({
            '@context': fc.constant('https://example.com'),
            '@type': arbitrarySchemaType(),
            name: arbitrarySafeString(),
        }),
        // Empty @type
        fc.record({
            '@context': fc.constant('https://schema.org'),
            '@type': fc.constant(''),
            name: arbitrarySafeString(),
        }),
    );
};

/**
 * Arbitrary generator for schema with XSS vectors
 */
const arbitrarySchemaWithXSS = (): fc.Arbitrary<object> => {
    return fc.record({
        '@context': fc.constant('https://schema.org'),
        '@type': arbitrarySchemaType(),
        name: arbitraryXSSVector(),
        description: arbitraryXSSVector(),
        url: fc.oneof(fc.constant('javascript:alert(1)'), fc.constant('https://example.com')),
    });
};

describe('JSON-LD Validity and Sanitization Property Tests', () => {
    describe('Property 9: JSON-LD Validity and Sanitization', () => {
        /**
         * **Feature: schema-org-structured-data, Property 9: JSON-LD Validity and Sanitization**
         * **Validates: Requirements 7.1, 7.4**
         */

        it('should validate schemas with correct @context and @type', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryValidSchema(), async (schema) => {
                    // Requirement 7.1: Valid JSON-LD with @context and @type
                    expect(validateStructuredData(schema)).toBe(true);
                }),
                { numRuns: 100 },
            );
        });

        it('should reject schemas missing @context or @type', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryInvalidSchema(), async (schema) => {
                    // Invalid schemas should be rejected
                    expect(validateStructuredData(schema)).toBe(false);
                }),
                { numRuns: 100 },
            );
        });

        it('should sanitize XSS vectors from string values', async () => {
            await fc.assert(
                fc.asyncProperty(arbitrarySchemaWithXSS(), async (schema) => {
                    const sanitized = sanitizeStructuredData(schema);
                    const jsonString = JSON.stringify(sanitized);

                    // Requirement 7.4: Escape special characters correctly
                    // After sanitization, no XSS vectors should remain
                    expect(jsonString).not.toMatch(/<script/i);
                    expect(jsonString).not.toMatch(/javascript\s*:/i);
                    expect(jsonString).not.toMatch(/vbscript\s*:/i);
                    expect(jsonString).not.toMatch(/\bon\w+\s*=/i);
                    expect(jsonString).not.toMatch(/expression\s*\(/i);
                }),
                { numRuns: 100 },
            );
        });

        it('should preserve valid content after sanitization', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryValidSchema(), async (schema) => {
                    const sanitized = sanitizeStructuredData(schema);

                    // Valid schemas should remain valid after sanitization
                    expect(validateStructuredData(sanitized)).toBe(true);

                    // @context and @type should be preserved
                    expect((sanitized as Record<string, unknown>)['@context']).toBe(
                        'https://schema.org',
                    );
                    expect((sanitized as Record<string, unknown>)['@type']).toBeDefined();
                }),
                { numRuns: 100 },
            );
        });

        it('should produce valid JSON after sanitization', async () => {
            await fc.assert(
                fc.asyncProperty(arbitrarySchemaWithXSS(), async (schema) => {
                    const sanitized = sanitizeStructuredData(schema);

                    // Should be serializable to valid JSON
                    expect(() => JSON.stringify(sanitized)).not.toThrow();

                    // Should be parseable back
                    const jsonString = JSON.stringify(sanitized);
                    expect(() => JSON.parse(jsonString)).not.toThrow();
                }),
                { numRuns: 100 },
            );
        });

        it('should handle nested objects with XSS vectors', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryXSSVector(), async (xssVector) => {
                    const nestedSchema = {
                        '@context': 'https://schema.org',
                        '@type': 'Organization',
                        name: 'Test Org',
                        contactPoint: {
                            '@type': 'ContactPoint',
                            contactType: xssVector,
                            email: xssVector,
                        },
                        sameAs: [xssVector, 'https://example.com'],
                    };

                    const sanitized = sanitizeStructuredData(nestedSchema);
                    const jsonString = JSON.stringify(sanitized);

                    // No XSS vectors should remain in nested objects
                    expect(jsonString).not.toMatch(/<script/i);
                    expect(jsonString).not.toMatch(/javascript\s*:/i);
                    expect(jsonString).not.toMatch(/\bon\w+\s*=/i);
                }),
                { numRuns: 100 },
            );
        });

        it('should handle arrays with XSS vectors', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.array(arbitraryXSSVector(), { minLength: 1, maxLength: 5 }),
                    async (xssVectors) => {
                        const schemaWithArray = {
                            '@context': 'https://schema.org',
                            '@type': 'Organization',
                            name: 'Test',
                            sameAs: xssVectors,
                        };

                        const sanitized = sanitizeStructuredData(schemaWithArray);
                        const jsonString = JSON.stringify(sanitized);

                        // No XSS vectors should remain in arrays
                        expect(jsonString).not.toMatch(/<script/i);
                        expect(jsonString).not.toMatch(/javascript\s*:/i);
                    },
                ),
                { numRuns: 100 },
            );
        });

        it('should serialize valid schemas without throwing', async () => {
            await fc.assert(
                fc.asyncProperty(arbitraryValidSchema(), async (schema) => {
                    // serializeStructuredData should not throw for valid schemas
                    expect(() => serializeStructuredData(schema)).not.toThrow();

                    const serialized = serializeStructuredData(schema);
                    expect(typeof serialized).toBe('string');
                    expect(serialized.length).toBeGreaterThan(0);
                }),
                { numRuns: 100 },
            );
        });

        it('should escape </script> sequences in serialized output', async () => {
            // Note: The sanitization step removes </script> entirely for security
            // The serializeStructuredData function also escapes any remaining </script>
            // sequences that might slip through
            const schemaWithScriptClose = {
                '@context': 'https://schema.org',
                '@type': 'Article',
                name: 'Test </script> Article',
                description: 'Contains </script> tag',
            };

            const serialized = serializeStructuredData(schemaWithScriptClose);

            // After sanitization and serialization, no </script> should remain
            // (either removed by sanitization or escaped by serialization)
            expect(serialized).not.toContain('</script>');

            // The output should still be valid JSON
            expect(() => JSON.parse(serialized)).not.toThrow();

            // The schema structure should be preserved
            const parsed = JSON.parse(serialized);
            expect(parsed['@context']).toBe('https://schema.org');
            expect(parsed['@type']).toBe('Article');
        });

        it('keeps HTML-valid script closing variants inert', () => {
            const schema = {
                '@context': 'https://schema.org',
                '@type': 'Article',
                name: '</script ><base href=https://evil.example/><p id=owned>owned',
            };

            const serialized = serializeStructuredData(schema);

            expect(serialized).not.toContain('<');
            expect(serialized).toContain('\\u003c/script >');
            expect(JSON.parse(serialized).name).toContain('</script >');
        });

        it('sanitizes large unmatched script prefixes in linear time', () => {
            const schema = {
                '@context': 'https://schema.org',
                '@type': 'Person',
                description: '<script '.repeat(12_500),
            };
            const startedAt = performance.now();

            const serialized = serializeStructuredData(schema);

            expect(performance.now() - startedAt).toBeLessThan(1_000);
            expect(serialized).not.toMatch(/<script/i);
            expect(() => JSON.parse(serialized)).not.toThrow();
        });
    });

    describe('Integration with Schema Generators', () => {
        /**
         * Test that all schema generators produce valid and sanitizable output
         */

        it('should validate all generated Organization schemas', async () => {
            await fc.assert(
                fc.asyncProperty(fc.constantFrom('en', 'ro'), async (locale) => {
                    const schema = generateOrganizationSchema(locale);
                    expect(validateStructuredData(schema)).toBe(true);

                    const sanitized = sanitizeStructuredData(schema);
                    expect(validateStructuredData(sanitized)).toBe(true);
                }),
                { numRuns: 100 },
            );
        });

        it('should validate all generated WebSite schemas', async () => {
            await fc.assert(
                fc.asyncProperty(fc.constantFrom('en', 'ro'), async (locale) => {
                    const schema = generateWebSiteSchema(locale);
                    expect(validateStructuredData(schema)).toBe(true);

                    const sanitized = sanitizeStructuredData(schema);
                    expect(validateStructuredData(sanitized)).toBe(true);
                }),
                { numRuns: 100 },
            );
        });

        it('should validate all generated Breadcrumb schemas', async () => {
            const arbitraryBreadcrumbItems = fc.array(
                fc.record({
                    name: arbitrarySafeString(),
                    url: fc.webUrl(),
                }),
                { minLength: 1, maxLength: 5 },
            );

            await fc.assert(
                fc.asyncProperty(arbitraryBreadcrumbItems, async (items) => {
                    const schema = generateBreadcrumbSchema(items as BreadcrumbItem[]);
                    expect(validateStructuredData(schema)).toBe(true);

                    const sanitized = sanitizeStructuredData(schema);
                    expect(validateStructuredData(sanitized)).toBe(true);
                }),
                { numRuns: 100 },
            );
        }, 30000);

        it('should validate all generated ImageObject schemas', async () => {
            await fc.assert(
                fc.asyncProperty(fc.webUrl(), async (imageUrl) => {
                    const schema = generateImageObjectSchema(imageUrl);
                    expect(validateStructuredData(schema)).toBe(true);

                    const sanitized = sanitizeStructuredData(schema);
                    expect(validateStructuredData(sanitized)).toBe(true);
                }),
                { numRuns: 100 },
            );
        });
    });
});
