import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { CountryDetailView } from '@/components/country-detail-view';
import { PlatformPageShell } from '@/components/platform-page-shell';
import { getCountryOverview } from '@/lib/api';
import { generateCountryDetailMetadata } from '@/lib/seo/page-metadata';

type CountryDetailPageProps = {
    params: Promise<{ code: string; locale: string }>;
};

export async function generateMetadata({ params }: CountryDetailPageProps): Promise<Metadata> {
    const { code, locale } = await params;
    const countryCode = code.trim().toUpperCase();

    try {
        const overview = await getCountryOverview(countryCode);
        const metadata = await generateCountryDetailMetadata(countryCode, locale, overview);
        return toNextMetadata(metadata);
    } catch {
        const metadata = await generateCountryDetailMetadata(countryCode, locale);
        return toNextMetadata(metadata);
    }
}

function toNextMetadata(
    metadata: Awaited<ReturnType<typeof generateCountryDetailMetadata>>,
): Metadata {
    return {
        title: metadata.title,
        description: metadata.description,
        keywords: metadata.keywords,
        openGraph: metadata.openGraph,
        twitter: metadata.twitter,
        alternates: metadata.alternates,
        robots: metadata.robots,
    };
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
