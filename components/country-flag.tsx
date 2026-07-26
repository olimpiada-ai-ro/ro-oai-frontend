'use client';

import { cn } from '@/lib/utils';

export interface CountryFlagProps {
    countryCode: string;
    countryName?: string;
    size?: 'sm' | 'md' | 'lg';
    showName?: boolean;
    /** Hide the flag from assistive technology when adjacent text already names the country. */
    decorative?: boolean;
    className?: string;
}

const sizeClasses = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-3xl',
};

const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
};

/**
 * CountryFlag component displays a country flag emoji with optional country name.
 *
 * Features:
 * - Displays flag emoji for valid country codes
 * - Supports size variants (sm, md, lg)
 * - Optional country name display
 * - Proper ARIA labels for accessibility
 * - Graceful handling of invalid/missing country codes
 *
 * @example
 * <CountryFlag countryCode="RO" countryName="Romania" size="md" showName />
 */
export function CountryFlag({
    countryCode,
    countryName,
    size = 'md',
    showName = false,
    decorative = false,
    className,
}: CountryFlagProps) {
    // Handle invalid or missing country codes
    if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) {
        return null;
    }

    // Convert country code to uppercase for consistency
    const normalizedCode = countryCode.toUpperCase();

    // Convert ISO 3166-1 alpha-2 code to flag emoji
    // Flag emojis are formed by combining regional indicator symbols
    // A = U+1F1E6, B = U+1F1E7, etc.
    const codePoints = [...normalizedCode].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65);
    const flagEmoji = String.fromCodePoint(...codePoints);

    // Determine ARIA label
    const ariaLabel = countryName ? `${countryName} flag` : `${normalizedCode} flag`;

    return (
        <span
            className={cn('inline-flex items-center gap-1.5', className)}
            role={decorative ? undefined : 'img'}
            aria-label={decorative ? undefined : ariaLabel}
            aria-hidden={decorative || undefined}
        >
            <span className={cn('inline-block leading-none', sizeClasses[size])} aria-hidden="true">
                {flagEmoji}
            </span>
            {showName && countryName && (
                <span className={cn('font-medium', textSizeClasses[size])}>{countryName}</span>
            )}
        </span>
    );
}
