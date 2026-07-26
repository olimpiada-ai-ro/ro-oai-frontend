import { Globe2 } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CountryListView } from '@/components/country-list-view';
import { PlatformPageHeader, PlatformPageShell } from '@/components/platform-page-shell';
import { getServerLocale } from '@/lib/i18n-server';
import { generateCountriesMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata() {
    const locale = await getServerLocale();
    return generateCountriesMetadata(locale);
}

export default async function CountriesPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations();

    return (
        <PlatformPageShell>
            <PlatformPageHeader
                eyebrow={t('hero.platformTitle')}
                icon={Globe2}
                title={t('countries.title')}
                description={t('institutions.description')}
            />
            <CountryListView />
        </PlatformPageShell>
    );
}
