import type { Metadata } from 'next';

import { InstitutionDetailView } from '@/components/institution-detail-view';
import { PlatformPageShell } from '@/components/platform-page-shell';
import { getInstitutionById } from '@/lib/api';
import { getCountryDisplayName } from '@/lib/country-display';
import { getMessages, getServerLocale } from '@/lib/i18n-server';
import { getCanonicalUrl } from '@/lib/seo/canonical';
import {
    generateInstitutionOgImageUrl,
    getFallbackOgImageUrl,
    SUPPORTED_LOCALES,
} from '@/lib/seo/config';
import { generateMetadata as generateSeoMetadata } from '@/lib/seo/metadata';

type InstitutionDetailPageProps = {
    params: Promise<{ id: string; locale: string }>;
};

export async function generateMetadata({ params }: InstitutionDetailPageProps): Promise<Metadata> {
    const [{ id, locale }, messages] = await Promise.all([
        params,
        getServerLocale().then(getMessages),
    ]);
    const institutionId = Number(id);
    const fallbackTitle = messages.institutions?.title || 'Institutions';

    if (!Number.isInteger(institutionId) || institutionId <= 0) {
        return generateSeoMetadata({
            title: `${fallbackTitle} - MLCompete`,
            description: messages.institutions?.description || 'Browse educational institutions.',
            image: getFallbackOgImageUrl(),
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((candidate) => candidate !== locale),
            canonicalUrl: getCanonicalUrl(`/institutions/${id}`, locale),
            noindex: true,
            nofollow: true,
        });
    }

    try {
        const institution = await getInstitutionById(institutionId);
        const countryName = institution.country
            ? getCountryDisplayName(institution.country, locale)
            : '';
        const location =
            institution.country?.code === 'RO'
                ? [institution.county?.name, countryName].filter(Boolean).join(', ')
                : countryName;
        const description =
            institution.description ||
            `${messages.institutions?.description || fallbackTitle}. ${location}.`;

        return generateSeoMetadata({
            title: `${institution.name} - MLCompete`,
            description,
            keywords: [
                institution.name,
                countryName,
                'educational institution',
                'MLCompete',
            ].filter(Boolean),
            image: generateInstitutionOgImageUrl(institution.name, {
                countryCode: institution.country?.code,
                location,
            }),
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((candidate) => candidate !== locale),
            canonicalUrl: getCanonicalUrl(`/institutions/${institutionId}`, locale),
        });
    } catch {
        return generateSeoMetadata({
            title: `${fallbackTitle} - MLCompete`,
            description: messages.institutions?.description || 'Browse educational institutions.',
            image: getFallbackOgImageUrl(),
            type: 'website',
            locale,
            alternateLocales: SUPPORTED_LOCALES.filter((candidate) => candidate !== locale),
            canonicalUrl: getCanonicalUrl(`/institutions/${institutionId}`, locale),
            noindex: true,
        });
    }
}

export default async function InstitutionDetailPage({ params }: InstitutionDetailPageProps) {
    const { id } = await params;
    const institutionId = Number(id);

    return (
        <PlatformPageShell>
            <InstitutionDetailView
                institutionId={
                    Number.isInteger(institutionId) && institutionId > 0 ? institutionId : null
                }
            />
        </PlatformPageShell>
    );
}
