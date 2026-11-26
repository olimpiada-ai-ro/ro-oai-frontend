import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ArticleDetailView } from '@/components/articles/article-detail-view';
import { StructuredData } from '@/components/structured-data';
import { ArticleApiError, getPublishedArticle } from '@/lib/articles';
import {
    generateCommunityArticleMetadata,
    generateCommunityArticleSchema,
    getCommunityArticleCanonicalUrl,
} from '@/lib/seo/community-article';
import { BASE_URL } from '@/lib/seo/config';
import { generateBreadcrumbSchema } from '@/lib/seo/structured-data';
import type { Locale } from '@/lib/types';

type Props = {
    params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale: localeParam, slug } = await params;
    const locale = localeParam as Locale;

    try {
        const article = await getPublishedArticle(slug, locale);
        const seoT = await getTranslations({ locale: article.language, namespace: 'articles' });
        return generateCommunityArticleMetadata(article, {
            authorFallback: seoT('authorFallback'),
            generalSection: seoT('kinds.general'),
            editorialSection: seoT('kinds.problemEditorial'),
        });
    } catch (error) {
        if (error instanceof ArticleApiError && error.status === 404) notFound();
        throw error;
    }
}

export default async function ArticlePage({ params }: Props) {
    const { locale: localeParam, slug } = await params;
    const locale = localeParam as Locale;
    setRequestLocale(locale);

    let article;
    try {
        article = await getPublishedArticle(slug, locale);
    } catch (error) {
        if (error instanceof ArticleApiError && error.status === 404) notFound();
        throw error;
    }

    const seoT = await getTranslations({ locale: article.language, namespace: 'articles' });
    const articleUrl = getCommunityArticleCanonicalUrl(article);
    const breadcrumbSchema = generateBreadcrumbSchema([
        { name: seoT('breadcrumbs.home'), url: `${BASE_URL}/${article.language}` },
        { name: seoT('title'), url: `${BASE_URL}/${article.language}/articles` },
        { name: article.title, url: articleUrl },
    ]);
    const articleSchema = generateCommunityArticleSchema(article, {
        authorFallback: seoT('authorFallback'),
        generalSection: seoT('kinds.general'),
        editorialSection: seoT('kinds.problemEditorial'),
    });

    return (
        <>
            <StructuredData data={[articleSchema, breadcrumbSchema]} />
            <ArticleDetailView article={article} locale={locale} />
        </>
    );
}
