import type { Metadata } from 'next';

import { InstitutionDetailView } from '@/components/institution-detail-view';
import { PlatformPageShell } from '@/components/platform-page-shell';
import { getInstitutionById } from '@/lib/api';
import { getCountryDisplayName } from '@/lib/country-display';
import { getMessages, getServerLocale } from '@/lib/i18n-server';

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
        return {
            title: `${fallbackTitle} - MLCompete`,
            description: messages.institutions?.description,
            alternates: { canonical: `/${locale}/institutions/${id}` },
        };
    }

    try {
        const institution = await getInstitutionById(institutionId);
        const countryName = institution.country
            ? getCountryDisplayName(institution.country, locale)
            : '';
        return {
            title: `${institution.name} - MLCompete`,
            description:
                institution.description ||
                `${messages.institutions?.description || fallbackTitle}. ${
                    institution.country?.code === 'RO'
                        ? `${institution.county.name}, ${countryName}`
                        : countryName
                }.`,
            alternates: { canonical: `/${locale}/institutions/${institutionId}` },
        };
    } catch {
        return {
            title: `${fallbackTitle} - MLCompete`,
            description: messages.institutions?.description,
            alternates: { canonical: `/${locale}/institutions/${institutionId}` },
        };
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
