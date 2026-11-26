const MAX_RAW_CODE_POINTS = 512;

function segmentGraphemes(value: string): string[] {
    if (typeof Intl.Segmenter === 'function') {
        return Array.from(
            new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value),
            ({ segment }) => segment,
        );
    }

    return Array.from(value);
}

export function normalizeOgText(
    value: string | null | undefined,
    maxGraphemes: number,
    fallback = '',
): string {
    const boundedValue = Array.from(value ?? '')
        .slice(0, MAX_RAW_CODE_POINTS)
        .join('');
    const normalizedValue = boundedValue.normalize('NFC').trim().replace(/\s+/g, ' ');

    if (!normalizedValue) return fallback;

    const segments = segmentGraphemes(normalizedValue);
    if (segments.length <= maxGraphemes) return normalizedValue;

    const availableSegments = segments.slice(0, Math.max(1, maxGraphemes - 1));
    const availableText = availableSegments.join('').trimEnd();
    const lastWordBoundary = availableText.lastIndexOf(' ');
    const minimumUsefulBoundary = Math.floor(availableText.length * 0.65);
    const truncatedText =
        lastWordBoundary >= minimumUsefulBoundary
            ? availableText.slice(0, lastWordBoundary)
            : availableText;

    return `${truncatedText.trimEnd()}…`;
}

export function getRenderableOgText(
    value: string | null | undefined,
    maxGraphemes: number,
    fallback: string,
): string {
    const normalizedValue = normalizeOgText(value, maxGraphemes, fallback);

    // The ImageResponse fallback font cannot shape Arabic and Hebrew reliably.
    // Preserve the exact value in page metadata, while keeping image generation
    // deterministic until a broad local font is bundled.
    if (/[\u0590-\u08ff]/u.test(normalizedValue)) {
        const asciiFallback = normalizedValue
            .replace(/[^\x20-\x7e]/g, '')
            .replace(/^[-_.@\s]+|[-_.@\s]+$/g, '')
            .trim();
        return asciiFallback || fallback;
    }

    return normalizedValue;
}

export function normalizeCountryCode(countryCode: string | null | undefined): string | null {
    const normalizedCode = countryCode?.trim().toUpperCase() ?? '';
    return /^[A-Z]{2}$/.test(normalizedCode) ? normalizedCode : null;
}

export function getCountryFlagEmoji(countryCode: string): string {
    const codePoints = [...countryCode].map((character) => {
        return 0x1f1e6 + character.charCodeAt(0) - 65;
    });
    return String.fromCodePoint(...codePoints);
}

export function parsePositiveInteger(
    value: string | null,
    maximum = 1_000_000_000,
): number | undefined {
    if (!value) return undefined;
    const parsedValue = Number(value);
    return Number.isSafeInteger(parsedValue) && parsedValue > 0 && parsedValue <= maximum
        ? parsedValue
        : undefined;
}

export function parsePublicMetric(
    value: string | null,
    options: { integerOnly?: boolean; maximum?: number } = {},
): number | undefined {
    if (!value) return undefined;
    const maximum = options.maximum ?? 1_000_000_000;
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > maximum) {
        return undefined;
    }
    if (options.integerOnly && !Number.isInteger(parsedValue)) return undefined;
    return parsedValue;
}

export function normalizeIsoDate(value: string | null | undefined): string | null {
    if (!value) return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function formatOgDate(value: string): string {
    const normalizedDate = normalizeIsoDate(value);
    if (!normalizedDate) return 'Date to be announced';

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(normalizedDate));
}

export function formatOgMetric(value: number, maximumFractionDigits = 1): string {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits,
        notation: value >= 10000 ? 'compact' : 'standard',
    }).format(value);
}
