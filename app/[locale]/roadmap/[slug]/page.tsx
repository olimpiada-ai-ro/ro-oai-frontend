import { fetchApi } from '@/lib/api';
import { getServerLocale } from '@/lib/i18n-server';
import RoadmapDetails, {
    RoadmapPagePublicResponse,
    RoadmapTreeEntry,
} from '@/components/roadmap-details';
import type { Metadata } from 'next';
import {
    generateGenericOgImageUrl,
    getCanonicalUrl,
    generateMetadata as computeMetadata,
    MetadataConfig,
    SUPPORTED_LOCALES,
    BASE_URL,
} from '@/lib/seo';
import { generateArticleSchema, generateBreadcrumbSchema } from '@/lib/seo/structured-data';
import { StructuredData } from '@/components/structured-data';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AlertTriangle, BookOpen, RotateCcw } from 'lucide-react';
import {
    PlatformEmptyState,
    PlatformPageHeader,
    PlatformPageShell,
} from '@/components/platform-page-shell';
import { Link } from '@/i18n/routing';
import { generateRoadmapMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const locale = await getServerLocale();
    const slug = (await params).slug;
    let page: RoadmapPagePublicResponse;
    try {
        const response = await fetchApi(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/roadmap/pages/${slug}`,
        );
        if (!response.ok) return generateRoadmapMetadata(locale);
        page = (await response.json()) as RoadmapPagePublicResponse;
    } catch {
        return generateRoadmapMetadata(locale);
    }

    const title = page.title;
    const description = 'What we are building next and our vision for the platform';

    const ogImage = generateGenericOgImageUrl(title, description, { kind: 'roadmap' });

    const config: MetadataConfig = {
        title: `${title} - MLCompete`,
        description,
        keywords: ['roadmap', 'future', 'features', 'development', 'vision'],
        image: ogImage,
        type: 'website',
        locale,
        alternateLocales: SUPPORTED_LOCALES.filter((l) => l !== locale),
        canonicalUrl: getCanonicalUrl(`/roadmap/${page.slug}`, locale),
    };

    return computeMetadata(config);
}

export default async function RoadmapPage({ params }: { params: Promise<{ slug: string }> }) {
    const slug = (await params).slug;
    const locale = await getServerLocale();
    const t = await getTranslations();

    const [pageResult, treeResult] = await Promise.allSettled([
        fetchApi(`${process.env.NEXT_PUBLIC_API_BASE_URL}/roadmap/pages/${slug}`),
        fetchApi(`${process.env.NEXT_PUBLIC_API_BASE_URL}/roadmap/tree`),
    ]);

    const pageResponse = pageResult.status === 'fulfilled' ? pageResult.value : null;
    if (pageResponse?.status === 404) notFound();

    let page: RoadmapPagePublicResponse | null = null;
    let tree: RoadmapTreeEntry[] = [];

    if (pageResponse?.ok) {
        try {
            page = (await pageResponse.json()) as RoadmapPagePublicResponse;
        } catch {
            page = null;
        }
    }

    const treeResponse = treeResult.status === 'fulfilled' ? treeResult.value : null;
    if (treeResponse?.ok) {
        try {
            tree = (await treeResponse.json()) as RoadmapTreeEntry[];
        } catch {
            tree = [];
        }
    }

    if (!page) {
        return (
            <PlatformPageShell>
                <PlatformPageHeader
                    eyebrow={t('hero.platformTitle')}
                    icon={BookOpen}
                    title={t('navigation.roadmap')}
                    description={t('roadmap.description')}
                />
                <PlatformEmptyState
                    className="mt-10"
                    icon={AlertTriangle}
                    title={t('common.error')}
                    description={t('roadmap.description')}
                    action={
                        <Link
                            href={`/roadmap/${slug}`}
                            className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--platform-line-strong)] bg-[var(--platform-violet)] px-4 py-2 text-sm font-bold text-white shadow-[4px_4px_0_var(--platform-line)] transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--platform-coral)] focus-visible:ring-offset-2 active:translate-y-px dark:text-[var(--platform-on-accent)]"
                        >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            {t('common.retry')}
                        </Link>
                    }
                />
            </PlatformPageShell>
        );
    }

    // Generate Article schema for SEO (server-side)
    const articleSchema = generateArticleSchema(
        {
            title: page.title,
            slug: page.slug,
            html: page.html,
        },
        locale,
    );

    // Generate Breadcrumb schema for navigation hierarchy
    const localePrefix = `/${locale}`;
    const breadcrumbSchema = generateBreadcrumbSchema([
        { name: t('common.appName'), url: `${BASE_URL}${localePrefix}` },
        { name: t('navigation.roadmap'), url: `${BASE_URL}${localePrefix}/roadmap` },
        { name: page.title, url: `${BASE_URL}${localePrefix}/roadmap/${page.slug}` },
    ]);

    return (
        <PlatformPageShell>
            <StructuredData data={[articleSchema, breadcrumbSchema]} />
            <PlatformPageHeader
                eyebrow={t('navigation.roadmap')}
                icon={BookOpen}
                title={page.title}
                description={t('roadmap.description')}
            />
            <RoadmapDetails page={page} tree={tree} showTitle={false} />
        </PlatformPageShell>
    );
}
