import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { CountyDetailView } from '@/components/county-detail-view';
import { PlatformPageShell } from '@/components/platform-page-shell';
import { getCountryCountyById } from '@/lib/api';
import { getMessages, getServerLocale } from '@/lib/i18n-server';

type CountryCountyDetailPageProps = {
    params: Promise<{ code: string; id: string; locale: string }>;
};

export async function generateMetadata({
    params,
}: CountryCountyDetailPageProps): Promise<Metadata> {
    const [{ code, id, locale }, messages] = await Promise.all([
        params,
        getServerLocale().then(getMessages),
    ]);
    const countyId = Number(id);
    const countryCode = code.toUpperCase();
    const fallbackTitle = messages.counties?.title || 'Counties';
    const canonical = `/${locale}/countries/${countryCode}/counties/${id}`;

    if (countryCode !== 'RO' || !Number.isInteger(countyId) || countyId <= 0) {
        return {
            title: `${fallbackTitle} - MLCompete`,
            description: messages.counties?.description,
            alternates: { canonical },
        };
    }

    try {
        const county = await getCountryCountyById('RO', countyId);
        return {
            title: `${county.name} - MLCompete`,
            description: `${messages.counties?.detailDescription || fallbackTitle}: ${county.name} (${county.code}).`,
            alternates: {
                canonical: `/${locale}/countries/RO/counties/${countyId}`,
            },
        };
    } catch {
        return {
            title: `${fallbackTitle} - MLCompete`,
            description: messages.counties?.description,
            alternates: { canonical },
        };
    }
}

export default async function CountryCountyDetailPage({ params }: CountryCountyDetailPageProps) {
    const { code, id, locale } = await params;
    const countyId = Number(id);
    const normalizedCountryCode = code.trim().toUpperCase();

    if (!/^[A-Z]{2}$/.test(normalizedCountryCode) || !Number.isInteger(countyId) || countyId <= 0) {
        notFound();
    }

    if (code !== normalizedCountryCode) {
        permanentRedirect(`/${locale}/countries/${normalizedCountryCode}/counties/${countyId}`);
    }

    if (normalizedCountryCode !== 'RO') {
        notFound();
    }

    return (
        <PlatformPageShell>
            <CountyDetailView countyId={countyId} countryCode="RO" />
        </PlatformPageShell>
    );
}
