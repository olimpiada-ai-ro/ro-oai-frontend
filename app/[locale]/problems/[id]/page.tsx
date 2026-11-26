import type { Page, Problem, Submission } from '@/lib/types';
import type { Metadata } from 'next';
import { fetchApi, getSubmissions } from '@/lib/api';
import { getServerSession } from 'next-auth/next';
import { notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import { getServerLocale } from '@/lib/i18n-server';
import { generateProblemMetadata } from '@/lib/seo/page-metadata';
import { generateQuizSchema, generateBreadcrumbSchema } from '@/lib/seo/structured-data';
import { StructuredData } from '@/components/structured-data';
import { BASE_URL } from '@/lib/seo/config';
import { ProblemDetails } from '@/components/problem-details';
import {
    PlatformEmptyState,
    PlatformPageHeader,
    PlatformPageShell,
} from '@/components/platform-page-shell';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';
import { getProblemArticles } from '@/lib/articles';

/**
 * Generate metadata for problem page with problem details
 */
export async function generateMetadata({
    params: paramsPromise,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const locale = await getServerLocale();
    const t = await getTranslations({ locale, namespace: 'problems' });
    const id = (await paramsPromise).id;
    const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/problems/${encodeURIComponent(id)}`;

    if (!/^\d+$/.test(id)) {
        return {
            title: `${t('problem')} - MLCompete`,
            robots: { index: false, follow: false },
        };
    }

    try {
        // Social metadata is public and cacheable. Fetch anonymously so a
        // reviewer/admin session can never publish draft-only fields in an OG URL.
        const res = await fetch(url, {
            headers: {
                accept: 'application/json',
                'accept-language': locale,
            },
            cache: 'no-store',
        });

        if (res.status === 404) {
            return {
                title: `${t('problem')} - MLCompete`,
                description: t('errorLoadingProblem'),
                robots: {
                    index: false,
                    follow: false,
                },
            };
        }

        if (!res.ok) throw new Error(`Problem metadata request failed with ${res.status}`);

        const problem = (await res.json()) as Problem;
        const metadata = await generateProblemMetadata(
            problem as unknown as Parameters<typeof generateProblemMetadata>[0],
            locale,
        );

        return {
            title: metadata.title,
            description: metadata.description,
            keywords: metadata.keywords,
            openGraph: metadata.openGraph,
            twitter: metadata.twitter,
            alternates: metadata.alternates,
            robots: metadata.robots,
        };
    } catch (error) {
        console.error('[SEO] Failed to generate problem metadata:', error);
        return {
            title: `${t('problem')} - MLCompete`,
            description: t('errorLoadingProblem'),
            robots: {
                index: false,
                follow: false,
            },
        };
    }
}

export default async function ProblemPage({
    params: paramsPromise,
}: {
    params: Promise<{ id: string }>;
}) {
    const t = await getTranslations('problems');
    const tCommon = await getTranslations('common');
    const tNavigation = await getTranslations('navigation');
    const id = (await paramsPromise).id;
    const locale = await getServerLocale();
    const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/problems/${encodeURIComponent(id)}`;

    if (!/^\d+$/.test(id)) notFound();

    let res: Response;
    try {
        res = await fetchApi(url, {
            headers: { 'accept-language': locale },
        });
    } catch (error) {
        console.error('Error loading problem:', error);
        return <ProblemLoadError />;
    }

    if (res.status === 404) notFound();

    if (!res.ok) {
        console.error('Error loading problem:', res.status);
        return <ProblemLoadError />;
    }

    let problem: Problem;
    try {
        problem = (await res.json()) as Problem;
    } catch (error) {
        console.error('Failed to parse problem response:', error);
        return <ProblemLoadError />;
    }

    // Default to empty submissions; populate if user is logged in
    let submissions: Page<Submission> | null = null;
    let submissionsLoadFailed = false;

    const [session, relatedArticles] = await Promise.all([
        getServerSession(authOptions),
        getProblemArticles(problem.id, { locale }).catch((error) => {
            console.error('[Problem] Failed to fetch related articles:', error);
            return {
                content: [],
                page: { number: 0, size: 12, totalElements: 0, totalPages: 0 },
            };
        }),
    ]);
    if (session) {
        try {
            submissions = await getSubmissions(id);
        } catch (e) {
            console.error('Failed to load submissions:', e);
            submissionsLoadFailed = true;
        }
    }

    const localePrefix = `/${locale}`;

    // Generate structured data for problem page (Quiz schema for Google Practice Problems)
    const quizSchema = generateQuizSchema(problem, locale);
    const breadcrumbSchema = generateBreadcrumbSchema([
        { name: tCommon('appName'), url: `${BASE_URL}${localePrefix}` },
        { name: tNavigation('problems'), url: `${BASE_URL}${localePrefix}/problems` },
        { name: problem.title, url: `${BASE_URL}${localePrefix}/problems/${problem.id}` },
    ]);

    return (
        <>
            <StructuredData data={[quizSchema, breadcrumbSchema]} />
            <ProblemDetails
                problem={problem}
                submissions={submissions}
                submissionsLoadFailed={submissionsLoadFailed}
                relatedArticles={relatedArticles.content}
                relatedArticleCount={relatedArticles.page.totalElements}
            />
        </>
    );

    async function ProblemLoadError() {
        return (
            <PlatformPageShell>
                <PlatformPageHeader
                    eyebrow={t('problem')}
                    icon={AlertTriangle}
                    title={t('errorLoadingProblem')}
                />
                <PlatformEmptyState
                    className="mt-8"
                    icon={AlertTriangle}
                    title={t('errorLoadingProblem')}
                    action={
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Button
                                asChild
                                className="h-11 rounded-none bg-[var(--platform-violet)] px-5 text-white hover:bg-[var(--platform-violet-strong)] dark:text-[var(--platform-on-accent)]"
                            >
                                <a href={`/${locale}/problems/${id}`}>
                                    <RotateCcw className="me-2 h-4 w-4" aria-hidden="true" />
                                    {tCommon('retry')}
                                </a>
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                className="h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-5 text-[var(--platform-ink)]"
                            >
                                <Link href="/problems">
                                    <ArrowLeft
                                        className="me-2 h-4 w-4 rtl:rotate-180"
                                        aria-hidden="true"
                                    />
                                    {t('viewAll')}
                                </Link>
                            </Button>
                        </div>
                    }
                />
            </PlatformPageShell>
        );
    }
}
