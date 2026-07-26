import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { CountryDetailView } from '@/components/country-detail-view';
import { PlatformPageShell } from '@/components/platform-page-shell';
import { getCountryOverview } from '@/lib/api';
import { getCountryDisplayName } from '@/lib/country-display';
import { getMessages, getServerLocale } from '@/lib/i18n-server';

type CountryDetailPageProps = {
    params: Promise<{ code: string; locale: string }>;
};

export async function generateMetadata({ params }: CountryDetailPageProps): Promise<Metadata> {
    const [{ code, locale }, messages] = await Promise.all([
        params,
        getServerLocale().then(getMessages),
    ]);
    const countryCode = code.trim().toUpperCase();
    const fallbackTitle = messages.countries?.title || 'Countries';

    try {
        const overview = await getCountryOverview(countryCode);
        const countryName = getCountryDisplayName(overview.country, locale);
        return {
            title: `${countryName} - MLCompete`,
            description: overview.hasCountyBreakdown
                ? messages.counties?.description
                : messages.institutions?.description,
            alternates: { canonical: `/${locale}/countries/${overview.country.code}` },
        };
    } catch {
        return {
            title: `${fallbackTitle} - MLCompete`,
            description: messages.institutions?.description,
            alternates: { canonical: `/${locale}/countries/${countryCode}` },
        };
    }
}

export default async function CountryDetailPage({ params }: CountryDetailPageProps) {
    const { code, locale } = await params;
    const normalizedCountryCode = code.trim().toUpperCase();

    if (!/^[A-Z]{2}$/.test(normalizedCountryCode)) {
        notFound();
    }

    if (code !== normalizedCountryCode) {
        permanentRedirect(`/${locale}/countries/${normalizedCountryCode}`);
    }

    return (
        <PlatformPageShell>
            <CountryDetailView countryCode={normalizedCountryCode} />
        </PlatformPageShell>
    );
}
