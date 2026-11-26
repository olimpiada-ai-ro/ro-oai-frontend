'use client';

import { Link } from '@/i18n/routing';
import { UserAvatar } from '@/components/user-avatar';
import { UserIdentityPresentation } from '@/components/user-identity-presentation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeIcon, TrophyIcon } from 'lucide-react';
import type { EditorialAuthorResponse } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { getProfileUrl as getProfileUrlUtil } from '@/lib/profile-utils';
import { formatRankBadge } from './editorial-author-utils';

type EditorialAuthorCardProps = {
    author: EditorialAuthorResponse;
    onViewSource?: () => void;
};

/**
 * EditorialAuthorCard displays an editorial author with their profile link,
 * rank badge (if they participated), and a "View Source" button if they
 * have shared source code.
 *
 * Requirements: 3.1, 3.2, 3.3, 6.2
 */
export function EditorialAuthorCard({ author, onViewSource }: EditorialAuthorCardProps) {
    const t = useTranslations('editorial');
    const profileUrl = getProfileUrlUtil(author.userId, author.username);

    return (
        <article className="flex min-h-24 items-center gap-3 border-b border-[var(--platform-line)] bg-[var(--platform-paper)] p-4 transition-colors duration-200 hover:bg-[var(--platform-paper-strong)] sm:border-e">
            <Link
                href={profileUrl}
                aria-label={author.username}
                className="shrink-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--platform-coral)] focus-visible:ring-offset-2"
            >
                <UserAvatar
                    avatar={author.avatar}
                    userId={author.userId}
                    username={author.username}
                    className="h-11 w-11 rounded-none border border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)]"
                    imageClassName="rounded-none"
                    fallbackClassName="rounded-none text-sm font-bold"
                    loading="lazy"
                />
            </Link>

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href={profileUrl}
                        className="group inline-flex min-h-11 min-w-0 max-w-full items-center font-semibold text-inherit focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--platform-coral)]"
                        data-testid="author-profile-link"
                    >
                        <UserIdentityPresentation
                            surface="AUTHOR"
                            compact
                            identityPresentation={author.identityPresentation}
                            username={author.username}
                            usernameClassName="underline decoration-[var(--platform-coral)] decoration-2 underline-offset-4 group-hover:no-underline"
                        />
                    </Link>

                    {/* Rank badge - only shown when author has a competition rank */}
                    {author.competitionRank != null && (
                        <Badge
                            variant="secondary"
                            className="rounded-none border border-[var(--platform-line-strong)] bg-[var(--platform-paper-strong)] text-xs text-[var(--platform-ink)] shadow-none"
                            data-testid="rank-badge"
                        >
                            <TrophyIcon className="h-3 w-3" aria-hidden="true" />
                            {formatRankBadge(author.competitionRank)}
                        </Badge>
                    )}

                    {/* Role badge */}
                    {author.role && (
                        <Badge
                            variant="outline"
                            className="rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] text-xs text-[var(--platform-ink-muted)] shadow-none"
                        >
                            {author.role}
                        </Badge>
                    )}
                </div>
            </div>

            {/* View Source button - only shown when author has source code */}
            {author.hasSourceCode && onViewSource && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={onViewSource}
                    className="min-h-11 shrink-0 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)] px-3 text-[var(--platform-ink)] shadow-none hover:border-[var(--platform-violet)] hover:bg-[var(--platform-paper-strong)] active:scale-[0.98]"
                    data-testid="view-source-button"
                >
                    <CodeIcon className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{t('viewSource')}</span>
                    <span className="sr-only sm:hidden">{t('viewSource')}</span>
                </Button>
            )}
        </article>
    );
}
