import { getTranslations } from 'next-intl/server';

import { PlatformPageShell } from '@/components/platform-page-shell';
import { Skeleton } from '@/components/ui/skeleton';

export default async function CompetitionSeriesLoading() {
    const t = await getTranslations('competitionSeries');
    return (
        <PlatformPageShell aria-busy="true">
            <span className="sr-only">{t('loading')}</span>
            <div className="border-b border-[var(--platform-line-strong)] pb-10">
                <Skeleton className="h-4 w-40 rounded-none" />
                <Skeleton className="mt-5 h-16 w-full max-w-4xl rounded-none" />
                <Skeleton className="mt-5 h-5 w-full max-w-2xl rounded-none" />
            </div>
            <Skeleton className="mt-8 h-12 w-full rounded-none" />
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-none" />
                ))}
            </div>
            <Skeleton className="mt-12 h-80 w-full rounded-none" />
        </PlatformPageShell>
    );
}
