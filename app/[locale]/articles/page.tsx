import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import {
    ArticleIndexView,
    type ArticleIndexLabels,
} from '@/components/articles/article-index-view';
import { buildArticleIndexHref, getPublishedArticles } from '@/lib/articles';
import {
    BASE_URL,
    DEFAULT_LOCALE,
    OG_IMAGE_DIMENSIONS,
    SITE_CONFIG,
    SUPPORTED_LOCALES,
    TWITTER_DEFAULTS,
    generateGenericOgImageUrl,
    getOgLocale,
} from '@/lib/seo/config';
import type { Locale } from '@/lib/types';

type Props = {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{
        page?: string | string[];
        authorId?: string | string[];
        problemId?: string | string[];
    }>;
};

function firstQueryValue(value: string | string[] | undefined): string | undefined {
    return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
    const [{ locale }, query] = await Promise.all([params, searchParams]);
    const t = await getTranslations({ locale, namespace: 'articles' });
    const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
    const page = /^\d+$/.test(rawPage ?? '') ? Math.max(1, Number(rawPage)) : 1;
    const filtered = Boolean(firstQueryValue(query.authorId) || firstQueryValue(query.problemId));
    const canonicalPage = filtered ? 1 : page;
    const pageQuery = canonicalPage > 1 ? `?page=${canonicalPage}` : '';
    const canonical = `${BASE_URL}/${locale}/articles${pageQuery}`;
    const image = generateGenericOgImageUrl(t('metaTitle'), t('metaDescription'), {
        kind: 'articles',
    });
    const languages = Object.fromEntries([
        ...SUPPORTED_LOCALES.map((candidate) => [
            candidate,
            `${BASE_URL}/${candidate}/articles${pageQuery}`,
        ]),
        ['x-default', `${BASE_URL}/${DEFAULT_LOCALE}/articles${pageQuery}`],
    ]);

    return {
        title: t('metaTitle'),
        description: t('metaDescription'),
        alternates: { canonical, languages },
        robots: {
            index: !filtered,
            follow: true,
            googleBot: {
                index: !filtered,
                follow: true,
                'max-image-preview': 'large',
                'max-snippet': -1,
                'max-video-preview': -1,
            },
        },
        openGraph: {
            type: 'website',
            title: t('metaTitle'),
            description: t('metaDescription'),
            url: canonical,
            siteName: SITE_CONFIG.name,
            locale: getOgLocale(locale as Locale),
            alternateLocale: SUPPORTED_LOCALES.filter((candidate) => candidate !== locale).map(
                getOgLocale,
            ),
            images: [
                {
                    url: image,
                    width: OG_IMAGE_DIMENSIONS.width,
                    height: OG_IMAGE_DIMENSIONS.height,
                    type: 'image/png',
                    alt: t('metaTitle'),
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: t('metaTitle'),
            description: t('metaDescription'),
            images: [{ url: image, alt: t('metaTitle') }],
            site: TWITTER_DEFAULTS.site,
            creator: TWITTER_DEFAULTS.creator,
        },
    };
}

export default async function ArticlesPage({ params, searchParams }: Props) {
    const [{ locale: localeParam }, query] = await Promise.all([params, searchParams]);
    const locale = localeParam as Locale;
    setRequestLocale(locale);
    const t = await getTranslations('articles');
    const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
    const requestedPage = /^\d+$/.test(rawPage ?? '') ? Math.max(1, Number(rawPage)) : 1;
    const rawAuthorId = firstQueryValue(query.authorId);
    const authorId = rawAuthorId && rawAuthorId.length <= 128 ? rawAuthorId : undefined;
    const rawProblemId = firstQueryValue(query.problemId);
    const problemId = /^\d+$/.test(rawProblemId ?? '') ? Number(rawProblemId) : undefined;
    const filters = {
        ...(authorId ? { authorId } : {}),
        ...(problemId && problemId > 0 ? { problemId } : {}),
    };

    const articles = await getPublishedArticles({
        page: requestedPage - 1,
        size: 12,
        locale,
        ...filters,
    });

    if (articles.page.totalPages > 0 && requestedPage > articles.page.totalPages) {
        redirect(`/${locale}${buildArticleIndexHref(articles.page.totalPages, filters)}`);
    }

    const labels: ArticleIndexLabels = {
        eyebrow: t('eyebrow'),
        title: t('title'),
        description: t('description'),
        count: t('count'),
        featured: t('featured'),
        general: t('kinds.general'),
        editorial: t('kinds.problemEditorial'),
        authors: t('authors'),
        authorFallback: t('authorFallback'),
        published: t('published'),
        linkedProblem: t('linkedProblem'),
        readArticle: t('readArticle'),
        previousPage: t('pagination.previous'),
        nextPage: t('pagination.next'),
        paginationLabel: t('pagination.label'),
        pageLabel: t('pagination.page', { page: '{page}', pages: '{pages}' }),
        emptyTitle: t('empty.title'),
        emptyDescription: t('empty.description'),
        writeArticle: t('profile.writeArticle'),
    };

    return (
        <ArticleIndexView articles={articles} locale={locale} labels={labels} filters={filters} />
    );
}
