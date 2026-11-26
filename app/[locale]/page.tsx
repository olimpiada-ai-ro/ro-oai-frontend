import { Suspense } from 'react';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

import type { CompetitionUserListResponse, Locale, Page } from '@/lib/types';
import { fetchApi } from '@/lib/api';
import { HomeContent, HomePageLoading } from '@/components/home-content';
import { getHomepageCompetitionCount, type HomepageProblem } from '@/lib/homepage';
import { getCurrentCompetitionState } from '@/lib/current-competition';
import { generateHomeMetadata } from '@/lib/seo/page-metadata';
import {
    generateImageObjectSchema,
    generateOrganizationSchema,
    generateWebSiteSchema,
} from '@/lib/seo/structured-data';
import { StructuredData } from '@/components/structured-data';
import { BASE_URL, ORGANIZATION_CONFIG, generateHomeOgImageUrl } from '@/lib/seo/config';
import { getPublishedArticles } from '@/lib/articles';

type Props = {
    params: Promise<{ locale: string }>;
};

type LoadResult<T> = {
    data: Page<T> | null;
    unavailable: boolean;
};

function isNextRedirect(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'digest' in error &&
        String(error.digest).startsWith('NEXT_REDIRECT')
    );
}

async function loadPage<T>(url: URL, label: string): Promise<LoadResult<T>> {
    try {
        const response = await fetchApi(url);

        if (!response.ok) {
            console.error(`Error loading ${label} on the homepage: ${response.status}`);
            return { data: null, unavailable: true };
        }

        return { data: (await response.json()) as Page<T>, unavailable: false };
    } catch (error) {
        if (isNextRedirect(error)) throw error;

        console.error(`Error loading ${label} on the homepage:`, error);
        return { data: null, unavailable: true };
    }
}

/** Generate localized metadata for the homepage. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    const metadata = await generateHomeMetadata(locale as Locale);

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

async function HomePageFeed({ locale }: { locale: Locale }) {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL!;
    const problemsUrl = new URL('/problems', `${apiBaseUrl}/`);
    problemsUrl.searchParams.set('page', '0');
    problemsUrl.searchParams.set('size', '5');

    // Fetch the complete competition summary so competition-mode decisions never
    // depend on a small preview slice. The UI still curates only three events.
    const competitionsUrl = new URL('/competitions', `${apiBaseUrl}/`);
    competitionsUrl.searchParams.set('page', '0');
    competitionsUrl.searchParams.set('size', '100');

    const [problemsResult, competitionsResult, currentCompetitionState, articlesResult] =
        await Promise.all([
            loadPage<HomepageProblem>(problemsUrl, 'problems'),
            loadPage<CompetitionUserListResponse>(competitionsUrl, 'competitions'),
            getCurrentCompetitionState(),
            getPublishedArticles({ page: 0, size: 3, locale })
                .then((data) => ({ data, unavailable: false }))
                .catch((error) => {
                    console.error('Error loading articles on the homepage:', error);
                    return { data: null, unavailable: true };
                }),
        ]);

    const competitionPage = competitionsResult.data;
    const publicCompetitionCount = getHomepageCompetitionCount(
        competitionPage?.content ?? [],
        competitionPage?.page.totalElements ?? 0,
    );

    return (
        <HomeContent
            locale={locale}
            problems={problemsResult.data?.content ?? []}
            competitions={competitionsResult.data?.content ?? []}
            totalProblems={problemsResult.data?.page.totalElements ?? 0}
            totalCompetitions={publicCompetitionCount}
            problemsUnavailable={problemsResult.unavailable}
            competitionsUnavailable={competitionsResult.unavailable}
            authoritativeCompetitionMode={currentCompetitionState.isAnyCompetitionOngoing}
            articles={articlesResult.data?.content ?? []}
            articlesUnavailable={articlesResult.unavailable}
        />
    );
}

export default async function Home({ params }: Props) {
    const { locale: localeParam } = await params;
    const locale = localeParam as Locale;
    setRequestLocale(locale);

    const organizationSchema = generateOrganizationSchema(locale);
    const websiteSchema = generateWebSiteSchema(locale);
    const imageObjectSchema = generateImageObjectSchema(generateHomeOgImageUrl(), {
        license: 'https://creativecommons.org/licenses/by-nc/4.0/',
        acquireLicensePage: `${BASE_URL}/terms`,
        creditText: ORGANIZATION_CONFIG.name,
        creator: ORGANIZATION_CONFIG.name,
        copyrightNotice: `© ${new Date().getFullYear()} ${ORGANIZATION_CONFIG.name}`,
        width: 1200,
        height: 630,
    });

    return (
        <>
            <StructuredData data={[organizationSchema, websiteSchema, imageObjectSchema]} />
            <Suspense fallback={<HomePageLoading />}>
                <HomePageFeed locale={locale} />
            </Suspense>
        </>
    );
}
