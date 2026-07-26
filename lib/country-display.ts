import type { Country } from '@/lib/types';
import type { County } from '@/lib/types';

/**
 * Prefer the browser's localized region names while keeping API-provided names
 * as a reliable fallback for older runtimes and uncommon country codes.
 */
export function getCountryDisplayName(country: Country, locale: string): string {
    try {
        const localizedName = new Intl.DisplayNames([locale], { type: 'region' }).of(
            country.code.toUpperCase(),
        );

        if (localizedName && localizedName.toUpperCase() !== country.code.toUpperCase()) {
            return localizedName;
        }
    } catch {
        // Intl.DisplayNames is unavailable or the locale/code is unsupported.
    }

    return locale === 'ro' && country.nameRo ? country.nameRo : country.name;
}

export function getInstitutionLocationLabel(
    institution: { country?: Country | null; county?: County | null },
    locale: string,
): string {
    if (!institution.country) {
        return institution.county?.name ?? '';
    }

    const countryName = getCountryDisplayName(institution.country, locale);
    if (institution.country.code.toUpperCase() !== 'RO') {
        return countryName;
    }

    return institution.county?.name ? `${institution.county.name}, ${countryName}` : countryName;
}
