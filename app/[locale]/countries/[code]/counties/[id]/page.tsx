import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { CountyDetailView } from '@/components/county-detail-view';
import { PlatformPageShell } from '@/components/platform-page-shell';
import { getCountryCountyById } from '@/lib/api';
import { getMessages, getServerLocale } from '@/lib/i18n-server';
import { getCanonicalUrl } from '@/lib/seo/canonical';
import {
    generateCountyOgImageUrl,
    getFallbackOgImageUrl,
    SUPPORTED_LOCALES,
} from '@/lib/seo/config';
import { generateMetadata as generateSeoMetadata } from '@/lib/seo/metadata';

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

    if (countryCode !== 'RO' || !Number.isInteger(countyId) || countyId <= 0) {
        return generateSeoMetadata({
            title: `${fallbackTitle} - MLCompete`,
            description:
                messages.counties?.description || 'Browse Romanian counties and institutions.',
            image: getFallbackOgImageUrl(),
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((candidate) => candidate !== locale),
            canonicalUrl: getCanonicalUrl(`/countries/${countryCode}/counties/${id}`, locale),
            noindex: true,
            nofollow: true,
        });
    }

    try {
        const county = await getCountryCountyById('RO', countyId);
        const description = `${messages.counties?.detailDescription || fallbackTitle}: ${county.name} (${county.code}).`;

        return generateSeoMetadata({
            title: `${county.name} - MLCompete`,
            description,
            keywords: [county.name, county.code, 'Romania', 'institutions', 'MLCompete'],
            image: generateCountyOgImageUrl(county.name, county.code),
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((candidate) => candidate !== locale),
            canonicalUrl: getCanonicalUrl(`/countries/RO/counties/${countyId}`, locale),
        });
    } catch {
        return generateSeoMetadata({
            title: `${fallbackTitle} - MLCompete`,
            description:
                messages.counties?.description || 'Browse Romanian counties and institutions.',
            image: getFallbackOgImageUrl(),
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((candidate) => candidate !== locale),
            canonicalUrl: getCanonicalUrl(`/countries/RO/counties/${countyId}`, locale),
            noindex: true,
        });
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
